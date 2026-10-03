/**
 * Decides how many fixed simulation steps each animation frame runs.
 *
 * A step always advances the simulation by the same amount of simulated time.
 * Frames only decide how many steps to run, never how long one is. That
 * separation is what makes the physics independent of the display: a lattice
 * Boltzmann step is only stable at the dt its relaxation time was chosen for,
 * and a 120 Hz monitor must not produce a different flow from a 60 Hz one. The
 * existing particle flow is frame-rate dependent (briefing §11.1). This is the
 * part of a simulation that must not be.
 *
 * The step count is computed from elapsed time since the start of the current
 * segment, not by adding up frame deltas. Adding deltas lets rounding
 * accumulate differently at each frame rate. Computing from elapsed time means
 * that at any given moment, every frame rate has asked for exactly the same
 * number of steps. A segment starts on play, on a change of rate or speed, and
 * after a stall.
 *
 * Two limits keep a slow machine usable, and both are reported rather than
 * hidden:
 * - **A frame budget.** A frame runs at most `maxStepsPerFrame` steps. When
 *   the GPU cannot keep up, the simulation runs slower than real time, and
 *   `realTimeFactor` says by how much. The steps themselves never change size.
 * - **A stall limit.** After a gap longer than `stallSeconds`, such as a
 *   hidden tab or a breakpoint, the debt is dropped instead of caught up in a
 *   burst that would freeze the page.
 */

export interface StepSchedulerOptions {
  /** Simulated seconds that one step advances. */
  stepSeconds: number;
  /** Simulated seconds per real second: 1 is real time. */
  speed?: number;
  /** The most steps one frame may run. */
  maxStepsPerFrame?: number;
  /** A gap between frames longer than this is not caught up. */
  stallSeconds?: number;
}

export interface FramePlan {
  /** How many steps to run now. */
  steps: number;
  /** Simulated seconds since the simulation began, after those steps. */
  simulatedSeconds: number;
  /** Steps since the simulation began, after those steps. */
  totalSteps: number;
  /**
   * Simulated seconds per real second over about the last second, against
   * `speed`. Below 1 means the machine is not keeping up.
   */
  realTimeFactor: number;
  /** Whether steps are owed that this frame's budget could not run. */
  behind: boolean;
}

/** How far back the real-time factor looks, in milliseconds. */
const FACTOR_WINDOW_MS = 1000;

export class StepScheduler {
  private stepSeconds: number;
  private speed: number;
  private readonly maxStepsPerFrame: number;
  private readonly stallMs: number;

  private totalSteps = 0;
  private simulatedSeconds = 0;
  private running = false;
  /** When the current segment began, in milliseconds, or undefined if none. */
  private segmentStart: number | undefined;
  private segmentSteps = 0;
  private lastFrame: number | undefined;
  /** Recent frames' times and simulated seconds, for the real-time factor. */
  private history: { at: number; simulated: number }[] = [];
  private stalls = 0;

  constructor(options: StepSchedulerOptions) {
    this.stepSeconds = positive(options.stepSeconds, "stepSeconds");
    this.speed = positive(options.speed ?? 1, "speed");
    this.maxStepsPerFrame = Math.max(
      1,
      Math.floor(options.maxStepsPerFrame ?? 64)
    );
    this.stallMs =
      positive(options.stallSeconds ?? 0.25, "stallSeconds") * 1000;
  }

  /** Starts or resumes. Time spent paused is never caught up. */
  play() {
    if (this.running) return;
    this.running = true;
    this.endSegment();
  }

  pause() {
    this.running = false;
    this.endSegment();
  }

  get isRunning() {
    return this.running;
  }

  /**
   * Changes the size of a step. Simulated time stays continuous: steps already
   * run keep the size they had. The Auto speed mode uses this when it halves
   * the lattice speed, which halves the simulated time one step covers.
   */
  setStepSeconds(stepSeconds: number) {
    this.stepSeconds = positive(stepSeconds, "stepSeconds");
    this.endSegment();
  }

  setSpeed(speed: number) {
    this.speed = positive(speed, "speed");
    this.endSegment();
  }

  /** Back to zero, as after a restart; running or paused is unchanged. */
  reset() {
    this.totalSteps = 0;
    this.simulatedSeconds = 0;
    this.history = [];
    this.stalls = 0;
    this.endSegment();
  }

  /** How many gaps have been dropped rather than caught up. */
  get stallCount() {
    return this.stalls;
  }

  /**
   * The plan for a frame drawn at `now` milliseconds, which must not go
   * backwards. The caller runs exactly `steps` steps.
   */
  frame(now: number): FramePlan {
    const previous = this.lastFrame;
    this.lastFrame = now;
    if (!this.running) {
      this.history = [];
      return this.plan(0, false);
    }
    if (previous !== undefined && now - previous > this.stallMs) {
      this.stalls++;
      this.endSegment();
    }
    if (this.segmentStart === undefined) {
      this.segmentStart = now;
      this.segmentSteps = 0;
    }

    const elapsed = (now - this.segmentStart) / 1000;
    // A whisker of tolerance so that a frame landing exactly on a step
    // boundary, give or take a rounding, counts that step at every frame rate.
    const target = Math.floor((elapsed * this.speed) / this.stepSeconds + 1e-9);
    const owed = Math.max(0, target - this.segmentSteps);
    const steps = Math.min(owed, this.maxStepsPerFrame);
    this.segmentSteps += steps;
    this.totalSteps += steps;
    this.simulatedSeconds += steps * this.stepSeconds;

    let behind = owed > steps;
    // Debt worth more than a stall is not going to be repaid; carrying it
    // would only make the next fast frame a burst. Start counting afresh.
    if (
      behind &&
      ((owed - steps) * this.stepSeconds) / this.speed > this.stallMs / 1000
    ) {
      this.segmentStart = now;
      this.segmentSteps = 0;
      behind = true;
    }

    this.history.push({ at: now, simulated: this.simulatedSeconds });
    while (
      this.history.length > 2 &&
      now - this.history[1].at >= FACTOR_WINDOW_MS
    ) {
      this.history.shift();
    }
    return this.plan(steps, behind);
  }

  private plan(steps: number, behind: boolean): FramePlan {
    return {
      steps,
      simulatedSeconds: this.simulatedSeconds,
      totalSteps: this.totalSteps,
      realTimeFactor: this.realTimeFactor(),
      behind,
    };
  }

  private realTimeFactor() {
    if (this.history.length < 2) return this.running ? 1 : 0;
    const [first] = this.history;
    const last = this.history[this.history.length - 1];
    const real = (last.at - first.at) / 1000;
    if (real <= 0) return 1;
    return (last.simulated - first.simulated) / real / this.speed;
  }

  private endSegment() {
    this.segmentStart = undefined;
    this.segmentSteps = 0;
  }
}

function positive(value: number, name: string) {
  if (!(value > 0) || !Number.isFinite(value)) {
    throw new RangeError(`${name} must be a positive number, not ${value}.`);
  }
  return value;
}
