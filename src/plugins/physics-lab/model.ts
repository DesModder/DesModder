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

export type PanelTab =
  | "slope"
  | "second"
  | "limit"
  | "derivative"
  | "integral"
  | "exact";

/**
 * How many terms the plotted series carries.
 *
 * A control rather than a constant because the two things somebody wants from
 * a series antiderivative pull in opposite directions: a curve that is right
 * out to the edge of the window wants more terms, and a sum Desmos redraws
 * while a slider moves wants fewer. Two is the fewest that is still a series.
 * The ceiling is not a limit of the arithmetic — it is where more terms stop
 * helping: an alternating series far from zero builds enormous terms that
 * cancel to something small, and past this the cancellation costs more digits
 * than the extra terms add.
 */
export const SERIES_TERMS_MIN = 2;
export const SERIES_TERMS_MAX = 40;

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

/**
 * Which way round to write the answer.
 *
 * Two forms of the same function, and neither is more correct: expanded is what
 * the rules produce and factored is what a person writes down. Offered rather
 * than chosen, because which one is wanted depends on what is about to be done
 * with it — expanded to read off a term, factored to see where it vanishes.
 */
export type AnswerForm = "expanded" | "factored";

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
  /**
   * Whether the attempt has been submitted for marking.
   *
   * A verdict that updates on every keystroke tells somebody halfway through
   * typing their answer that it is wrong, which is both true and useless.
   */
  checked: boolean;
  form: AnswerForm;
}

/**
 * What the Integral tab is working on.
 *
 * No practice problem and no detail level, unlike the derivative beside it,
 * and neither is an omission. Differentiation is a set of rules that can be
 * listed and applied in order, so a derivation reads as a sequence of steps
 * somebody could have taken. Integration is a search: the answer to
 * `∫dx/(1+cos x)` was found by trying a dozen things and keeping the one that
 * worked, and a list of what was tried is a transcript of the engine rather
 * than an explanation. Naming the technique that finished it would be worth
 * saying and is not available: nothing in the integrator reports which branch
 * succeeded, and inventing a label from the shape of the answer would be
 * guessing at its own working.
 */
export interface IntegralConfig {
  fLatex: string;
  variable: string;
  /** How many terms a series antiderivative carries. */
  terms: number;
  /**
   * Whether bounds are given. Off by default: an antiderivative is the answer
   * to more questions than one number is, and the bounds are there when asked
   * for rather than in the way when not.
   */
  definite: boolean;
  /** The bounds as typed, which may be `\infty` or `-\infty`. */
  lowerLatex: string;
  upperLatex: string;
}

/**
 * Which way a limit at a point is taken.
 *
 * Both sides by default, because that is what `lim` means with nothing
 * written under the arrow — and the case where the two sides disagree is the
 * one a course most wants seen. One side is there for the piecewise and
 * absolute-value questions that ask for it by name.
 */
export type LimitDirection = "both" | "left" | "right";

/** What the Limit tab is working on. */
export interface LimitConfig {
  fLatex: string;
  variable: string;
  /** Where the variable goes, as typed: a number, an expression, or ±∞. */
  pointLatex: string;
  side: LimitDirection;
  /**
   * How deep the explanation goes. The same steps at every depth, so the
   * three cannot disagree: `simple` says what to do, `detailed` adds the
   * condition that makes each step legal, `research` adds the proof under it.
   */
  explain: ExplainLevel;
  /**
   * What a two-sided limit means where the function lives on one side only.
   * Both are conventions a textbook uses; the first is the stricter.
   */
  convention: "bilateral" | "domain";
  /** The method being shown, by route id; empty for the one a course uses first. */
  route: string;
}

export type ExplainLevel = "simple" | "detailed" | "research";

export const PANEL_TABS = [
  { id: "slope", label: "Slope field" },
  { id: "second", label: "2nd order" },
  { id: "limit", label: "Limit" },
  { id: "derivative", label: "Derivative" },
  { id: "integral", label: "Integral" },
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
  /** What the Integral tab is working on. */
  integral: IntegralConfig;
  /** What the Limit tab is working on. */
  limit: LimitConfig;
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
      checked: false,
      form: "expanded",
    },
    // Integration by parts, and an answer everybody recognises the moment they
    // see it. The first thing on screen is a worked integral rather than an
    // empty field, and this one is short enough to check by differentiating in
    // your head.
    integral: {
      fLatex: "x\\sin\\left(x\\right)",
      variable: "x",
      terms: 20,
      definite: false,
      lowerLatex: "0",
      upperLatex: "\\pi",
    },
    // The limit that defines e, and a 1^∞ form: the one every course uses to
    // show that "the base goes to 1" does not mean "the answer is 1".
    limit: {
      fLatex: "\\left(1+\\frac{1}{x}\\right)^{x}",
      variable: "x",
      pointLatex: "\\infty",
      side: "both",
      explain: "simple",
      convention: "bilateral",
      route: "",
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
      checked: source.derivative?.checked === true,
      form: source.derivative?.form === "factored" ? "factored" : "expanded",
    },
    integral: {
      fLatex:
        typeof source.integral?.fLatex === "string"
          ? source.integral.fLatex
          : defaults.integral.fLatex,
      variable:
        typeof source.integral?.variable === "string" &&
        /^[a-zA-Z]$/.test(source.integral.variable)
          ? source.integral.variable
          : defaults.integral.variable,
      terms: Math.round(
        clampRange(
          source.integral?.terms,
          defaults.integral.terms,
          SERIES_TERMS_MIN,
          SERIES_TERMS_MAX
        )
      ),
      definite: source.integral?.definite === true,
      lowerLatex:
        typeof source.integral?.lowerLatex === "string"
          ? source.integral.lowerLatex
          : defaults.integral.lowerLatex,
      upperLatex:
        typeof source.integral?.upperLatex === "string"
          ? source.integral.upperLatex
          : defaults.integral.upperLatex,
    },
    limit: {
      fLatex:
        typeof source.limit?.fLatex === "string"
          ? source.limit.fLatex
          : defaults.limit.fLatex,
      variable:
        typeof source.limit?.variable === "string" &&
        /^[a-zA-Z]$/.test(source.limit.variable)
          ? source.limit.variable
          : defaults.limit.variable,
      pointLatex:
        typeof source.limit?.pointLatex === "string"
          ? source.limit.pointLatex
          : defaults.limit.pointLatex,
      side:
        source.limit?.side === "left" || source.limit?.side === "right"
          ? source.limit.side
          : "both",
      explain:
        source.limit?.explain === "detailed" ||
        source.limit?.explain === "research"
          ? source.limit.explain
          : "simple",
      convention:
        source.limit?.convention === "domain" ? "domain" : "bilateral",
      route: typeof source.limit?.route === "string" ? source.limit.route : "",
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
