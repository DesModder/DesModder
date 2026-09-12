/**
 * Physics Lab's persisted configuration.
 *
 * The same arrangement Vector Tools uses, and for the same reasons: one plain
 * JSON object with a `schemaVersion`, normalised on load rather than trusted,
 * and validated before anything is drawn from it. A configuration that arrives
 * from an older build, or from a setting somebody edited by hand, has to come
 * out the other side as something the renderer can be handed without checking
 * it again.
 */
import { PALETTE_IDS, type PaletteID } from "../../field-rendering/palettes";
import type {
  VectorColorMode,
  ColorRangeMode,
} from "../../field-rendering/types";

export const PHYSICS_LAB_SCHEMA_VERSION = 1;

/** Above this the marks are closer together than they are long, and the field
 * reads as a texture rather than as a set of slopes. It is a default, not a
 * rule — see {@link SlopeFieldConfig.densityLimit}. */
export const SLOPE_MARK_LIMIT = 10_000;
export const SLOPE_COUNT_MINIMUM = 2;
export const SLOPE_COUNT_MAXIMUM = 401;

export type PanelTab = "slope" | "second" | "derivative" | "exact";

/**
 * How far the panel may be dragged.
 *
 * The same bounds Vector Tools uses, widened at the top because a derivation
 * puts more on one line than a field's controls do. The minimum is the width
 * below which the three number fields on a row start wrapping into a column.
 */
export const PANEL_MIN_WIDTH = 380;
export const PANEL_MAX_WIDTH = 820;
export const PANEL_MIN_HEIGHT = 280;
export const PANEL_MAX_HEIGHT = 940;

/** Persisted panel geometry, so a resized panel stays resized. */
export interface PanelConfig {
  width: number;
  height: number;
  /** Section the panel opens on. */
  tab: PanelTab;
}

/**
 * How much of a derivation to show.
 *
 * `standard` hides the atomic facts — the derivative of x, of a constant — and
 * shows the decisions. `full` shows everything the engine did. Both render the
 * same derivation tree; nothing is recomputed, and no second explanation
 * exists that could disagree with the first.
 */
export type DetailLevel = "standard" | "full";

export interface DerivativeConfig {
  fLatex: string;
  variable: string;
  detail: DetailLevel;
  /**
   * The reader's own answer to the practice problem, checked numerically
   * against the real one. Kept here with everything else the panel owns, and
   * cleared whenever the question changes — an attempt at the previous problem
   * marked against this one would be nonsense.
   */
  attemptLatex: string;
  /** How many hints have been asked for. */
  hintsShown: number;
  /** Whether the practice answer has been revealed. */
  showAnswer: boolean;
}

export const PANEL_TABS = [
  { id: "slope", label: "Slope field" },
  { id: "second", label: "2nd order" },
  { id: "derivative", label: "Derivative" },
  { id: "exact", label: "Exact value" },
] as const satisfies readonly { id: PanelTab; label: string }[];

export interface Interval {
  min: number;
  max: number;
}

export interface SlopeFieldConfig {
  /** The right-hand side of dy/dx = f(x, y). */
  fLatex: string;
  domain: { x: Interval; y: Interval };
  columns: number;
  rows: number;
  /**
   * Mark length as a fraction of the grid spacing.
   *
   * A fraction rather than an absolute length because the only thing a slope
   * mark must not do is touch its neighbour: two marks that meet draw a
   * continuous curve that is not a solution of anything. Tying the length to
   * the spacing keeps that true at every density.
   */
  markLength: number;
  /** Line thickness in CSS pixels, so it does not change with the zoom. */
  lineWidth: number;
  colorMode: VectorColorMode;
  palette: PaletteID;
  fixedColor: string;
  /** Thin a grid too dense to read. A checkbox, not a rule. */
  densityLimit: boolean;
  rangeMode: ColorRangeMode;
  rangeMinimum: number;
  rangeMaximum: number;
}

export interface PhysicsLabConfig {
  schemaVersion: number;
  panel: PanelConfig;
  slope: SlopeFieldConfig;
  /**
   * The right-hand side of d2y/dx2, in terms of y and v.
   *
   * Separate from the slope field's equation because they are different
   * equations: a slope field is a first-order object, and there is no 2D
   * picture of a second-order equation to draw beside it.
   */
  secondOrder: { fLatex: string };
  /** What the Derivative tab is working on, and how much of it to show. */
  derivative: DerivativeConfig;
  /**
   * The phase plane for the second-order equation: y across, y′ up.
   *
   * Its own domain because it is its own coordinate system. A second-order
   * equation has no direction field in (x, y) at all — the slope at a point
   * depends on the velocity there too, so there is nothing to draw. Against y
   * and y′ there is, and it is the picture the whole subject is taught from.
   */
  phase: {
    domain: { x: Interval; y: Interval };
    columns: number;
    rows: number;
  };
  /**
   * A point the solution must pass through, as latex. Empty means no
   * condition, which is the general solution.
   */
  initial: { xLatex: string; yLatex: string };
  /** The expression the Exact value tab last read. */
  exact: { latex: string };
}

export function defaultPhysicsLabConfig(): PhysicsLabConfig {
  return {
    schemaVersion: PHYSICS_LAB_SCHEMA_VERSION,
    panel: { width: 460, height: 600, tab: "slope" },
    slope: {
      // The example every AP Calculus text opens with, and one whose solutions
      // are visibly not what a first guess says they are.
      fLatex: "x-y",
      domain: { x: { min: -5, max: 5 }, y: { min: -5, max: 5 } },
      columns: 21,
      rows: 21,
      markLength: 0.68,
      lineWidth: 2.2,
      colorMode: "fixed",
      palette: "spectral",
      fixedColor: "#2d70b3",
      densityLimit: true,
      rangeMode: "automatic",
      rangeMinimum: 0,
      rangeMaximum: 1,
    },
    // A damped oscillator: the case with all the behaviour in it.
    secondOrder: { fLatex: "-y'-4y" },
    initial: { xLatex: "", yLatex: "" },
    // Product, power and chain in one line, so the first thing on screen shows
    // what the steps are for.
    derivative: {
      fLatex: "x^{2}\\operatorname{sin}\\left(3x\\right)",
      variable: "x",
      detail: "standard",
      attemptLatex: "",
      hintsShown: 0,
      showAnswer: false,
    },
    phase: {
      domain: { x: { min: -4, max: 4 }, y: { min: -4, max: 4 } },
      columns: 19,
      rows: 19,
    },
    exact: { latex: "" },
  };
}

const clampNumber = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const clampRange = (
  value: unknown,
  fallback: number,
  low: number,
  high: number
) => Math.min(high, Math.max(low, clampNumber(value, fallback)));

const clampCount = (value: unknown, fallback: number) =>
  Math.round(
    Math.min(
      SLOPE_COUNT_MAXIMUM,
      Math.max(SLOPE_COUNT_MINIMUM, clampNumber(value, fallback))
    )
  );

function normalizeInterval(raw: unknown, fallback: Interval): Interval {
  const source = (raw ?? {}) as Partial<Interval>;
  return {
    min: clampNumber(source.min, fallback.min),
    max: clampNumber(source.max, fallback.max),
  };
}

/**
 * Brings any stored object up to the current schema.
 *
 * Nothing here throws. A configuration that cannot be read is a configuration
 * the user cannot get back to, and losing a field someone set up is a worse
 * outcome than silently restoring one default.
 */
export function normalizePhysicsLabConfig(raw: unknown): PhysicsLabConfig {
  const defaults = defaultPhysicsLabConfig();
  if (typeof raw !== "object" || raw === null) return defaults;
  const source = raw as Partial<PhysicsLabConfig>;
  const slope = (source.slope ?? {}) as Partial<SlopeFieldConfig>;
  const panel = source.panel ?? defaults.panel;
  const { tab } = panel;
  return {
    schemaVersion: PHYSICS_LAB_SCHEMA_VERSION,
    panel: {
      width: Math.round(
        clampRange(
          panel.width,
          defaults.panel.width,
          PANEL_MIN_WIDTH,
          PANEL_MAX_WIDTH
        )
      ),
      height: Math.round(
        clampRange(
          panel.height,
          defaults.panel.height,
          PANEL_MIN_HEIGHT,
          PANEL_MAX_HEIGHT
        )
      ),
      tab: PANEL_TABS.some((entry) => entry.id === tab)
        ? tab
        : defaults.panel.tab,
    },
    slope: {
      fLatex:
        typeof slope.fLatex === "string" ? slope.fLatex : defaults.slope.fLatex,
      domain: {
        x: normalizeInterval(slope.domain?.x, defaults.slope.domain.x),
        y: normalizeInterval(slope.domain?.y, defaults.slope.domain.y),
      },
      columns: clampCount(slope.columns, defaults.slope.columns),
      rows: clampCount(slope.rows, defaults.slope.rows),
      markLength: Math.min(
        1,
        Math.max(0.05, clampNumber(slope.markLength, defaults.slope.markLength))
      ),
      lineWidth: Math.min(
        8,
        Math.max(0.5, clampNumber(slope.lineWidth, defaults.slope.lineWidth))
      ),
      colorMode: slope.colorMode ?? defaults.slope.colorMode,
      palette: PALETTE_IDS.includes(slope.palette!)
        ? slope.palette!
        : defaults.slope.palette,
      fixedColor:
        typeof slope.fixedColor === "string" &&
        /^#[0-9a-fA-F]{6}$/.test(slope.fixedColor)
          ? slope.fixedColor
          : defaults.slope.fixedColor,
      densityLimit: slope.densityLimit !== false,
      rangeMode: slope.rangeMode === "manual" ? "manual" : "automatic",
      rangeMinimum: clampNumber(
        slope.rangeMinimum,
        defaults.slope.rangeMinimum
      ),
      rangeMaximum: clampNumber(
        slope.rangeMaximum,
        defaults.slope.rangeMaximum
      ),
    },
    initial: {
      xLatex:
        typeof source.initial?.xLatex === "string"
          ? source.initial.xLatex
          : defaults.initial.xLatex,
      yLatex:
        typeof source.initial?.yLatex === "string"
          ? source.initial.yLatex
          : defaults.initial.yLatex,
    },
    phase: {
      domain: {
        x: normalizeInterval(source.phase?.domain?.x, defaults.phase.domain.x),
        y: normalizeInterval(source.phase?.domain?.y, defaults.phase.domain.y),
      },
      columns: clampCount(source.phase?.columns, defaults.phase.columns),
      rows: clampCount(source.phase?.rows, defaults.phase.rows),
    },
    derivative: {
      fLatex:
        typeof source.derivative?.fLatex === "string"
          ? source.derivative.fLatex
          : defaults.derivative.fLatex,
      variable:
        typeof source.derivative?.variable === "string" &&
        /^[a-zA-Z]$/.test(source.derivative.variable)
          ? source.derivative.variable
          : defaults.derivative.variable,
      detail: source.derivative?.detail === "full" ? "full" : "standard",
      attemptLatex:
        typeof source.derivative?.attemptLatex === "string"
          ? source.derivative.attemptLatex
          : "",
      hintsShown: Math.max(
        0,
        Math.round(clampNumber(source.derivative?.hintsShown, 0))
      ),
      showAnswer: source.derivative?.showAnswer === true,
    },
    secondOrder: {
      fLatex:
        typeof source.secondOrder?.fLatex === "string"
          ? source.secondOrder.fLatex
          : defaults.secondOrder.fLatex,
    },
    exact: {
      latex:
        typeof source.exact?.latex === "string"
          ? source.exact.latex
          : defaults.exact.latex,
    },
  };
}

export interface SlopeValidation {
  issues: readonly { field: string; message: string }[];
  markCount: number;
  ok: boolean;
}

/**
 * What is wrong with a configuration, before anything is compiled from it.
 *
 * A degenerate axis is the one that matters: a domain of zero width divides by
 * zero when the spacing is worked out, and what reaches the screen is a single
 * column of marks with no hint of why.
 */
export function validateSlopeField(config: SlopeFieldConfig): SlopeValidation {
  const issues: { field: string; message: string }[] = [];
  if (config.fLatex.trim() === "")
    issues.push({ field: "f", message: "Enter f(x, y) for dy/dx." });
  for (const axis of ["x", "y"] as const) {
    const interval = config.domain[axis];
    if (!Number.isFinite(interval.min) || !Number.isFinite(interval.max)) {
      issues.push({
        field: axis,
        message: `The ${axis} domain is not a number.`,
      });
    } else if (interval.max <= interval.min) {
      issues.push({
        field: axis,
        message: `The ${axis} domain needs a maximum above its minimum.`,
      });
    }
  }
  const markCount = config.columns * config.rows;
  return { issues, markCount, ok: issues.length === 0 };
}

/**
 * Thins a grid too dense to read, both axes by one factor.
 *
 * Matching the sampling domain to a zoomed-out viewport asks for hundreds of
 * thousands of marks by accident, and what comes back is the moiré between the
 * mark grid and the pixel grid rather than the field. Both axes scale by the
 * same factor so the marks stay square to the grid. Vector Tools learned this
 * with arrows; the geometry is identical here.
 */
export function thinSlopeGrid(columns: number, rows: number) {
  const requested = columns * rows;
  if (requested <= SLOPE_MARK_LIMIT) return { columns, rows, thinned: false };
  const factor = Math.sqrt(SLOPE_MARK_LIMIT / requested);
  return {
    columns: Math.max(2, Math.floor(columns * factor)),
    rows: Math.max(2, Math.floor(rows * factor)),
    thinned: true,
  };
}
