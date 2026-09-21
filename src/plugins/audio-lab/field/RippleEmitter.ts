/**
 * Turns events in the music into rings on the field.
 *
 * A ripple is the one part of the field that cannot be an expression. `P` and
 * `Q` are functions of position and the current sound, so they can say "push
 * harder while the bass is loud" but never "a drum hit happened *there*, *then*,
 * and the front from it is now this far out". That needs remembering, and
 * remembering is what this does: a small ring buffer of slots, each holding
 * where a ripple started, when, and how hard, packed into the exact float
 * layout the shader's uniform array expects.
 *
 * The buffer is written in place and handed out by reference. Nothing here
 * allocates once it is constructed, because it runs on every animation frame.
 */
import { RIPPLE_SLOTS, type RippleConfig, type RippleOrigin } from "./model";
import { RIPPLE_STRIDE } from "../../../field-rendering/FlowRenderer";
import type { FlowBounds } from "../../../field-rendering/FlowRenderer";
import type { AudioFeatureFrame } from "../audio/features";

/**
 * A ripple weaker than this is not worth a slot.
 *
 * Zero strength is how the shader recognises an empty slot, so a ripple that
 * rounds to nothing would be indistinguishable from no ripple — better to
 * refuse it here than to write a slot the shader then skips.
 */
const MIN_STRENGTH = 1e-3;

export class RippleEmitter {
  /** x, y, birth, strength per slot, in the shader's own layout. */
  private readonly slots = new Float32Array(RIPPLE_SLOTS * RIPPLE_STRIDE);
  private next = 0;
  /**
   * The onset the last ripple was fired for.
   *
   * Counted rather than detected from the impulse height. The field reads the
   * engine's latest frame on its own clock, which is faster than the analysis
   * clock, so the frame on which an onset fired is read several times over —
   * and a rising-edge test on the impulse would emit a ring on each of them.
   */
  private lastOnset = -1;
  private lastBeatPhase = 0;
  /** Where the cursor was, for the origins that follow it. */
  private pointerX = 0;
  private pointerY = 0;
  private pointerKnown = false;
  /**
   * A cheap scatter sequence.
   *
   * Deliberately not `Math.random`: a reproducible sequence means a test can
   * assert where a ripple landed, and nothing about scattering rings needs
   * better randomness than this.
   */
  private seed = 1;

  /** The packed slots, for `setDisturbances`. Read, do not keep. */
  get packed(): Float32Array {
    return this.slots;
  }

  /** How many slots currently hold a ripple. Instrumentation for the tests. */
  get activeCount() {
    let count = 0;
    for (let i = 0; i < RIPPLE_SLOTS; i++)
      if (this.slots[i * RIPPLE_STRIDE + 3] !== 0) count++;
    return count;
  }

  setPointer(x: number, y: number) {
    this.pointerX = x;
    this.pointerY = y;
    this.pointerKnown = true;
  }

  forgetPointer() {
    this.pointerKnown = false;
  }

  /**
   * Starts one ripple.
   *
   * Round-robin over the slots rather than looking for an expired one: the
   * oldest slot is the one that expires first anyway, and a scan would make the
   * cost of emitting depend on how full the buffer is.
   */
  emit(x: number, y: number, strength: number, nowSeconds: number) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (!Number.isFinite(strength) || Math.abs(strength) < MIN_STRENGTH) return;
    const at = this.next * RIPPLE_STRIDE;
    this.slots[at] = x;
    this.slots[at + 1] = y;
    this.slots[at + 2] = nowSeconds;
    this.slots[at + 3] = strength;
    this.next = (this.next + 1) % RIPPLE_SLOTS;
  }

  /**
   * Retires everything, e.g. when the field is switched off or the source
   * changes.
   *
   * Without this, turning the field back on after a minute away would show a
   * screen of rings all born at once, since their birth times are on a clock
   * that kept running.
   */
  clear() {
    this.slots.fill(0);
    this.next = 0;
    this.lastOnset = -1;
    this.lastBeatPhase = 0;
  }

  /**
   * Retires ripples whose lifetime has run out.
   *
   * The shader ignores an expired ripple on its own, so this is not needed for
   * correctness — it is needed so `activeCount` means what it says, and so a
   * long-lived slot cannot be resurrected by a later change to the lifetime
   * setting.
   */
  private expire(lifetime: number, nowSeconds: number) {
    for (let i = 0; i < RIPPLE_SLOTS; i++) {
      const at = i * RIPPLE_STRIDE;
      if (this.slots[at + 3] === 0) continue;
      if (nowSeconds - this.slots[at + 2] > lifetime) this.slots[at + 3] = 0;
    }
  }

  /**
   * One frame: retire what has finished and emit whatever the music asked for.
   *
   * `nowSeconds` is the same clock the shader compares a ripple's age against,
   * and is wall time rather than analysis time on purpose. A ripple in the air
   * when the music stops should finish expanding and fade, not freeze halfway
   * out because the thing that measures the sound stopped counting.
   */
  pump(
    frame: AudioFeatureFrame,
    config: RippleConfig,
    view: FlowBounds,
    nowSeconds: number
  ) {
    this.expire(config.lifetime, nowSeconds);
    if (config.source === "off") return;

    if (config.source === "onset") {
      if (frame.onsetCount === this.lastOnset) return;
      this.lastOnset = frame.onsetCount;
      // A first frame with a count already above zero is a field switched on
      // mid-song; there is no ring owed for an onset that happened before
      // anyone was watching.
      if (this.lastOnset <= 0) return;
    } else {
      const phase = frame.beatPhase;
      const wrapped = phase < this.lastBeatPhase;
      this.lastBeatPhase = phase;
      if (!wrapped || !Number.isFinite(frame.bpm)) return;
    }

    const { x, y } = this.origin(config.origin, frame, view);
    // Louder hits make stronger rings, with a floor so a quiet one is still a
    // ring rather than nothing.
    const scale = 0.55 + 0.45 * clamp01(frame.rms + frame.onset * 0.5);
    this.emit(x, y, config.strength * scale, nowSeconds);
  }

  private origin(
    origin: RippleOrigin,
    frame: AudioFeatureFrame,
    view: FlowBounds
  ) {
    const midX = (view.xMin + view.xMax) / 2;
    const midY = (view.yMin + view.yMax) / 2;
    const width = view.xMax - view.xMin;
    const height = view.yMax - view.yMin;
    switch (origin) {
      case "centre":
        return { x: midX, y: midY };
      case "pointer":
        // Falling back to the centre rather than to the last known position:
        // once the cursor has left the graph, "where the pointer is" has no
        // answer, and rings continuing to arrive at wherever it left reads as
        // a bug rather than as a default.
        return this.pointerKnown
          ? { x: this.pointerX, y: this.pointerY }
          : { x: midX, y: midY };
      case "spectrum":
        // Brightness across, loudness up. A bright hi-hat rings on the right
        // and high, a kick low and to the left, so the field lays the
        // spectrum out in space without anything having to be labelled.
        return {
          x: view.xMin + width * clamp01(frame.centroid),
          y: view.yMin + height * clamp01(0.15 + frame.rms * 0.7),
        };
      case "scatter":
      default:
        return {
          x: view.xMin + width * this.random(),
          y: view.yMin + height * this.random(),
        };
    }
  }

  /** A 32-bit Lehmer generator: one multiply and a modulus, no state to keep. */
  private random() {
    this.seed = (this.seed * 48_271) % 2_147_483_647;
    return this.seed / 2_147_483_647;
  }
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return value < 0 ? 0 : value > 1 ? 1 : value;
}
