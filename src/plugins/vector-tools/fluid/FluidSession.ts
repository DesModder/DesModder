/**
 * The Fluid tab's live state: which rows of the graph are solids, what this
 * GPU can do, and the clock a simulation will step on.
 *
 * Gate 0 of the fluid plan (`VECTOR_TOOLS_FLUID_RESEARCH_BRIEF.md`) is
 * everything a solver needs before it can be trusted with a single step, so
 * this owns no lattice yet. What it does own is exactly what the solver will
 * read:
 * - **The obstacles.** These are the graph's inequality rows, compiled
 *   strictly so that the fluid sees the region Desmos shades. Each row says
 *   whether it compiled and, if not, why. A hidden row lets the fluid through,
 *   as in the mock-up.
 * - **A mask of the tank** at lattice resolution, which the panel draws so a
 *   solid can be checked against Desmos's own shading before any flow exists.
 * - **The capabilities**, measured on a context of its own.
 * - **The step scheduler and the lattice units** it is driven by.
 *
 * It is kept out of `index.ts` because that file is the plugin's wiring, and
 * the fluid will grow into a subsystem of its own.
 */

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
  initialLatticeSpeed,
  latticeUnits,
  type LatticeUnits,
} from "../../../field-rendering/sim/latticeUnits";
import {
  StepScheduler,
  type FramePlan,
} from "../../../field-rendering/sim/StepScheduler";
import type { FieldEnvironment } from "../../../field-rendering/latexToGLSL";
import { fluidLatticeSize, type FluidConfig } from "../model";

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

export interface FluidHost {
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

/** How often the clock readout redraws the panel, in milliseconds. */
const READOUT_INTERVAL_MS = 250;

/** A row is a candidate when it compares, and is not a definition. */
const COMPARISON = /<|>|\\le|\\ge|\\leq|\\geq/;
const DEFINITION =
  /^[A-Za-z](?:_(?:\{[A-Za-z0-9]*\}|[A-Za-z0-9]))?(?:\\left\([^)]*\\right\)|\([^)]*\))?=/;

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

  constructor(private readonly host: FluidHost) {
    this.scheduler = new StepScheduler({
      stepSeconds: this.units.dt,
      maxStepsPerFrame: 64,
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

  /** The compiled obstacles the fluid would see: shown rows that compiled. */
  get activeObstacles(): CompiledObstacle[] {
    return this.obstacleRows
      .filter((row) => !row.hidden && row.obstacle !== undefined)
      .map((row) => row.obstacle!);
  }

  /** Slider values the obstacles read, from Desmos's own evaluator. */
  private parameterValues(): Map<string, number> {
    const values = new Map<string, number>();
    for (const obstacle of this.activeObstacles) {
      for (const name of obstacle.params) {
        if (values.has(name)) continue;
        let helper = this.valueHelpers.get(name);
        if (helper === undefined) {
          helper = this.host.helper(name);
          helper.observe("numericValue", () => {
            this.maskCache = undefined;
            this.host.changed();
          });
          this.valueHelpers.set(name, helper);
        }
        values.set(name, helper.numericValue);
      }
    }
    return values;
  }

  /**
   * The tank at lattice resolution: solid, fluid, or undefined in each cell.
   * Obstacles that move with `t` are drawn at the simulated time.
   */
  get mask(): { mask: Rasterized; nx: number; ny: number } {
    const config = this.host.config();
    const { nx, ny } = fluidLatticeSize(config);
    const obstacles = this.activeObstacles;
    const params = this.parameterValues();
    const time = obstacles.some((o) => o.usesTime)
      ? (this.lastPlan?.simulatedSeconds ?? 0)
      : 0;
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
      latticeSpeed: initialLatticeSpeed(config.speedMode),
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

  get isRunning() {
    return this.frameHandle !== undefined;
  }

  /**
   * Starts or stops the clock to match the settings. Called after any change,
   * so that the loop's existence follows from the configuration rather than
   * being remembered separately.
   */
  sync() {
    const config = this.host.config();
    this.scheduler.setStepSeconds(this.units.dt);
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
    }
  }

  /** Back to zero: what a resize, a refit or a restart does. */
  restart() {
    this.scheduler.reset();
    this.lastPlan = undefined;
    this.maskCache = undefined;
    this.host.changed();
  }

  dispose() {
    if (this.frameHandle !== undefined) cancelAnimationFrame(this.frameHandle);
    this.frameHandle = undefined;
  }

  private readonly frame = (now: number) => {
    this.frameHandle = requestAnimationFrame(this.frame);
    // No lattice yet: the plan's steps are counted, not run. When the solver
    // arrives it runs exactly `plan.steps` here.
    this.lastPlan = this.scheduler.frame(now);
    if (now - this.lastReadout >= READOUT_INTERVAL_MS) {
      this.lastReadout = now;
      if (this.activeObstacles.some((o) => o.usesTime)) {
        this.maskCache = undefined;
      }
      this.host.changed();
    }
  };
}

export { CellKind };
