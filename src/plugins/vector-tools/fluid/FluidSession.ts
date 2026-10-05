/**
 * The Fluid tab's live state: the graph's solids, the lattice that flows round
 * them, the clock it steps on, and what is measured.
 *
 * - **Solids.** These are the graph's inequality rows, compiled strictly so
 *   the fluid sees exactly the region Desmos shades. Each row says whether it
 *   compiled and, if not, why. A hidden row lets the fluid through.
 * - **The lattice.** It runs on the GPU (`FluidOverlay`), built from the tank,
 *   the solids and the settings. Its units come from `latticeUnits`. The
 *   start-up is GPT's tested one: the inflow eased in over 7.5 passes of the
 *   reference length, then a brief sideways gust, because a symmetric wake
 *   behind a symmetric body is a real solution and will not shed on its own.
 * - **The clock.** `StepScheduler` says how many steps each frame runs, never
 *   how long a step is.
 * - **Measurements.** Each solid's drag and lift, sampled every frame, and
 *   the shedding frequency once the lift repeats steadily.
 * - **The guards** Rafael chose (brief §8.1). Auto lowers the lattice speed
 *   when the flow anywhere passes Mach 0.3. Lively keeps the speed and says
 *   so. A resized solid either updates in place, marked as settling, or
 *   restarts the flow, per the Auto/Strict setting.
 *
 * It is kept out of `index.ts`, which is the plugin's wiring.
 */

import type { Calc } from "#globals";
import {
  CellKind,
  compileObstacle,
  rasterizeObstacles,
  type CompiledObstacle,
  type Rasterized,
} from "../../../field-rendering/sim/obstacles";
import {
  probeWithScratchContext,
  type SimCapabilities,
} from "../../../field-rendering/sim/capabilities";
import {
  ACCURATE_LATTICE_SPEED,
  CLOSURE_REYNOLDS,
  MACH_LIMIT,
  SMAGORINSKY_C,
  initialLatticeSpeed,
  latticeUnits,
  type LatticeUnits,
} from "../../../field-rendering/sim/latticeUnits";
import {
  StepScheduler,
  type FramePlan,
} from "../../../field-rendering/sim/StepScheduler";
import type { FieldEnvironment } from "../../../field-rendering/latexToGLSL";
import {
  createStandaloneLattice,
  sumForceTexels,
  type GpuD2Q9,
  type GpuLatticeOptions,
  type PendingRead,
} from "../../../field-rendering/sim/lbm/GpuD2Q9";
import {
  FluidOverlay,
  type LatticeSpec,
} from "../../../field-rendering/sim/FluidOverlay";
import {
  restShare,
  computeLinks,
} from "../../../field-rendering/sim/lbm/links";
import {
  lastCycle,
  sheddingPeriod,
  type Sample,
} from "../../../field-rendering/sim/measure";
import { fluidLatticeSize, fluidLatticeTank, type FluidConfig } from "../model";
import { FluidGraphWriter } from "./FluidGraphWriter";
import {
  WALL_SPEED_LIMIT,
  partialSolidsFromSamples,
  sampleObstacle,
  type MovingSolidsGrid,
  type ObstacleSamples,
  type PartialSolids,
} from "../../../field-rendering/sim/movingSolids";
import type {
  ObstacleSampler,
  PendingSample,
} from "../../../field-rendering/sim/obstacleSampler";
import {
  publishVelocitySample,
  withdrawVelocitySample,
} from "../../../field-rendering/field";
import { canonicalIdentifier } from "../../../field-rendering/identifiers";
import { parseStrictExpression } from "../../../field-rendering/sim/strictParse";
import { compileExpression } from "../../../field-rendering/sim/strictEvaluate";

/** One row of the expression list that could be a solid. */
export interface ObstacleRow {
  id: string;
  latex: string;
  color: string;
  /** Hidden rows let the fluid through. */
  hidden: boolean;
  /** Why it cannot be a solid, or undefined if it compiled. */
  error: string | undefined;
  obstacle: CompiledObstacle | undefined;
}

/** What has been measured on one solid. */
export interface BodyMeasurement {
  rowId: string;
  /** Drag and lift coefficients, averaged over the last cycle or second. */
  drag: number;
  lift: number;
  /** Strouhal number, once shedding repeats steadily. */
  strouhal: number | undefined;
  /** Why there is no Strouhal number yet, when there is not. */
  sheddingNote: string;
  /** Whether the values are settled, or still provisional. */
  settled: boolean;
}

/** As much of an item model as this reads. */
interface ItemLike {
  type?: string;
  id?: string;
  latex?: string;
  color?: string;
  hidden?: boolean;
}

/** As much of Desmos's `HelperExpression` as reading one number needs. */
interface ValueHelper {
  numericValue: number;
  observe: (event: string, callback: () => void) => void;
}

/** The field the panel is editing, as far as the stirred box needs it. */
export interface FieldDescription {
  source: "components" | "gradient";
  xLatex: string;
  yLatex: string;
  fLatex: string;
}

/** The moving rows, and what they are to be sampled at. See `movingRequest`. */
interface MovingRequest {
  rows: { row: ObstacleRow; body: number }[];
  scope: { time: number; params: ReadonlyMap<string, number> };
  /** For a row just unparked, the values it was parked at. */
  seeds: ({ time: number; params: ReadonlyMap<string, number> } | undefined)[];
  /** When it was asked, in milliseconds, for averaging the translation. */
  time: number;
  /** The lattice's step when asked. */
  step: number;
  /** Steps since the start of the frame before, for a row with no past. */
  sinceFrame: number;
  key: string;
  grid: MovingSolidsGrid;
}

/** A request's samples, row by row, and its unparked rows' seeds. */
interface MovingSamples {
  rows: ObstacleSamples[];
  seeds: (ObstacleSamples | undefined)[];
}

/** Moving cells, built, and as the lattice takes them. */
interface MovingCells {
  solids: PartialSolids;
  psm: { coverage: Float32Array; velocity: Float32Array; body: Uint8Array };
}

export interface FluidHost {
  calc: Calc;
  /** The field whose P and Q stir the box. */
  field: () => FieldDescription;
  config: () => FluidConfig;
  environment: () => FieldEnvironment;
  items: () => readonly ItemLike[];
  degreeMode: () => boolean;
  /**
   * One number from Desmos's own evaluator, by name. Undefined while Desmos
   * is dispatching, since making a helper dispatches and Desmos throws on a
   * dispatch inside another.
   */
  helper: (latex: string) => ValueHelper | undefined;
  /** Asks the panel to draw again. */
  changed: () => void;
  /** Prefix of rows Vector Tools writes itself, which are never obstacles. */
  ownedPrefix: () => string;
  /**
   * The fluid started or stopped, so whatever draws the field (particles,
   * arrows) should switch between the field's formula and the flow.
   */
  simulatingChanged: () => void;
}

/** The name the flow's velocity is published under, for the renderers. */
export const FLUID_SAMPLE_SOURCE = "vector-tools-fluid";
/** How often the flow is checked for its Mach number and validity. */
const CHECK_INTERVAL_MS = 100;

/** How often the panel's readouts redraw, in milliseconds. */
const READOUT_INTERVAL_MS = 250;
/**
 * How often the stirred box's strength is regulated, in seconds of flow, and
 * how quickly the applied strength follows (easeForce).
 */
const REGULATE_SECONDS = 0.5;
const FORCE_EASING_SECONDS = 0.25;
/**
 * How often the solids are checked for a change while the flow runs: a slider
 * drag, an edit, or an obstacle that moves with t.
 */
const GEOMETRY_INTERVAL_MS = 100;
/**
 * How long a moving solid may go without its sliders or clock changing before
 * it counts as stopped: longer than Desmos takes between reports of a slider
 * being dragged.
 */
const STOPPED_AFTER_MS = 150;
/**
 * How long a solid only sliders move must stand still before it is parked as
 * a fixed solid (`isMovingNow`): past the stop, so a pause in a drag does not
 * switch it back and forth.
 */
const PARK_AFTER_MS = 500;
/** How long a moving solid's translation is averaged over (`smoothedTranslation`). */
const VELOCITY_WINDOW_MS = 100;
/** Samples kept per body: enough for several shedding cycles. */
const SAMPLE_LIMIT = 6000;

/** A row is a candidate when it compares, and is not a definition. */
const COMPARISON = /<|>|\\le|\\ge|\\leq|\\geq/;
/** The name a row defines, as in `C_{D1}=…` or `f(x)=…`. */
const DEFINED_NAME =
  /^([A-Za-z](?:_(?:\{[A-Za-z0-9]*\}|[A-Za-z0-9]))?)(?:\\left\(|\(|=)/;
const DEFINITION =
  /^[A-Za-z](?:_(?:\{[A-Za-z0-9]*\}|[A-Za-z0-9]))?(?:\\left\([^)]*\\right\)|\([^)]*\))?=/;

interface BodyRecord {
  rowId: string;
  region: [number, number, number, number];
  rest: [number, number];
  drag: Sample[];
  lift: Sample[];
}

export class FluidSession {
  private rows: ObstacleRow[] = [];
  private rowsKey = "";
  private capabilitiesResult: SimCapabilities | undefined;
  private readonly valueHelpers = new Map<string, ValueHelper>();
  /** Names whose helper waits for Desmos to finish dispatching. */
  private readonly pendingHelpers = new Set<string>();
  private maskCache:
    | { key: string; mask: Rasterized; nx: number; ny: number }
    | undefined;
  private readonly scheduler: StepScheduler;
  private lastPlan: FramePlan | undefined;
  private frameHandle: number | undefined;
  private lastReadout = 0;
  private lastGeometry = 0;
  private gusting = false;

  private readonly overlay: FluidOverlay;
  private readonly writer: FluidGraphWriter;
  /** The lattice speed in use, which Auto may have lowered. */
  private latticeSpeed: number;
  private latticeKey = "";
  private solidsKey = "";
  private spec: LatticeSpec | undefined;
  private readonly bodies = new Map<number, BodyRecord>();
  /** Steps before which measurements are provisional: start-up, or a resize. */
  private settleUntil = 0;
  private gustWindow: [number, number] = [0, 0];
  private rampSteps = 0;
  /**
   * Where the inflow's eased start was at a step: from rest at step 0, or
   * part way, where Auto slowed the lattice and stretched the rest of it.
   */
  private rampFrom = { step: 0, eased: 0 };
  private peakMach = 0;
  private notice = "";

  constructor(private readonly host: FluidHost) {
    this.latticeSpeed = initialLatticeSpeed(host.config().speedMode);
    this.scheduler = new StepScheduler({
      stepSeconds: this.units.dt,
      maxStepsPerFrame: 64,
    });
    this.writer = new FluidGraphWriter(host.calc);
    this.overlay = new FluidOverlay(host.calc, (message) => {
      this.notice = message;
      if (!this.overlay.isRunning && this.latticeKey !== "") {
        // The lattice is gone, to a lost context or a start that failed.
        // Forget it, so the particles and arrows go back to the field's
        // formula and a restart builds a new one.
        withdrawVelocitySample(FLUID_SAMPLE_SOURCE);
        this.releaseReads();
        this.latticeKey = "";
        this.solidsKey = "";
        this.spec = undefined;
        this.moving = undefined;
        this.movingKey = "";
        this.bodies.clear();
        this.host.simulatingChanged();
      }
      this.host.changed();
    });
  }

  // ---- obstacles -----------------------------------------------------------

  /** The graph's inequality rows, compiled; recompiled only when they change. */
  get obstacleRows(): readonly ObstacleRow[] {
    this.refreshRows();
    return this.rows;
  }

  /**
   * Whether the rows were checked in the frame now running. A frame asks for
   * them a dozen times and each check reads every item in the graph, so the
   * frame loop checks once; nothing it does edits a row it reads. Outside a
   * frame, every question checks afresh.
   */
  private inFrame = false;
  private rowsChecked = false;

  private refreshRows() {
    if (this.inFrame && this.rowsChecked) return;
    this.rowsChecked = true;
    const prefix = this.host.ownedPrefix();
    const degreeMode = this.host.degreeMode();
    const candidates = this.host
      .items()
      .filter(
        (item) =>
          (item.type === undefined || item.type === "expression") &&
          typeof item.latex === "string" &&
          item.id !== undefined &&
          !item.id.startsWith(prefix) &&
          !item.id.startsWith(FluidGraphWriter.prefix) &&
          COMPARISON.test(item.latex) &&
          !DEFINITION.test(item.latex.replace(/\s+/g, ""))
      );
    const env = this.host.environment();
    const key = JSON.stringify([
      degreeMode,
      candidates.map((c) => [c.id, c.latex, c.hidden === true, c.color]),
      [...env.scalars].sort(),
      [...env.functions].map(([name, f]) => [name, f.params, f.latex]),
    ]);
    if (key === this.rowsKey) return;
    this.rowsKey = key;
    this.maskCache = undefined;
    this.rows = candidates.map((item, index) => {
      const result = compileObstacle(
        item.latex!,
        env,
        { degreeMode },
        String(index)
      );
      return {
        id: item.id!,
        latex: item.latex!,
        color: item.color ?? "#2d70b3",
        hidden: item.hidden === true,
        error: result.ok ? undefined : result.error,
        obstacle: result.ok ? result.obstacle : undefined,
      };
    });
  }

  /** The rows the fluid would see as solids: shown, compiled, at most 255. */
  private get solidRows(): ObstacleRow[] {
    return this.obstacleRows
      .filter((row) => !row.hidden && row.obstacle !== undefined)
      .slice(0, 255);
  }

  /**
   * Whether a solid can move: its inequality reads a slider or the clock.
   * Those go through partially saturated cells, which keep every cell's
   * populations as the solid passes; fixed solids keep the sharper
   * interpolated walls.
   */
  isMoving(row: ObstacleRow) {
    const { obstacle } = row;
    return obstacle!.params.length > 0 || obstacle!.usesTime;
  }

  /**
   * Whether a solid is partially saturated cells right now: it can move and
   * is not parked. A solid only a slider moves is parked while the slider is
   * still, as a fixed solid with interpolated walls, which are sharp, keep
   * the fluid out of it, and measure its forces as a fixed solid's are. The
   * partially saturated cells are softer at the wall and fluid inside, and are
   * worth that only while the solid moves (GPT's third round, §B).
   */
  private isMovingNow(row: ObstacleRow) {
    return this.isMoving(row) && !this.parked.has(row.id);
  }

  /** A solid that only sliders move, which can stand still and be parked. */
  private canPark(row: ObstacleRow) {
    return this.isMoving(row) && !row.obstacle!.usesTime;
  }

  /** A row's slider values, which a parked row is drawn at. */
  private paramsOf(row: ObstacleRow) {
    return new Map(
      row.obstacle!.params.map((name) => [name, this.helperValue(name)])
    );
  }

  /**
   * Parked rows by id, with the slider values each was parked at. A row moves
   * again, as partially saturated cells, as soon as one of those changes.
   */
  private readonly parked = new Map<string, Map<string, number>>();
  /** When each moving row's sliders last changed, to know when to park it. */
  private readonly sliderChangedAt = new Map<
    string,
    { key: string; at: number }
  >();

  /**
   * Strict caps Re at 200 while a solid can move (brief §8.1): the partially
   * saturated method has been validated only without the turbulence model,
   * which runs above Re 200. The cap holds while any solid reads a slider or
   * `t`, not only mid-drag, since a change of Re restarts the lattice.
   */
  get reynoldsCapped() {
    const config = this.host.config();
    return (
      config.dragMode === "strict" &&
      config.reynolds > CLOSURE_REYNOLDS &&
      this.solidRows.some((row) => this.isMoving(row))
    );
  }

  /** The Reynolds number the lattice runs at. */
  get reynoldsInUse() {
    const { reynolds } = this.host.config();
    return this.reynoldsCapped ? CLOSURE_REYNOLDS : reynolds;
  }

  /** The compiled obstacles the fluid would see. */
  get activeObstacles(): CompiledObstacle[] {
    return this.solidRows.map((row) => row.obstacle!);
  }

  /** Slider values the obstacles read, from Desmos's own evaluator. */
  private parameterValues(): Map<string, number> {
    const values = new Map<string, number>();
    for (const obstacle of this.activeObstacles) {
      for (const name of obstacle.params) {
        if (!values.has(name)) values.set(name, this.helperValue(name));
      }
    }
    return values;
  }

  /**
   * One named value, through a helper kept for the session.
   *
   * The panel reads values while it draws, which is inside a Desmos dispatch.
   * A helper cannot be made there: the throw used to abort every redraw of the
   * Fluid tab, so the panel never opened again once a solid read a new slider.
   * The value reads as undefined until a helper made just after is ready.
   */
  private helperValue(name: string): number {
    let helper = this.valueHelpers.get(name);
    if (helper === undefined) {
      helper = this.host.helper(name);
      if (helper === undefined) {
        if (!this.pendingHelpers.has(name)) {
          this.pendingHelpers.add(name);
          setTimeout(() => {
            this.pendingHelpers.delete(name);
            this.helperValue(name);
            this.maskCache = undefined;
            this.host.changed();
          });
        }
        return NaN;
      }
      // A slider drag reports here; the frame loop picks the change up on its
      // next geometry check rather than rebuilding on every event.
      helper.observe("numericValue", () => {
        this.maskCache = undefined;
        this.host.changed();
      });
      this.valueHelpers.set(name, helper);
    }
    return helper.numericValue;
  }

  /** The region the lattice covers, in square cells (`fluidLatticeTank`). */
  get latticeTank() {
    return fluidLatticeTank(this.host.config());
  }

  private get simulatedTime() {
    return this.lastPlan?.simulatedSeconds ?? 0;
  }

  /**
   * The tank at lattice resolution: solid, fluid, or undefined in each cell,
   * for the panel's preview. Obstacles that move with `t` are drawn at the
   * simulated time.
   */
  get mask(): { mask: Rasterized; nx: number; ny: number } {
    const config = this.host.config();
    const { nx, ny } = fluidLatticeSize(config);
    const obstacles = this.activeObstacles;
    const params = this.parameterValues();
    const time = obstacles.some((o) => o.usesTime) ? this.simulatedTime : 0;
    const key = JSON.stringify([
      this.rowsKey,
      config.tank,
      nx,
      ny,
      [...params],
      time,
    ]);
    if (this.maskCache?.key === key) return this.maskCache;
    const mask = rasterizeObstacles(
      obstacles,
      { ...this.latticeTank, nx, ny },
      { time, params }
    );
    this.maskCache = { key, mask, nx, ny };
    return this.maskCache;
  }

  // ---- capabilities --------------------------------------------------------

  /** Measured once, on first use, on a context that is then given back. */
  get capabilities(): SimCapabilities {
    this.capabilitiesResult ??= probeWithScratchContext();
    return this.capabilitiesResult;
  }

  // ---- units and the clock -------------------------------------------------

  get units(): LatticeUnits {
    const config = this.host.config();
    return latticeUnits({
      tankWidth: config.tank.xMax - config.tank.xMin,
      cellsAcross: config.cellsAcross,
      inflowSpeed: config.inflowSpeed,
      referenceLength: config.referenceLength,
      reynolds: this.reynoldsInUse,
      latticeSpeed: this.latticeSpeed,
    });
  }

  get readout(): FramePlan {
    return (
      this.lastPlan ?? {
        steps: 0,
        simulatedSeconds: 0,
        totalSteps: 0,
        realTimeFactor: 0,
        behind: false,
      }
    );
  }

  /** The lattice speed now in use, which Auto may have lowered. */
  get currentLatticeSpeed() {
    return this.latticeSpeed;
  }

  /** The highest Mach number seen in the flow at the last check. */
  get mach() {
    return this.peakMach;
  }

  /** Why the measurements could not be written into the graph, if so. */
  get writebackProblem() {
    return this.writer.problem;
  }

  /**
   * Writes the measurements into the graph while the setting asks for it,
   * and takes them out when it stops asking. Leaving the fluid running with
   * writing on keeps them current; switching the fluid off leaves the last
   * values where they are, in case something is built on them.
   */
  private syncWriteback(now: number) {
    const config = this.host.config();
    if (!config.writeback) {
      if (this.writer.isInstalled) this.writer.remove();
      return;
    }
    if (!this.overlay.isRunning) return;
    this.writer.update(this.measurements, this.namesDefinedElsewhere(), now);
  }

  /** Names the graph defines in rows the writer did not put there. */
  private namesDefinedElsewhere(): Set<string> {
    const names = new Set<string>();
    for (const item of this.host.items()) {
      if (typeof item.latex !== "string" || item.id === undefined) continue;
      if (item.id.startsWith(FluidGraphWriter.prefix)) continue;
      const match = DEFINED_NAME.exec(item.latex.replace(/\s+/g, ""));
      if (match) names.add(canonicalIdentifier(match[1]));
    }
    return names;
  }

  /** Something the tab should say: a restart, a slow-down, a failure. */
  get message() {
    return this.notice;
  }

  get isRunning() {
    return this.frameHandle !== undefined;
  }

  get isSimulating() {
    return this.overlay.isRunning;
  }

  /** Whether the measurements are still settling after a start or a resize. */
  get settling() {
    return this.overlay.steps < this.settleUntil;
  }

  /**
   * Starts, rebuilds or stops everything to match the settings and the graph.
   * Called after any change, so that what runs follows from the configuration
   * rather than being remembered separately.
   */
  sync() {
    const config = this.host.config();
    const simulate = config.mode !== "off" && this.capabilities.ready;
    if (config.speedMode !== "auto") {
      this.latticeSpeed = initialLatticeSpeed(config.speedMode);
    }
    this.scheduler.setStepSeconds(this.units.dt);
    if (simulate) this.syncLattice();
    else if (this.overlay.isRunning) this.stopLattice();

    const shouldRun = config.mode !== "off" && config.playing;
    if (shouldRun) this.scheduler.play();
    else this.scheduler.pause();
    if (shouldRun === this.isRunning) return;
    if (shouldRun) {
      this.frameHandle = requestAnimationFrame(this.frame);
    } else {
      if (this.frameHandle !== undefined)
        cancelAnimationFrame(this.frameHandle);
      this.frameHandle = undefined;
      this.drawOnce();
    }
  }

  /** Back to the start: the flow at rest and the clock at zero. */
  restart() {
    this.latticeKey = "";
    this.notice = "";
    const config = this.host.config();
    this.latticeSpeed = initialLatticeSpeed(config.speedMode);
    this.scheduler.reset();
    this.lastPlan = undefined;
    this.maskCache = undefined;
    this.sync();
    this.host.changed();
  }

  dispose() {
    if (this.frameHandle !== undefined) cancelAnimationFrame(this.frameHandle);
    this.frameHandle = undefined;
    this.stopLattice();
  }

  /**
   * A GPU lattice on a context of its own. The verification tests drive the
   * solver through this, because it is the solver the extension ships, in the
   * page it runs in.
   */
  createLattice(options: GpuLatticeOptions) {
    return createStandaloneLattice(options);
  }

  /**
   * One row's samples on the running lattice's GPU and on the CPU, as plain
   * arrays with null for NaN, for the test that holds the one to the other.
   */
  async sampleRowBothWays(
    rowId: string,
    params: Record<string, number>,
    time = 0
  ) {
    const row = this.solidRows.find((r) => r.id === rowId);
    const { sampler } = this.overlay;
    if (!row || !sampler || !this.spec) throw new Error("Nothing to sample.");
    const grid = { nx: this.spec.nx, ny: this.spec.ny, tank: this.latticeTank };
    const scope = { time, params: new Map(Object.entries(params)) };
    const read = sampler.begin(row.obstacle!, grid, scope);
    let gpu: ObstacleSamples | undefined;
    while ((gpu = sampler.finish(read)) === undefined)
      await new Promise((resolve) => requestAnimationFrame(resolve));
    const cpu = sampleObstacle(row.obstacle!, grid, scope);
    const plain = (samples: ObstacleSamples) => ({
      signed: Array.from(samples.signed, (v) => (Number.isNaN(v) ? null : v)),
      gradient: Array.from(samples.gradient, (v) =>
        Number.isNaN(v) ? null : v
      ),
    });
    return { grid, gpu: plain(gpu), cpu: plain(cpu) };
  }

  // ---- the lattice ---------------------------------------------------------

  /**
   * Builds the lattice if what defines it changed, or updates its solids if
   * only they did. Resizing a solid follows the Auto/Strict choice.
   */
  private syncLattice() {
    const config = this.host.config();
    const { units } = this;
    const { nx, ny } = fluidLatticeSize(config);
    const latticeKey = this.latticeKeyFor(nx, ny);
    const restart = latticeKey !== this.latticeKey || !this.overlay.isRunning;
    // A fresh lattice starts with every solid at rest, so every one sliders
    // move is parked; otherwise rows typed or deleted since are reconciled.
    if (restart) {
      this.parked.clear();
      this.moving = undefined;
    }
    this.reconcileParking();
    const solidsKey = this.solidsKeyFor(nx, ny);
    if (!restart) this.syncForceField(nx, ny);
    if (!restart && solidsKey === this.solidsKey) return;
    const solids = this.buildSolids(nx, ny);
    if (restart) {
      this.latticeKey = latticeKey;
      this.solidsKey = solids.key;
      const plan =
        config.mode === "stirredBox" ? this.forcePlan(nx, ny) : undefined;
      this.forceKey = plan?.key ?? "";
      this.forceShape = plan?.build();
      // A quarter of the ceiling to begin with: a box's momentum outlasts any
      // correction, so a gentle start overshoots less than a strong one.
      this.forceAmplitude = 0.25 * this.forceCeiling;
      // Eased in from nothing, like the wind tunnel's inflow.
      this.appliedAmplitude = 0;
      this.lastRegulated = 0;
      this.moving = undefined;
      this.movingKey = "";
      this.movingArea.clear();
      this.lastMoved.clear();
      const request =
        this.movingRows.length > 0 ? this.movingRequest(nx, ny) : undefined;
      const moving =
        request && this.computeMoving(request, this.sampleNow(request), true);
      this.spec = {
        ...this.buildSpec(nx, ny, units, solids, undefined),
        psm: moving?.psm,
      };
      const wasRunning = this.overlay.isRunning;
      this.overlay.start(this.spec);
      if (!wasRunning) this.host.simulatingChanged();
      this.scheduler.reset();
      this.lastPlan = undefined;
      this.beginMeasurements(solids.regions, nx, ny);
      if (moving) this.trackMovingBodies(moving.solids, nx, ny);
      this.uploadForce();
      const pass = units.cellsPerLength / this.latticeSpeed;
      if (config.mode === "windTunnel") {
        // Start-up, then the gust, then a few more passes before anything is
        // called settled.
        this.rampSteps = Math.round(7.5 * pass);
        this.rampFrom = { step: 0, eased: 0 };
        this.gustWindow = [Math.round(7.5 * pass), Math.round(11.5 * pass)];
        this.settleUntil = Math.round(30 * pass);
      } else {
        // A box has no inflow to ease in, and nothing symmetric to tip over.
        this.rampSteps = 0;
        this.rampFrom = { step: 0, eased: 0 };
        this.gustWindow = [0, 0];
        this.settleUntil = Math.round(10 * pass);
      }
      return;
    }
    if (solids.key !== this.solidsKey && this.spec) {
      this.solidsKey = solids.key;
      if (config.resizeMode === "strict") {
        this.latticeKey = "";
        this.syncLattice();
        return;
      }
      this.spec = { ...this.spec, solid: solids.solid, links: solids.links };
      this.overlay.updateSolids(solids.solid, solids.links, this.spec);
      this.beginMeasurements(solids.regions, nx, ny);
      if (this.moving) this.trackMovingBodies(this.moving.solids, nx, ny);
      const pass = units.cellsPerLength / this.latticeSpeed;
      this.settleUntil = this.overlay.steps + Math.round(10 * pass);
    }
  }

  /** What the lattice is built from, cheap to compare. */
  private latticeKeyFor(nx: number, ny: number) {
    const config = this.host.config();
    const { units } = this;
    return JSON.stringify([
      config.mode,
      config.tank,
      nx,
      ny,
      units.tau,
      units.closure,
      this.latticeSpeed,
    ]);
  }

  /**
   * Halves the wind tunnel's lattice speed without starting again: the flow
   * on the lattice is rescaled to the new speed (`GpuD2Q9.rescale`) and runs
   * on, where a restart used to throw it away and start from rest, which
   * looked like the tunnel crashing. Measurements start over, since they were
   * taken at the old speed, and the rest of the eased start and the gust
   * take twice the steps, being the same time. False where it cannot, and
   * the caller restarts as before: the stirred box, whose force the rescale
   * does not carry.
   */
  private slowDownInPlace(speed: number) {
    const lattice = this.overlay.current;
    const config = this.host.config();
    if (!lattice || !this.spec || config.mode !== "windTunnel") return false;
    const scale = speed / this.latticeSpeed;
    this.latticeSpeed = speed;
    const { units } = this;
    const { nx, ny } = this.spec;
    const psm = this.spec.psm && {
      ...this.spec.psm,
      velocity: this.spec.psm.velocity.map((v) => v * scale),
    };
    const spec: LatticeSpec = {
      ...this.buildSpec(nx, ny, units, this.spec, undefined),
      psm,
    };
    this.overlay.rescale(scale, spec);
    this.spec = spec;
    this.latticeKey = this.latticeKeyFor(nx, ny);
    this.scheduler.setStepSeconds(units.dt);
    const step = lattice.steps;
    this.rampFrom = { step, eased: this.easedAt(step) };
    const stretch = (at: number) =>
      at > step ? step + Math.round((at - step) / scale) : at;
    this.rampSteps = stretch(this.rampSteps);
    this.gustWindow = [
      stretch(this.gustWindow[0]),
      stretch(this.gustWindow[1]),
    ];
    // The inlet was just set without the gust; the next step puts it back if
    // the gust is still on.
    this.gusting = false;
    // Reads in flight were taken at the old speed.
    this.releaseReads();
    // A moving wall's speed is in cells a step, and its history with it.
    this.translations.clear();
    for (const record of this.bodies.values()) {
      record.drag = [];
      record.lift = [];
    }
    this.settleUntil =
      step + Math.round((10 * units.cellsPerLength) / this.latticeSpeed);
    return true;
  }

  /** The inflow's eased start at a step, 0 at rest to 1 at full speed. */
  private easedAt(step: number) {
    const { step: from, eased } = this.rampFrom;
    const span = this.rampSteps - from;
    if (span <= 0 || step >= this.rampSteps) return 1;
    const t = Math.min(1, Math.max(0, (step - from) / span));
    // Smoothstep from where it was, so a stretch part way does not jump.
    return eased + (1 - eased) * t * t * (3 - 2 * t);
  }

  private stopLattice() {
    const wasRunning = this.overlay.isRunning;
    this.releaseReads();
    this.overlay.stop();
    withdrawVelocitySample(FLUID_SAMPLE_SOURCE);
    if (wasRunning) this.host.simulatingChanged();
    this.latticeKey = "";
    this.solidsKey = "";
    this.forceKey = "";
    this.forceShape = undefined;
    this.moving = undefined;
    this.movingKey = "";
    this.spec = undefined;
    this.bodies.clear();
  }

  /** Body numbers per cell, link fractions, and each body's bounding box. */
  private buildSolids(nx: number, ny: number) {
    const tank = this.latticeTank;
    const dx = (tank.xMax - tank.xMin) / nx;
    const dy = (tank.yMax - tank.yMin) / ny;
    const rows = this.solidRows;
    const params = this.parameterValues();
    const time = rows.some((r) => r.obstacle!.usesTime)
      ? this.simulatedTime
      : 0;
    const scope = { time, params };
    const centre = (i: number, j: number) =>
      [tank.xMin + (i + 0.5) * dx, tank.yMin + (j + 0.5) * dy] as const;
    // Moving solids are partially saturated cells, not mask cells; a parked
    // one is a mask cell, at the slider values it was parked at.
    const fixed = rows.map((row) => !this.isMovingNow(row));
    const scopes = rows.map((row) => {
      const at = this.parked.get(row.id);
      if (at === undefined) return scope;
      const merged = new Map(params);
      for (const [name, value] of at) merged.set(name, value);
      return { time, params: merged };
    });
    const points = scopes.map((at) => ({ ...at, x: 0, y: 0 }));
    const solid = new Uint8Array(nx * ny);
    const boxes = rows.map(() => [Infinity, Infinity, -Infinity, -Infinity]);
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const [x, y] = centre(i, j);
        for (let b = 0; b < rows.length; b++) {
          if (!fixed[b]) continue;
          const point = points[b];
          point.x = x;
          point.y = y;
          if (!rows[b].obstacle!.contains(point)) continue;
          solid[j * nx + i] = b + 1;
          const box = boxes[b];
          box[0] = Math.min(box[0], i);
          box[1] = Math.min(box[1], j);
          box[2] = Math.max(box[2], i);
          box[3] = Math.max(box[3], j);
          break;
        }
      }
    }
    const links = computeLinks({ nx, ny, centre }, solid, (body) => {
      // One point, reused: a spread per evaluation was most of the cost.
      const point = { ...scopes[body - 1], x: 0, y: 0 };
      const { obstacle } = rows[body - 1];
      return (x, y) => {
        point.x = x;
        point.y = y;
        return obstacle!.signed(point);
      };
    });
    const regions = new Map<number, { rowId: string; box: number[] }>();
    rows.forEach((row, b) => {
      if (boxes[b][0] <= boxes[b][2]) {
        regions.set(b + 1, { rowId: row.id, box: boxes[b] });
      }
    });
    return {
      solid,
      links: links.q,
      regions,
      key: this.solidsKeyFor(nx, ny),
    };
  }

  /**
   * What the solids depend on, cheap to compare: the rows, their sliders, the
   * clock if any of them reads it, and the tank.
   */
  private solidsKeyFor(nx: number, ny: number) {
    // Fixed solids read no slider and no clock (`isMoving`), so their mask
    // changes only with the rows themselves and the grid. A moving one is
    // followed by `syncMoving` without rebuilding the mask, and a parked one
    // is drawn at the values it was parked at, which `syncMoving` changes.
    const { tank } = this.host.config();
    const parked = [...this.parked]
      .map(([id, at]) => [id, [...at]] as const)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return JSON.stringify([this.rowsKey, nx, ny, tank, parked]);
  }

  private buildSpec(
    nx: number,
    ny: number,
    units: LatticeUnits,
    solids: { solid: Uint8Array; links: Float32Array },
    forceField: Float32Array | undefined
  ): LatticeSpec {
    const u = this.latticeSpeed;
    if (this.host.config().mode === "stirredBox") {
      return {
        nx,
        ny,
        tau: units.tau,
        smagorinsky: units.closure ? SMAGORINSKY_C : 0,
        // A closed box: no-slip walls all round, so the fluid the field
        // pushes has nowhere to go but round.
        boundaries: {
          left: { kind: "noSlip" },
          right: { kind: "noSlip" },
          bottom: { kind: "noSlip" },
          top: { kind: "noSlip" },
        },
        solid: solids.solid,
        links: solids.links,
        inletUx: new Array<number>(ny).fill(0),
        inletUy: new Array<number>(ny).fill(0),
        sponge: undefined,
        initial: [0, 0],
        forceField,
        psm: undefined,
      };
    }
    return {
      nx,
      ny,
      tau: units.tau,
      smagorinsky: units.closure ? SMAGORINSKY_C : 0,
      // A wind tunnel: the inflow on the left, an outlet on the right that
      // lets the wake out, and slip walls above and below that neither drag
      // the stream nor grow boundary layers of their own.
      boundaries: {
        left: { kind: "velocity", regularize: true },
        right: { kind: "pressure", deltaRho: 0, regularize: true },
        bottom: { kind: "slip" },
        top: { kind: "slip" },
      },
      solid: solids.solid,
      links: solids.links,
      inletUx: new Array<number>(ny).fill(u),
      inletUy: new Array<number>(ny).fill(0),
      sponge: {
        width: Math.min(32, Math.round(nx / 8)),
        max: 0.12,
        reference: [u, 0],
      },
      // Sound leaves through the inlet rather than ringing between it and
      // the outlet (`absorbingInflow`); the mean pressure there follows over
      // about 2000 steps, a couple of the tunnel's round trips.
      absorbingInlet: 1 / 2000,
      initial: [0, 0],
      forceField: undefined,
      psm: undefined,
    };
  }

  // ---- the stirred box's force --------------------------------------------

  /** Cells where the field is undefined, and so pushes nothing. */
  private undefinedForce = 0;
  private forceKey = "";

  /** How many cells the field could not be evaluated at, for the panel. */
  get undefinedForceCells() {
    return this.undefinedForce;
  }

  /**
   * The field's P and Q as the shape of a force on every cell, normalised so
   * its strongest push is 1. Its strength is `forceAmplitude`, regulated by
   * `regulateForce`. A gradient field's P and Q are its f's partial
   * derivatives, taken here by central differences. Where the field is
   * undefined it pushes nothing, and the cells are counted rather than
   * guessed.
   *
   * Returns the key first and the field only on demand: compiling P and Q is
   * cheap and tells which sliders and whether the clock they read, so a check
   * every few frames costs a parse, and evaluating every cell happens only
   * when something they read has changed.
   */
  private forcePlan(nx: number, ny: number) {
    const config = this.host.config();
    const description = this.host.field();
    const env = this.host.environment();
    const degreeMode = this.host.degreeMode();
    const compile = (latex: string) => {
      const parsed = parseStrictExpression(latex, env);
      if (!parsed.ok) return undefined;
      return {
        program: parsed.program,
        evaluate: compileExpression(parsed.expr, parsed.program, {
          degreeMode,
        }),
      };
    };
    const gradient = description.source === "gradient";
    const parts = gradient
      ? [compile(description.fLatex)]
      : [compile(description.xLatex), compile(description.yLatex)];
    const params = new Map<string, number>();
    let usesTime = false;
    for (const part of parts) {
      if (!part) continue;
      usesTime ||= part.program.usesTime;
      for (const name of part.program.params)
        params.set(name, this.helperValue(name));
    }
    const time = usesTime ? this.simulatedTime : 0;
    const tank = this.latticeTank;
    const { dt } = this.units;
    const key = JSON.stringify([
      description,
      degreeMode,
      [...params],
      time,
      nx,
      ny,
      tank,
      dt,
      config.inflowSpeed,
      config.referenceLength,
    ]);
    const build = () => {
      const dx = (tank.xMax - tank.xMin) / nx;
      const dy = (tank.yMax - tank.yMin) / ny;
      const field = new Float32Array(2 * nx * ny);
      let strongest = 0;
      let undefinedCount = 0;
      const at = (part: (typeof parts)[number], x: number, y: number) =>
        part ? part.evaluate({ x, y, time, params }, []) : NaN;
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          const x = tank.xMin + (i + 0.5) * dx;
          const y = tank.yMin + (j + 0.5) * dy;
          let p: number;
          let q: number;
          if (gradient) {
            const h = 1e-4 * Math.max(1, Math.abs(x), Math.abs(y));
            p = (at(parts[0], x + h, y) - at(parts[0], x - h, y)) / (2 * h);
            q = (at(parts[0], x, y + h) - at(parts[0], x, y - h)) / (2 * h);
          } else {
            p = at(parts[0], x, y);
            q = at(parts[1], x, y);
          }
          const k = j * nx + i;
          if (Number.isFinite(p) && Number.isFinite(q)) {
            field[2 * k] = p;
            field[2 * k + 1] = q;
            strongest = Math.max(strongest, Math.hypot(p, q));
          } else {
            undefinedCount++;
          }
        }
      }
      const scale = strongest > 0 ? 1 / strongest : 0;
      for (let k = 0; k < field.length; k++) field[k] *= scale;
      this.undefinedForce = undefinedCount;
      return field;
    };
    return { key, build };
  }

  /** Rebuilds the force field if the field, a slider or the clock moved it. */
  private syncForceField(nx: number, ny: number) {
    if (this.host.config().mode !== "stirredBox" || !this.spec) return;
    const plan = this.forcePlan(nx, ny);
    if (plan.key === this.forceKey) return;
    this.forceKey = plan.key;
    this.forceShape = plan.build();
    this.uploadForce();
  }

  /** The stirring force's shape, strongest push 1, `2k` and `2k + 1`. */
  private forceShape: Float32Array | undefined;
  /** The strength the regulator wants, in lattice units of force density. */
  private forceAmplitude = 0;
  /** The strength applied now, easing toward `forceAmplitude`. */
  private appliedAmplitude = 0;
  /** The step the strength was last regulated at. */
  private lastRegulated = 0;

  /**
   * The shape onto the running lattice, once per shape; its strength is the
   * lattice's `forceScale`, eased every frame (`easeForce`).
   */
  private uploadForce() {
    const shape = this.forceShape;
    if (!shape || !this.spec) return;
    this.spec = { ...this.spec, forceField: shape };
    this.overlay.updateForceField(shape);
  }

  /**
   * Moves the applied strength toward the regulator's over `steps` steps,
   * with a time constant of `FORCE_EASING_SECONDS` of flow. Changed in one
   * jump, each correction struck the closed box like a piston and set it
   * ringing; the ringing is most of what a gradient field, which pressure
   * should answer completely, appears to move.
   */
  private easeForce(steps: number) {
    const lattice = this.overlay.current;
    if (!lattice || !this.forceShape) return;
    const k = 1 - Math.exp(-(steps * this.units.dt) / FORCE_EASING_SECONDS);
    this.appliedAmplitude += (this.forceAmplitude - this.appliedAmplitude) * k;
    lattice.forceScale = this.appliedAmplitude;
  }

  /**
   * The ceiling on the stirring strength: U²/L in lattice units, the push
   * that drives a flow of speed U across the length L where inertia limits
   * it.
   */
  private get forceCeiling() {
    const u = this.latticeSpeed;
    return (u * u) / Math.max(1, this.units.cellsPerLength);
  }

  /**
   * Keeps a stirred flow near the typical speed. A push shaped like a
   * rotation is one the fluid can follow by spinning faster, so inertia never
   * limits it and only the walls' viscosity does: taken at a fixed strength,
   * the default field (−y, x) spun the box past Mach 0.8. So the strength
   * starts at the inertial estimate, never exceeds it, and eases down when
   * the flow's fastest point passes the typical speed and back up when it
   * falls well below. It begins at a quarter of that, since a box's momentum
   * outlasts every correction and a gentle start overshoots less. The push
   * keeps the field's shape throughout, and a gradient field, which pressure
   * answers whatever its strength, still barely moves the fluid at the
   * ceiling.
   *
   * It acts every `REGULATE_SECONDS` of flow, not of wall clock, so that a
   * slower computer, which runs fewer steps a second, regulates the same
   * flow the same way.
   */
  private regulateForce(peakSpeed: number) {
    if (this.host.config().mode !== "stirredBox" || !this.forceShape) return;
    const step = this.overlay.steps;
    if (step - this.lastRegulated < REGULATE_SECONDS / this.units.dt) return;
    this.lastRegulated = step;
    // Aimed at 70% of the typical speed, because the box's momentum carries
    // the flow past whatever the push settles at: aimed at the full speed it
    // overshot to Mach 0.32 and made Auto restart.
    const target = 0.7 * this.latticeSpeed;
    const ceiling = this.forceCeiling;
    let next = this.forceAmplitude;
    if (peakSpeed > target) next *= Math.max(0.5, target / peakSpeed);
    else if (peakSpeed < 0.7 * target) next = Math.min(ceiling, next * 1.25);
    this.forceAmplitude = next;
  }

  // ---- moving solids --------------------------------------------------------

  /**
   * The last coverage computed, the step it was for, and which row each of
   * its signed functions belongs to. Everything about a moving solid is kept
   * by row id, not body number: a body's number is its place in the list, and
   * deleting a row above it renumbers it, which would compare one solid's
   * wall with another's.
   */
  private moving:
    | {
        solids: PartialSolids;
        step: number;
        rowIds: string[];
        request: MovingRequest;
        samples: MovingSamples;
      }
    | undefined;
  private movingKey = "";
  /** Each moving row's area when last accepted, to tell a resize from a move. */
  private readonly movingArea = new Map<string, number>();
  /** The step each moving row last moved at. */
  private readonly lastMoved = new Map<string, number>();

  /** The moving rows, with the body number each reports under. */
  private get movingRows() {
    return this.solidRows
      .map((row, b) => ({ row, body: b + 1 }))
      .filter(({ row }) => this.isMovingNow(row));
  }

  /** What the moving solids depend on: their rows, sliders and the clock. */
  private movingKeyFor(nx: number, ny: number) {
    const params: [string, number][] = [];
    let time = 0;
    for (const { row } of this.movingRows) {
      for (const name of row.obstacle!.params)
        params.push([name, this.helperValue(name)]);
      if (row.obstacle!.usesTime) time = this.simulatedTime;
    }
    return JSON.stringify([
      this.rowsKey,
      params,
      time,
      nx,
      ny,
      this.host.config().tank,
    ]);
  }

  /**
   * Each moving row's recent translations, `[time, steps, ux·steps,
   * uy·steps]`, for the average over `VELOCITY_WINDOW_MS`.
   */
  private readonly translations = new Map<string, number[][]>();

  /**
   * A row's translation averaged over the last `VELOCITY_WINDOW_MS`, weighted
   * by steps. Desmos stamps a slider's value when it is set and the tab sees
   * it a frame or two later, unevenly, so one update's displacement over its
   * own steps scatters by ±40% while the slider moves steadily; the window
   * averages that out, and still follows a stop within it.
   */
  private smoothedTranslation(
    rowId: string,
    raw: readonly [number, number],
    steps: number,
    now: number
  ): readonly [number, number] {
    const history = this.translations.get(rowId) ?? [];
    history.push([now, steps, raw[0] * steps, raw[1] * steps]);
    while (history.length > 1 && history[0][0] < now - VELOCITY_WINDOW_MS)
      history.shift();
    this.translations.set(rowId, history);
    let total = 0;
    let x = 0;
    let y = 0;
    for (const [, s, dx, dy] of history) {
      total += s;
      x += dx;
      y += dy;
    }
    return total > 0 ? [x / total, y / total] : [0, 0];
  }

  /** Rows unparked this frame, with the slider values they were parked at. */
  private readonly unparkedFrom = new Map<string, Map<string, number>>();
  /** The lattice's step count at the start of the last frame. */
  private frameStep = 0;

  /** Parks rows that sliders move and that are new since the last check. */
  private reconcileParking() {
    const rows = this.solidRows;
    for (const id of [...this.parked.keys()]) {
      const row = rows.find((r) => r.id === id);
      if (row === undefined || !this.canPark(row)) this.parked.delete(id);
    }
    const moving = new Set(this.moving?.rowIds ?? []);
    for (const row of rows) {
      if (!this.canPark(row) || this.parked.has(row.id) || moving.has(row.id))
        continue;
      this.parked.set(row.id, this.paramsOf(row));
    }
  }

  /**
   * Unparks a row whose sliders moved, and parks one whose sliders have been
   * still for `PARK_AFTER_MS`. True if either happened, when the mask has to
   * be rebuilt.
   */
  private updateParking(now: number) {
    let changed = false;
    for (const row of this.solidRows) {
      if (!this.canPark(row)) continue;
      const params = this.paramsOf(row);
      const key = JSON.stringify([...params]);
      const at = this.parked.get(row.id);
      if (at !== undefined) {
        if (key === JSON.stringify([...at])) continue;
        this.parked.delete(row.id);
        this.unparkedFrom.set(row.id, at);
        this.sliderChangedAt.set(row.id, { key, at: now });
        changed = true;
        continue;
      }
      const seen = this.sliderChangedAt.get(row.id);
      if (seen === undefined || seen.key !== key) {
        this.sliderChangedAt.set(row.id, { key, at: now });
      } else if (now - seen.at >= PARK_AFTER_MS) {
        this.parked.set(row.id, params);
        changed = true;
      }
    }
    return changed;
  }

  /**
   * The mask and links again, after a row was parked or unparked. Every
   * cell keeps its populations: a parked solid's inside is the fluid that
   * moved with it, held as it was, and is where it resumes.
   */
  private applySolids() {
    if (!this.spec) return;
    const { nx, ny } = this.spec;
    const solids = this.buildSolids(nx, ny);
    this.solidsKey = solids.key;
    this.spec = { ...this.spec, solid: solids.solid, links: solids.links };
    this.overlay.updateSolids(solids.solid, solids.links, this.spec);
    this.maskCache = undefined;
    this.beginMeasurements(solids.regions, nx, ny);
  }

  /**
   * What the moving solids are to be sampled at now: each moving row's
   * slider values and time, and, for a row just unparked, the values it was
   * parked at, so the move that unparked it already gives its walls their
   * speed.
   */
  private movingRequest(nx: number, ny: number): MovingRequest {
    const rows = this.movingRows;
    const params = this.parameterValues();
    const time = rows.some(({ row }) => row.obstacle!.usesTime)
      ? this.simulatedTime
      : 0;
    const seeds = rows.map(({ row }) => {
      const from = this.unparkedFrom.get(row.id);
      if (from === undefined) return undefined;
      const merged = new Map(params);
      for (const [name, value] of from) merged.set(name, value);
      return { time, params: merged };
    });
    this.unparkedFrom.clear();
    return {
      rows,
      scope: { time, params },
      seeds,
      time: performance.now(),
      step: this.overlay.steps,
      sinceFrame: this.overlay.steps - this.frameStep,
      key: this.movingKeyFor(nx, ny),
      grid: { nx, ny, tank: this.latticeTank },
    };
  }

  /** A request's samples taken on the CPU, at once. */
  private sampleNow(request: MovingRequest): MovingSamples {
    return {
      rows: request.rows.map(({ row }) =>
        sampleObstacle(row.obstacle!, request.grid, request.scope)
      ),
      seeds: request.seeds.map((scope, r) =>
        scope === undefined
          ? undefined
          : sampleObstacle(request.rows[r].row.obstacle!, request.grid, scope)
      ),
    };
  }

  /**
   * Coverage and wall velocity for the moving solids, from their samples.
   * The velocity is how far each wall moved since the last update, over the
   * steps between, with each solid's translation averaged over the last few
   * updates.
   */
  private computeMoving(
    request: MovingRequest,
    samples: MovingSamples,
    fresh = false
  ): MovingCells {
    const { rows, time } = request;
    const rowIds = rows.map(({ row }) => row.id);
    // Each row's last signed function, found by its id. A row new since then
    // starts at rest, unless it was just unparked; so does every row on a
    // fresh start.
    const last = fresh ? undefined : this.moving;
    if (fresh) this.translations.clear();
    const previousSigned = fresh
      ? undefined
      : rows.map(({ row }, r) => {
          const index = last ? last.rowIds.indexOf(row.id) : -1;
          if (index >= 0) return last!.solids.signed[index];
          return samples.seeds[r]?.signed;
        });
    const elapsed = last ? request.step - last.step : request.sinceFrame;
    const rowOf = new Map(rows.map(({ row, body }) => [body, row.id]));
    const solids = partialSolidsFromSamples(
      rows.map(({ body }, r) => ({ body, samples: samples.rows[r] })),
      request.grid,
      previousSigned?.some((signed) => signed !== undefined)
        ? { signed: previousSigned, elapsedSteps: elapsed }
        : undefined,
      (body, raw, steps) =>
        this.smoothedTranslation(rowOf.get(body) ?? "", raw, steps, time)
    );
    this.moving = { solids, step: request.step, rowIds, request, samples };
    this.movingKey = request.key;
    return {
      solids,
      psm: {
        coverage: solids.coverage,
        velocity: solids.velocity,
        body: solids.body,
      },
    };
  }

  /** When a moving solid's sliders or clock last changed, in milliseconds. */
  private movingChangedAt = 0;
  /** What the moving solids were last seen to depend on (`movingKeyFor`). */
  private seenKey = "";
  /** What was last said about a solid moving too fast, while it was. */
  private wallNotice = "";
  /** Samples the GPU has been asked for and has not yet returned. */
  private samplesInFlight:
    | {
        sampler: ObstacleSampler;
        request: MovingRequest;
        rows: { read: PendingSample; taken?: ObstacleSamples }[];
        seeds: ({ read: PendingSample; taken?: ObstacleSamples } | undefined)[];
      }
    | undefined;

  /** Lets go of samples in flight, as a new lattice or new rows do. */
  private cancelSamples() {
    const flight = this.samplesInFlight;
    if (flight === undefined) return;
    this.samplesInFlight = undefined;
    if (flight.sampler !== this.overlay.sampler) return;
    for (const entry of [...flight.rows, ...flight.seeds]) {
      if (entry !== undefined && entry.taken === undefined)
        flight.sampler.cancel(entry.read);
    }
  }

  /**
   * The samples in flight, once the GPU has taken all of them; undefined
   * while it has not, or if the rows they were asked for have changed since.
   */
  private collectSamples(): MovingSamples | undefined {
    const flight = this.samplesInFlight!;
    const ids = this.movingRows.map(({ row }) => row.id).join("\n");
    const asked = flight.request.rows.map(({ row }) => row.id).join("\n");
    if (flight.sampler !== this.overlay.sampler || ids !== asked) {
      this.cancelSamples();
      return undefined;
    }
    let ready = true;
    for (const entry of [...flight.rows, ...flight.seeds]) {
      if (entry === undefined || entry.taken !== undefined) continue;
      entry.taken = flight.sampler.finish(entry.read);
      if (entry.taken === undefined) ready = false;
    }
    if (!ready) return undefined;
    this.samplesInFlight = undefined;
    return {
      rows: flight.rows.map((entry) => entry.taken!),
      seeds: flight.seeds.map((entry) => entry?.taken),
    };
  }

  /**
   * Follows the moving solids, every frame. Each wall's velocity is how far
   * it moved between two changes of what moves it, over the steps between.
   * A solid counts as stopped, and its walls are set back to rest, only once
   * nothing has changed for `STOPPED_AFTER_MS`: Desmos reports a dragged
   * slider every frame or two, not every frame, and treating each quiet frame
   * as a stop made the walls alternate between rest and twice their speed. A
   * change in a solid's area is a resize, not a move: Auto keeps going and
   * marks the flow as settling, Strict restarts (brief §8.1).
   *
   * The solids are sampled on the GPU where there is one (`obstacleSampler`),
   * and the cells built from the samples when they come back, a frame later;
   * meanwhile the walls keep the velocity they had.
   */
  private syncMoving(now: number) {
    if (!this.spec) return;
    if (this.updateParking(now)) this.applySolids();
    if (this.movingRows.length === 0) {
      // The last moving solid was parked, deleted, or no longer reads a
      // slider.
      this.cancelSamples();
      if (this.moving !== undefined) {
        this.moving = undefined;
        this.movingKey = "";
        this.spec = { ...this.spec, psm: undefined };
        this.overlay.updatePartialSolids(undefined);
      }
      return;
    }
    const { nx, ny } = this.spec;
    const key = this.movingKeyFor(nx, ny);
    // Every change seen counts for the stop rule, samples in flight or not:
    // a readback can take several frames while the GPU is busy, and a drag
    // that went on meanwhile is not a stop.
    if (key !== this.seenKey) {
      this.seenKey = key;
      this.movingChangedAt = now;
    }
    const flight = this.samplesInFlight;
    if (flight !== undefined) {
      const samples = this.collectSamples();
      if (samples !== undefined) {
        this.acceptMoving(this.computeMoving(flight.request, samples));
      } else if (this.samplesInFlight !== undefined) {
        // Not taken yet; the walls keep their velocity meanwhile.
        return;
      }
      // Otherwise the rows changed while it was in flight: ask again below.
    }
    if (key === this.movingKey) {
      const hadVelocity = this.moving?.solids.moving ?? false;
      if (!hadVelocity) {
        // At rest and unchanged, the last coverage is still the solid as it
        // is now, so the first move after a rest is measured over the steps
        // since this frame, not since the solid last stopped.
        if (this.moving) this.moving.step = this.overlay.steps;
        return;
      }
      if (now - this.movingChangedAt < STOPPED_AFTER_MS) return;
      // Stopped: the same samples again, so every wall comes to rest.
      const last = this.moving!;
      this.acceptMoving(
        this.computeMoving(
          { ...last.request, step: this.overlay.steps, time: now },
          last.samples
        )
      );
      return;
    }
    const request = this.movingRequest(nx, ny);
    const sampler = this.gpuSamplingFailed ? undefined : this.overlay.sampler;
    if (sampler !== undefined) {
      const reads: PendingSample[] = [];
      const begin = (scope: MovingRequest["scope"], r: number) => {
        const read = sampler.begin(
          request.rows[r].row.obstacle!,
          request.grid,
          scope
        );
        reads.push(read);
        return { read };
      };
      try {
        this.samplesInFlight = {
          sampler,
          request,
          rows: request.rows.map((_, r) => begin(request.scope, r)),
          seeds: request.seeds.map((scope, r) =>
            scope === undefined ? undefined : begin(scope, r)
          ),
        };
        return;
      } catch {
        // A GPU that will not compile some row's GLSL: sample on the CPU for
        // the rest of the session rather than stop the fluid, which is what
        // an error in the frame loop does.
        for (const read of reads) sampler.cancel(read);
        this.gpuSamplingFailed = true;
      }
    }
    this.acceptMoving(this.computeMoving(request, this.sampleNow(request)));
  }

  /** Whether the GPU sampler failed once, and the CPU samples from here on. */
  private gpuSamplingFailed = false;

  /** Puts newly built moving cells into the lattice, with what follows. */
  private acceptMoving(moving: MovingCells) {
    if (!this.spec) return;
    const { nx, ny } = this.spec;
    const step = this.overlay.steps;
    const config = this.host.config();
    const pass = this.units.cellsPerLength / this.latticeSpeed;
    const rowOf = new Map(
      this.movingRows.map(({ row, body }) => [body, row.id] as const)
    );
    for (const [body, area] of moving.solids.area) {
      const rowId = rowOf.get(body);
      if (rowId === undefined) continue;
      const before = this.movingArea.get(rowId);
      if (moving.solids.moved.has(body)) this.lastMoved.set(rowId, step);
      if (before === undefined) {
        this.movingArea.set(rowId, area);
        continue;
      }
      if (Math.abs(area - before) <= 0.02 * before) continue;
      // GPT's third round measured that neither moving-solid method keeps
      // volume as a solid grows; a resize is visual until the flow settles.
      if (config.resizeMode === "strict") {
        this.latticeKey = "";
        this.syncLattice();
        return;
      }
      this.movingArea.set(rowId, area);
      this.settleUntil = step + Math.round(10 * pass);
    }
    // Said while it is so, like the speed limit: a single fast frame, such as
    // the first after a stall, used to leave this up for the rest of the run.
    let wallNotice = "";
    if (moving.solids.teleported) {
      wallNotice =
        "A solid jumped too far in one frame to push the fluid aside, so it was placed there without a wall velocity.";
    } else if (moving.solids.fastest > WALL_SPEED_LIMIT) {
      wallNotice = `A solid moved at ${moving.solids.fastest.toFixed(2)} cells a step, faster than the fluid can follow, so its walls were slowed to ${WALL_SPEED_LIMIT}.`;
    }
    if (wallNotice !== "") this.notice = wallNotice;
    else if (this.notice === this.wallNotice) this.notice = "";
    this.wallNotice = wallNotice;
    this.spec = { ...this.spec, psm: moving.psm };
    this.overlay.updatePartialSolids(moving.psm);
    this.trackMovingBodies(moving.solids, nx, ny);
  }

  /** Keeps each moving body's force region on it as it moves. */
  private trackMovingBodies(solids: PartialSolids, nx: number, ny: number) {
    const rowIds = new Map(
      this.movingRows.map(({ row, body }) => [body, row.id])
    );
    for (const [body, box] of solids.boxes) {
      const margin = 2;
      const x0 = Math.max(0, box[0] - margin);
      const y0 = Math.max(0, box[1] - margin);
      const x1 = Math.min(nx - 1, box[2] + margin);
      const y1 = Math.min(ny - 1, box[3] + margin);
      const region: [number, number, number, number] = [
        x0,
        y0,
        x1 - x0 + 1,
        y1 - y0 + 1,
      ];
      const record = this.bodies.get(body);
      if (record) record.region = region;
      else {
        this.bodies.set(body, {
          rowId: rowIds.get(body) ?? "",
          region,
          // Partially saturated cells carry no rest-state share: their
          // exchange is already a full population difference.
          rest: [0, 0],
          drag: [],
          lift: [],
        });
      }
    }
  }

  private beginMeasurements(
    regions: Map<number, { rowId: string; box: number[] }>,
    nx: number,
    ny: number
  ) {
    // Reads in flight were asked of the old bodies, whose numbers the new
    // ones may reuse.
    if (this.reads) {
      for (const read of this.reads.forces.values())
        this.reads.lattice.cancelRead(read);
      this.reads.forces.clear();
    }
    this.bodies.clear();
    const solid = this.spec?.solid;
    if (!solid) return;
    for (const [body, { rowId, box }] of regions) {
      const margin = 2;
      const x0 = Math.max(0, box[0] - margin);
      const y0 = Math.max(0, box[1] - margin);
      const x1 = Math.min(nx - 1, box[2] + margin);
      const y1 = Math.min(ny - 1, box[3] + margin);
      const rest = restShare(body, solid, { nx, ny }, box);
      this.bodies.set(body, {
        rowId,
        region: [x0, y0, x1 - x0 + 1, y1 - y0 + 1],
        rest,
        drag: [],
        lift: [],
      });
    }
  }

  /** Each solid's drag, lift and shedding, as coefficients. */
  get measurements(): BodyMeasurement[] {
    const { units } = this;
    const norm = 0.5 * this.latticeSpeed ** 2 * units.cellsPerLength;
    const settled = !this.settling;
    const out: BodyMeasurement[] = [];
    for (const record of this.bodies.values()) {
      const after = (s: Sample) => s.step >= this.settleUntil;
      const drag = record.drag.filter(after);
      const lift = record.lift.filter(after);
      const recent = (samples: Sample[]) => {
        const window = samples.slice(-Math.min(samples.length, 400));
        return window.length === 0
          ? NaN
          : window.reduce((s, v) => s + v.value, 0) / window.length;
      };
      let dragValue = recent(drag.length ? drag : record.drag.slice(-50));
      let liftValue = recent(lift.length ? lift : record.lift.slice(-50));
      let strouhal: number | undefined;
      const movedAt = this.lastMoved.get(record.rowId);
      const stillMoving =
        movedAt !== undefined &&
        this.overlay.steps - movedAt <
          Math.round((10 * units.cellsPerLength) / this.latticeSpeed);
      let sheddingNote = settled ? "" : "Settling after the start.";
      if (stillMoving) {
        // Above Re 200 the moving-solid method runs with the turbulence model,
        // which it was not validated with: no force numbers at all (§8.1).
        const unvalidated = units.closure;
        out.push({
          rowId: record.rowId,
          drag: unvalidated ? NaN : recent(record.drag.slice(-50)) / norm,
          lift: unvalidated ? NaN : recent(record.lift.slice(-50)) / norm,
          strouhal: undefined,
          sheddingNote: unvalidated
            ? "It is moving above Re 200, where moving solids are not validated, so its forces are not measured."
            : "It is moving, so its forces are provisional: they include the fluid carried inside it.",
          settled: false,
        });
        continue;
      }
      if (settled && lift.length > 0) {
        const shedding = sheddingPeriod(
          lift.map((s) => ({ step: s.step, value: s.value / norm }))
        );
        if ("period" in shedding) {
          strouhal =
            units.cellsPerLength / (this.latticeSpeed * shedding.period);
          dragValue = lastCycle(drag, shedding.crossings).mean;
          liftValue = lastCycle(lift, shedding.crossings).mean;
        } else {
          sheddingNote = shedding.reason;
        }
      }
      out.push({
        rowId: record.rowId,
        drag: dragValue / norm,
        lift: liftValue / norm,
        strouhal,
        sheddingNote,
        settled,
      });
    }
    return out;
  }

  // ---- the frame loop ------------------------------------------------------

  private readonly frame = (now: number) => {
    this.frameHandle = requestAnimationFrame(this.frame);
    this.inFrame = true;
    this.rowsChecked = false;
    try {
      this.runFrame(now);
    } finally {
      this.inFrame = false;
    }
  };

  private runFrame(now: number) {
    this.lastPlan = this.scheduler.frame(now);
    const lattice = this.overlay.current;
    if (lattice) {
      const frameStart = lattice.steps;
      try {
        this.syncMoving(now);
        this.easeForce(this.lastPlan.steps);
        this.advance(this.lastPlan.steps);
        this.collectReads(lattice, now, this.lastPlan.steps > 0);
        // A row unparked next frame moved during this one's steps.
        this.frameStep = frameStart;
      } catch (error) {
        this.notice =
          error instanceof Error ? error.message : "The fluid stopped.";
        this.stopLattice();
      }
      this.drawOnce();
    }
    if (
      this.overlay.isRunning &&
      now - this.lastGeometry >= GEOMETRY_INTERVAL_MS
    ) {
      this.lastGeometry = now;
      this.syncLattice();
    }
    this.syncWriteback(now);
    if (now - this.lastReadout >= READOUT_INTERVAL_MS) {
      this.lastReadout = now;
      if (this.activeObstacles.some((o) => o.usesTime))
        this.maskCache = undefined;
      this.host.changed();
    }
  }

  /** Runs `count` steps, with the eased start and the gust while they last. */
  private advance(count: number) {
    const lattice = this.overlay.current;
    if (!lattice || count === 0) return;
    const [gustStart, gustEnd] = this.gustWindow;
    let remaining = count;
    while (remaining > 0) {
      const step = lattice.steps;
      if (step >= gustEnd && step >= this.rampSteps) {
        if (lattice.inletScale !== 1) lattice.inletScale = 1;
        lattice.step(remaining);
        return;
      }
      lattice.inletScale = this.easedAt(step);
      const gusting = step >= gustStart && step < gustEnd;
      if (gusting !== this.gusting) {
        this.gusting = gusting;
        const { ny } = lattice;
        lattice.setInlet(
          new Array<number>(ny).fill(this.latticeSpeed),
          new Array<number>(ny).fill(gusting ? 0.15 * this.latticeSpeed : 0)
        );
      }
      lattice.step(1);
      remaining--;
    }
  }

  /** When the flow was last checked (`check`). */
  private lastChecked = 0;

  /** Readbacks in flight, and the lattice they were asked of. */
  private reads:
    | {
        lattice: GpuD2Q9;
        forces: Map<number, PendingRead>;
        macro: PendingRead | undefined;
      }
    | undefined;

  /**
   * Collects what the GPU has finished reading back and asks for more, so the
   * main thread never waits for it (`GpuD2Q9.beginRead`). Each body has one
   * force read in flight, asked for after a frame's steps and collected a
   * frame or so later, labelled with the step it was taken at. The flow is
   * read ten times a second, for the particles and arrows and the Mach check.
   */
  private collectReads(lattice: GpuD2Q9, now: number, stepped: boolean) {
    if (this.reads?.lattice !== lattice) {
      this.releaseReads();
      this.reads = { lattice, forces: new Map(), macro: undefined };
    }
    const { reads } = this;
    for (const [body, pending] of reads.forces) {
      const texel = lattice.finishRead(pending);
      if (texel === undefined) continue;
      reads.forces.delete(body);
      const record = this.bodies.get(body);
      if (record === undefined) continue;
      this.record(record, pending.step, sumForceTexels(texel).get(body));
    }
    // A frame that ran no steps has nothing new to measure, and asking anyway
    // would count the last step twice in every average.
    if (stepped) {
      for (const [body, record] of this.bodies) {
        if (!reads.forces.has(body))
          reads.forces.set(body, lattice.beginRead("forces", ...record.region));
      }
    }
    if (reads.macro !== undefined) {
      const texel = lattice.finishRead(reads.macro);
      if (texel !== undefined) {
        reads.macro = undefined;
        this.publishVelocity(texel);
        // Mach, validity and the stirring strength, ten times a second. This
        // may restart or stop the lattice.
        if (now - this.lastChecked >= CHECK_INTERVAL_MS) {
          this.lastChecked = now;
          this.check(texel);
        }
      }
    }
    // The next read as soon as the last has landed: the particles and arrows
    // follow the flow at the frame rate, not in steps.
    if (this.overlay.current === lattice && reads.macro === undefined)
      reads.macro = lattice.beginRead("macro", 0, 0, lattice.nx, lattice.ny);
  }

  /** Lets go of every read in flight, as a new lattice or new bodies do. */
  private releaseReads() {
    this.cancelSamples();
    if (this.reads === undefined) return;
    const { lattice, forces, macro } = this.reads;
    for (const read of forces.values()) lattice.cancelRead(read);
    if (macro !== undefined) lattice.cancelRead(macro);
    this.reads = undefined;
  }

  /** One drag and lift sample, at the step it was taken. */
  private record(
    record: BodyRecord,
    step: number,
    force: readonly [number, number] = [0, 0]
  ) {
    record.drag.push({ step, value: force[0] + record.rest[0] });
    record.lift.push({ step, value: force[1] + record.rest[1] });
    if (record.drag.length > SAMPLE_LIMIT) {
      record.drag.splice(0, record.drag.length - SAMPLE_LIMIT);
      record.lift.splice(0, record.lift.length - SAMPLE_LIMIT);
    }
  }

  /**
   * Hands the flow's velocity to the particles and arrows, in graph units per
   * second, from the macroscopic target's texels (`g8 δρ ux uy`). They live
   * in other WebGL contexts, which cannot read this one's textures, so the
   * velocity crosses as numbers.
   *
   * Every frame the GPU has a read ready, which is most of them. At ten
   * times a second, as it was, the particles followed a picture of the flow
   * that jumped about ten cells between updates, and the flow looked as if it
   * lagged.
   */
  private publishVelocity(texel: Float32Array) {
    const lattice = this.overlay.current;
    if (!lattice || !this.spec) return;
    const config = this.host.config();
    // A lattice velocity of 1 is a cell per step: dx/dt graph units per
    // second, which is the inflow speed over the lattice speed.
    const scale = config.inflowSpeed / this.latticeSpeed;
    const cells = texel.length / 4;
    const data = new Float32Array(2 * cells);
    // A moving solid is fluid to the lattice, moving with the solid. Its
    // inside reads as no flow too, so particles there respawn rather than
    // drift through it.
    const { solid } = this.spec;
    const coverage = this.spec.psm?.coverage;
    for (let k = 0; k < cells; k++) {
      if (solid[k] || (coverage !== undefined && coverage[k] >= 0.5)) continue;
      data[2 * k] = texel[4 * k + 2] * scale;
      data[2 * k + 1] = texel[4 * k + 3] * scale;
    }
    publishVelocitySample(FLUID_SAMPLE_SOURCE, {
      width: lattice.nx,
      height: lattice.ny,
      data,
      bounds: this.latticeTank,
    });
  }

  /**
   * The flow's Mach number and validity. An undefined density means the
   * lattice has gone unstable: it is stopped, and Auto restarts it slower.
   * Auto also slows down a flow that is merely too fast to be accurate.
   */
  private check(texel: Float32Array) {
    const lattice = this.overlay.current;
    if (!lattice || !this.spec) return;
    const { solid } = this.spec;
    let peakSquared = 0;
    let valid = true;
    for (let k = 0; k < texel.length / 4; k++) {
      if (solid[k]) continue;
      const deltaRho = texel[4 * k + 1];
      if (!Number.isFinite(deltaRho) || !(1 + deltaRho > 0)) {
        valid = false;
        break;
      }
      const ux = texel[4 * k + 2];
      const uy = texel[4 * k + 3];
      const squared = ux * ux + uy * uy;
      if (squared > peakSquared) peakSquared = squared;
    }
    const peak = Math.sqrt(peakSquared);
    this.peakMach = valid ? peak * Math.sqrt(3) : Infinity;
    if (valid) this.regulateForce(peak);
    const config = this.host.config();
    const tooFast = !valid || this.peakMach > MACH_LIMIT;
    const wasOver = this.overMach;
    this.overMach = valid && this.peakMach > MACH_LIMIT;
    if (wasOver && !this.overMach && this.notice === this.overMachNotice)
      this.notice = "";
    if (!tooFast) return;
    if (
      config.speedMode === "auto" &&
      this.latticeSpeed > ACCURATE_LATTICE_SPEED
    ) {
      // A flow that is merely fast is slowed where it is; one that has gone
      // unstable has nothing left worth keeping, and starts again.
      if (valid && this.slowDownInPlace(ACCURATE_LATTICE_SPEED)) {
        this.notice = `The flow reached Mach ${this.peakMach.toFixed(2)}, too fast to be accurate, so Auto halved the lattice speed and carried on.`;
        return;
      }
      this.latticeSpeed = ACCURATE_LATTICE_SPEED;
      this.notice = valid
        ? `The flow reached Mach ${this.peakMach.toFixed(2)}, too fast to be accurate, so Auto halved the lattice speed and restarted.`
        : "The flow became unstable, so Auto halved the lattice speed and restarted.";
      this.latticeKey = "";
      this.sync();
    } else if (!valid) {
      this.notice =
        "The flow became unstable and has stopped. Try Accurate, a lower Reynolds number, or more cells.";
      this.stopLattice();
    } else {
      // Lively keeps its speed by choice, and Auto and Accurate have no
      // slower one left: the flow runs on, said to be inaccurate while it is
      // (brief §8.1), and nothing measured meanwhile counts as settled.
      this.overMachNotice = `Speed limit exceeded: the flow reached Mach ${this.peakMach.toFixed(2)}, past the 0.3 where the lattice stays accurate, so what it shows now is not accurate.${
        config.speedMode === "lively" ? " Accurate or Auto would slow it." : ""
      }`;
      this.notice = this.overMachNotice;
      this.settleUntil = Math.max(
        this.settleUntil,
        this.overlay.steps +
          Math.round(this.units.cellsPerLength / this.latticeSpeed)
      );
    }
  }

  /** Whether the flow was past Mach 0.3 at the last check, and what was said. */
  private overMach = false;
  private overMachNotice = "";

  private drawOnce() {
    const config = this.host.config();
    const { units } = this;
    const u = this.latticeSpeed;
    const scale =
      config.show === "vorticity"
        ? (2 * u) / Math.max(1, units.cellsPerLength)
        : config.show === "speed"
          ? 1.6 * u
          : 1.5 * u * u;
    this.overlay.draw(this.latticeTank, config.show, scale);
  }
}

export { CellKind };
