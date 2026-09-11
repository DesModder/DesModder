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

export type PanelTab = "slope" | "second" | "exact";

export const PANEL_TABS = [
  { id: "slope", label: "Slope field" },
  { id: "second", label: "2nd order" },
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
  panel: { tab: PanelTab };
  slope: SlopeFieldConfig;
  /**
   * The right-hand side of d2y/dx2, in terms of y and v.
   *
   * Separate from the slope field's equation because they are different
   * equations: a slope field is a first-order object, and there is no 2D
   * picture of a second-order equation to draw beside it.
   */
  secondOrder: { fLatex: string };
  /** The expression the Exact value tab last read. */
  exact: { latex: string };
}

export function defaultPhysicsLabConfig(): PhysicsLabConfig {
  return {
    schemaVersion: PHYSICS_LAB_SCHEMA_VERSION,
    panel: { tab: "slope" },
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
    secondOrder: { fLatex: "-v-4y" },
    exact: { latex: "" },
  };
}

const clampNumber = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

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
  const tab = source.panel?.tab;
  return {
    schemaVersion: PHYSICS_LAB_SCHEMA_VERSION,
    panel: {
      tab: PANEL_TABS.some((entry) => entry.id === tab)
        ? tab!
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
