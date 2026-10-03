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
  type GpuLatticeOptions,
} from "../../../field-rendering/sim/lbm/GpuD2Q9";
import {
  FluidOverlay,
  type LatticeSpec,
} from "../../../field-rendering/sim/FluidOverlay";
import {
  bodyForce,
  computeLinks,
} from "../../../field-rendering/sim/lbm/links";
import {
  lastCycle,
  sheddingPeriod,
  type Sample,
} from "../../../field-rendering/sim/measure";
import { fluidLatticeSize, type FluidConfig } from "../model";
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

export interface FluidHost {
  calc: Calc;
  /** The field whose P and Q stir the box. */
  field: () => FieldDescription;
  config: () => FluidConfig;
  environment: () => FieldEnvironment;
  items: () => readonly ItemLike[];
  degreeMode: () => boolean;
  /** One number from Desmos's own evaluator, by name. */
  helper: (latex: string) => ValueHelper;
  /** Asks the panel to draw again. */
  changed: () => void;
  /** Prefix of rows Vector Tools writes itself, which are never obstacles. */
  ownedPrefix: () => string;
}

/** How often the panel's readouts redraw, in milliseconds. */
const READOUT_INTERVAL_MS = 250;
/** How often the flow is checked for its Mach number and validity. */
const CHECK_INTERVAL_MS = 500;
/**
 * How often the solids are checked for a change while the flow runs: a slider
 * drag, an edit, or an obstacle that moves with t.
 */
const GEOMETRY_INTERVAL_MS = 100;
/** Samples kept per body: enough for several shedding cycles. */
const SAMPLE_LIMIT = 6000;

/** A row is a candidate when it compares, and is not a definition. */
const COMPARISON = /<|>|\\le|\\ge|\\leq|\\geq/;
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
  private maskCache:
    | { key: string; mask: Rasterized; nx: number; ny: number }
    | undefined;
  private readonly scheduler: StepScheduler;
  private lastPlan: FramePlan | undefined;
  private frameHandle: number | undefined;
  private lastReadout = 0;
  private lastCheck = 0;
  private lastGeometry = 0;
  private gusting = false;

  private readonly overlay: FluidOverlay;
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
  private peakMach = 0;
  private notice = "";

  constructor(private readonly host: FluidHost) {
    this.latticeSpeed = initialLatticeSpeed(host.config().speedMode);
    this.scheduler = new StepScheduler({
      stepSeconds: this.units.dt,
      maxStepsPerFrame: 64,
    });
    this.overlay = new FluidOverlay(host.calc, (message) => {
      this.notice = message;
      this.host.changed();
    });
  }

  // ---- obstacles -----------------------------------------------------------

  /** The graph's inequality rows, compiled; recompiled only when they change. */
  get obstacleRows(): readonly ObstacleRow[] {
    this.refreshRows();
    return this.rows;
  }

  private refreshRows() {
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

  /** One named value, through a helper kept for the session. */
  private helperValue(name: string): number {
    let helper = this.valueHelpers.get(name);
    if (helper === undefined) {
      helper = this.host.helper(name);
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
      { ...config.tank, nx, ny },
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
      reynolds: config.reynolds,
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

  // ---- the lattice ---------------------------------------------------------

  /**
   * Builds the lattice if what defines it changed, or updates its solids if
   * only they did. Resizing a solid follows the Auto/Strict choice.
   */
  private syncLattice() {
    const config = this.host.config();
    const { units } = this;
    const { nx, ny } = fluidLatticeSize(config);
    const latticeKey = JSON.stringify([
      config.mode,
      config.tank,
      nx,
      ny,
      units.tau,
      units.closure,
      this.latticeSpeed,
    ]);
    const solidsKey = this.solidsKeyFor(nx, ny);
    const restart = latticeKey !== this.latticeKey || !this.overlay.isRunning;
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
      this.spec = this.buildSpec(nx, ny, units, solids, undefined);
      this.overlay.start(this.spec);
      this.scheduler.reset();
      this.lastPlan = undefined;
      this.beginMeasurements(solids.regions, nx, ny);
      this.uploadForce();
      const pass = units.cellsPerLength / this.latticeSpeed;
      if (config.mode === "windTunnel") {
        // Start-up, then the gust, then a few more passes before anything is
        // called settled.
        this.rampSteps = Math.round(7.5 * pass);
        this.gustWindow = [Math.round(7.5 * pass), Math.round(11.5 * pass)];
        this.settleUntil = Math.round(30 * pass);
      } else {
        // A box has no inflow to ease in, and nothing symmetric to tip over.
        this.rampSteps = 0;
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
      const pass = units.cellsPerLength / this.latticeSpeed;
      this.settleUntil = this.overlay.steps + Math.round(10 * pass);
    }
  }

  private stopLattice() {
    this.overlay.stop();
    this.latticeKey = "";
    this.solidsKey = "";
    this.forceKey = "";
    this.forceShape = undefined;
    this.spec = undefined;
    this.bodies.clear();
  }

  /** Body numbers per cell, link fractions, and each body's bounding box. */
  private buildSolids(nx: number, ny: number) {
    const config = this.host.config();
    const { tank } = config;
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
    const solid = new Uint8Array(nx * ny);
    const boxes = rows.map(() => [Infinity, Infinity, -Infinity, -Infinity]);
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const [x, y] = centre(i, j);
        for (let b = 0; b < rows.length; b++) {
          if (!rows[b].obstacle!.contains({ ...scope, x, y })) continue;
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
    const links = computeLinks(
      { nx, ny, centre },
      solid,
      (body) => (x, y) => rows[body - 1].obstacle!.signed({ ...scope, x, y })
    );
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
    const rows = this.solidRows;
    const params = this.parameterValues();
    const time = rows.some((r) => r.obstacle!.usesTime)
      ? this.simulatedTime
      : 0;
    const { tank } = this.host.config();
    return JSON.stringify([this.rowsKey, [...params], time, nx, ny, tank]);
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
      initial: [0, 0],
      forceField: undefined,
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
    const { tank } = config;
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
  /** Its strength, in lattice units of force density. */
  private forceAmplitude = 0;

  /** The shape at the current strength, onto the running lattice. */
  private uploadForce() {
    const shape = this.forceShape;
    if (!shape || !this.spec) return;
    const field = new Float32Array(shape.length);
    for (let k = 0; k < shape.length; k++)
      field[k] = shape[k] * this.forceAmplitude;
    this.spec = { ...this.spec, forceField: field };
    this.overlay.updateForceField(field);
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
   * outlasts every correction and a gentle start overshoots less. The push keeps the field's shape throughout, and a
   * gradient field, which pressure answers whatever its strength, still
   * barely moves the fluid at the ceiling.
   */
  private regulateForce(peakSpeed: number) {
    if (this.host.config().mode !== "stirredBox" || !this.forceShape) return;
    // Aimed at 70% of the typical speed, because the box's momentum carries
    // the flow past whatever the push settles at: aimed at the full speed it
    // overshot to Mach 0.32 and made Auto restart.
    const target = 0.7 * this.latticeSpeed;
    const ceiling = this.forceCeiling;
    let next = this.forceAmplitude;
    if (peakSpeed > target) next *= Math.max(0.5, target / peakSpeed);
    else if (peakSpeed < 0.7 * target) next = Math.min(ceiling, next * 1.25);
    if (next === this.forceAmplitude) return;
    this.forceAmplitude = next;
    this.uploadForce();
  }

  private beginMeasurements(
    regions: Map<number, { rowId: string; box: number[] }>,
    nx: number,
    ny: number
  ) {
    this.bodies.clear();
    const solid = this.spec?.solid;
    if (!solid) return;
    for (const [body, { rowId, box }] of regions) {
      const margin = 2;
      const x0 = Math.max(0, box[0] - margin);
      const y0 = Math.max(0, box[1] - margin);
      const x1 = Math.min(nx - 1, box[2] + margin);
      const y1 = Math.min(ny - 1, box[3] + margin);
      const rest = bodyForce(
        body,
        new Float64Array(2 * nx * ny),
        new Uint8Array(nx * ny),
        solid,
        { nx, ny }
      );
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
      let sheddingNote = settled ? "" : "Settling after the start.";
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
    this.lastPlan = this.scheduler.frame(now);
    const lattice = this.overlay.current;
    if (lattice) {
      try {
        this.advance(this.lastPlan.steps);
        this.sample();
        if (now - this.lastCheck >= CHECK_INTERVAL_MS) {
          this.lastCheck = now;
          this.check();
        }
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
    if (now - this.lastReadout >= READOUT_INTERVAL_MS) {
      this.lastReadout = now;
      if (this.activeObstacles.some((o) => o.usesTime))
        this.maskCache = undefined;
      this.host.changed();
    }
  };

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
      const t = Math.min(1, step / Math.max(1, this.rampSteps));
      lattice.inletScale = t * t * (3 - 2 * t);
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

  private sample() {
    const lattice = this.overlay.current;
    if (!lattice || this.bodies.size === 0) return;
    for (const [body, record] of this.bodies) {
      const sums = lattice.sumForces(...record.region);
      const force = sums.get(body) ?? [0, 0];
      const step = lattice.steps;
      record.drag.push({ step, value: force[0] + record.rest[0] });
      record.lift.push({ step, value: force[1] + record.rest[1] });
      if (record.drag.length > SAMPLE_LIMIT) {
        record.drag.splice(0, record.drag.length - SAMPLE_LIMIT);
        record.lift.splice(0, record.lift.length - SAMPLE_LIMIT);
      }
    }
  }

  /**
   * The flow's Mach number and validity. An undefined density means the
   * lattice has gone unstable: it is stopped, and Auto restarts it slower.
   * Auto also slows down a flow that is merely too fast to be accurate.
   */
  private check() {
    const lattice = this.overlay.current;
    if (!lattice || !this.spec) return;
    const { ux, uy, deltaRho } = lattice.readMacro();
    let peak = 0;
    let valid = true;
    for (let k = 0; k < ux.length; k++) {
      if (this.spec.solid[k]) continue;
      if (!Number.isFinite(deltaRho[k]) || !(1 + deltaRho[k] > 0)) {
        valid = false;
        break;
      }
      peak = Math.max(peak, Math.hypot(ux[k], uy[k]));
    }
    this.peakMach = valid ? peak * Math.sqrt(3) : Infinity;
    if (valid) this.regulateForce(peak);
    const config = this.host.config();
    const tooFast = !valid || this.peakMach > MACH_LIMIT;
    if (!tooFast) return;
    if (
      config.speedMode === "auto" &&
      this.latticeSpeed > ACCURATE_LATTICE_SPEED
    ) {
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
    }
  }

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
    this.overlay.draw(config.tank, config.show, scale);
  }
}

export { CellKind };
