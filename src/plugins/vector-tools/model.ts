import {
  COLOR_CONTRAST_MAXIMUM,
  COLOR_CONTRAST_MINIMUM,
  COLOR_SATURATION_MAXIMUM,
  COLOR_SATURATION_MINIMUM,
  PALETTE_IDS,
  type PaletteID,
} from "../../field-rendering/palettes";
/**
 * The four modes the shaders implement now live beside the shaders. They are
 * re-exported here because they are still part of this plugin's configuration
 * vocabulary, and every existing reader of `model` expects to find them.
 *
 * `ColorRangeMode`'s `automatic` is a ramp that saturates, sized by the
 * viewport, rather than one stretched between a measured smallest and largest:
 * it cannot be taken over by a pole. See the briefing §6.1.
 */
import type {
  VectorLengthMode,
  VectorColorMode,
  ColorRangeMode,
  FlowColorMode,
  OverlayLayer,
} from "../../field-rendering/types";
export type {
  VectorLengthMode,
  VectorColorMode,
  ColorRangeMode,
  FlowColorMode,
  OverlayLayer,
};
export const VECTOR_FIELD_SCHEMA_VERSION = 4;

/**
 * The letters a field's generated Desmos symbols are built from.
 *
 * Every generated definition is `v_{tf<token><suffix>}`, so two fields sharing
 * a token would define `v_{tfdp}` twice and Desmos would call one of them a
 * duplicate. The token is stored on the field rather than derived from its
 * position, because a field keeps its symbols when the one above it is deleted.
 *
 * `d` comes first so the field a pre-library setting is migrated into keeps the
 * exact symbols it already wrote into the user's saved graphs. `t` is missing
 * because the generator reserves it for its own tests, and the vowels that make
 * unfortunate three-letter subscripts are missing too.
 */
export const SYMBOL_TOKENS = [
  "d",
  "e",
  "g",
  "h",
  "j",
  "k",
  "m",
  "n",
  "p",
  "q",
  "r",
  "s",
  "u",
  "v",
  "w",
  "x",
  "y",
  "z",
] as const;

/** How many fields one library may hold. */
export const MAX_FIELDS = SYMBOL_TOKENS.length;

export const VECTOR_COUNT_WARNING = 2_500;
export const VECTOR_COUNT_HARD_MAXIMUM = 10_000;
export const ZERO_VECTOR_TOLERANCE = 1e-9;

export type SamplingMode = "step" | "count";
/**
 * Where the field's two components come from. `gradient` derives them from one
 * scalar function, so the same arrows, colors, and flow describe ∇f.
 */
export type FieldSource = "components" | "gradient";
export type ColorPalette = PaletteID;
export type ZeroVectorMode = "hide" | "point";

/**
 * Who draws the arrows.
 *
 * `live` is this extension, on its own canvas: instant, uncapped, and with
 * solid tapered arrowheads Desmos expressions cannot draw. `desmos` is the
 * generator, which writes ordinary expressions — slower and capped, but the
 * result is a graph that still works for someone without the extension.
 *
 * They are not exclusive. Live arrows are what you configure against; pressing
 * Generate commits the same field to the expression list.
 */
export type ArrowMode = "off" | "live" | "desmos";

/**
 * The most arrows worth drawing live.
 *
 * Not a performance limit — the GPU will happily draw far more. It is a
 * legibility one: past roughly one arrow per few pixels the arrows are smaller
 * than the grid they sit on, and what you see is the moiré between the two
 * rather than the field. Matching the sampling domain to a zoomed-out viewport
 * asks for hundreds of thousands, and every one of them lands inside a pixel.
 *
 * It is the number Desmos generation refuses at, for the same reason and with a
 * gentler answer: the domain is sampled more coarsely rather than not drawn.
 *
 * It is also only a default. Live rendering is the half of this plugin with no
 * limit, and a dense field drawn whole is a legitimate thing to want to look
 * at — `arrowDensityLimit` turns this off and every sample is drawn.
 */
export const LIVE_ARROW_MAXIMUM = VECTOR_COUNT_HARD_MAXIMUM;

/**
 * The same domain, sampled coarsely enough to stay readable.
 *
 * Both axes are scaled by one factor so the arrows stay square to the grid
 * rather than stretching along whichever axis had more of them.
 */
export function thinArrowGrid(
  columns: number,
  rows: number,
  maximum = LIVE_ARROW_MAXIMUM
) {
  const total = Math.max(0, columns) * Math.max(0, rows);
  if (total <= maximum || total === 0) {
    return { columns, rows, thinned: false, requested: total };
  }
  const factor = Math.sqrt(maximum / total);
  return {
    columns: Math.max(2, Math.floor(columns * factor)),
    rows: Math.max(2, Math.floor(rows * factor)),
    thinned: true,
    requested: total,
  };
}

/**
 * The two things a particle flow can be asked to show.
 *
 * Long-lived particles with long trails draw the field's *streamlines*, which
 * is what the visualizer has always done — and on a rotational field that
 * genuinely is a set of concentric circles, with gaps between them. Short
 * trails that respawn constantly cover the viewport evenly instead, reading as
 * a texture with the field's direction in it rather than a set of curves.
 */
export type FlowLook = "streamlines" | "texture";

/** What each look sets. Every one of these stays adjustable afterwards. */
export const FLOW_LOOK_PRESETS: Record<
  FlowLook,
  Pick<FlowConfig, "trailPersistence" | "dropRate">
> = {
  streamlines: { trailPersistence: 0.95, dropRate: 0.01 },
  texture: { trailPersistence: 0.6, dropRate: 0.15 },
};

/**
 * Settings for the GPU flow visualizer. Persisted alongside the field so a
 * graph reopened later animates the way it did when it was set up.
 */
export interface FlowConfig {
  /** Exact number of particles. Any value in the supported range works. */
  particleCount: number;
  speed: number;
  trailPersistence: number;
  dropRate: number;
  opacity: number;
  pointSize: number;
  /**
   * How much of a halo each particle draws, 0..1.
   *
   * At 0 a particle is a flat disc. Above it a soft falloff accumulates across
   * overlapping particles into a diffuse glow, which is the difference between
   * a field drawn in dots and one drawn in light. It costs fill rate rather
   * than particles — the sprite grows for the halo to have somewhere to go.
   */
  glow: number;
  /**
   * Whether the halo is drawn at all.
   *
   * Separate from its strength so that turning it off and on again gives back
   * the strength that was set, rather than a default. The visual extras are
   * meant to be a choice, and a choice that forgets what you chose is a worse
   * one than no choice at all.
   */
  glowEnabled: boolean;
  /**
   * Whether a dark backdrop is laid under the particles.
   *
   * The palettes built for the flow run from near-black to near-white, which
   * is backwards on white graph paper — the most visible end of the ramp is
   * the one meant to fade out. A backdrop fixes that, and it is a trade rather
   * than an improvement: the grid, the axes and every other expression go
   * behind it, which is why it is a choice and not the default.
   */
  backdropEnabled: boolean;
  backdropColor: string;
  backdropOpacity: number;
  colorMode: FlowColorMode;
  /** The ramp the `speed` color mode runs along. */
  palette: ColorPalette;
  /**
   * How far the particles' colours are pushed once the ramp has been walked.
   *
   * Its own pair rather than shared with the arrows, because the two are drawn
   * against different things. A particle is a faint additive smear that
   * thousands of its neighbours pile onto, and an arrow is a solid shape with
   * graph paper showing between it and the next one — the settings that make
   * one readable wash the other out.
   */
  saturation: number;
  contrast: number;
  /** Which of the two looks the trail and respawn settings were last set to. */
  look: FlowLook;
  /** Draw streamlines at a constant pace instead of the field's magnitude. */
  normalizeSpeed: boolean;
  /**
   * Fraction of the display's own pixels the flow is drawn at, 0.25..1.
   *
   * Below 1 the visualizer renders into a smaller buffer and the browser scales
   * it up. Most of a frame's cost is the whole-canvas passes, so this is the
   * cheapest way to buy back frame rate on a dense display.
   */
  renderScale: number;
}

/** Below this the flow is too soft to read, whatever it buys back. */
export const FLOW_RENDER_SCALE_MINIMUM = 0.25;
export const FLOW_PARTICLE_MINIMUM = 500;
export const FLOW_PARTICLE_MAXIMUM = 400_000;
/** Above this, a mid-range GPU starts dropping frames on a large viewport. */
export const FLOW_PARTICLE_HEAVY = 120_000;

/**
 * A parametrized curve drawn over the field.
 *
 * Deliberately generated rather than drawn on our own canvas. Desmos draws
 * parametrics natively, and well — building a second renderer for something the
 * host already does would buy nothing, cost a line-strip pipeline, and produce
 * a curve that vanishes for anyone without the extension. This is the half of
 * the plugin where the right answer is to write an expression.
 *
 * Its `t` is the parametric's own, bound inside the expression. That is only
 * safe because a time-varying field is rewritten off `t` onto the field's clock
 * symbol first — the two would otherwise be the same letter meaning two things.
 */
export interface CurveConfig {
  enabled: boolean;
  xLatex: string;
  yLatex: string;
  tMin: number;
  tMax: number;
  color: string;
  lineWidth: number;
  /**
   * Draw a point at the curve's position at the current clock.
   *
   * Needs a clock, so switching this on is one of the two things that makes the
   * generated field carry one; the other is the field itself using `t`.
   */
  showPoint: boolean;
}

export const CURVE_LINE_WIDTH_MINIMUM = 1;
export const CURVE_LINE_WIDTH_MAXIMUM = 12;

/**
 * The animation clock, for a field written in terms of `t`.
 *
 * Persisted, but the clock's *position* is not: a graph reopened later starts
 * at zero. Where a time-varying field happens to be when you closed the tab is
 * not a property of the field, and restoring it would make the same graph open
 * differently every time.
 */
export interface TimeConfig {
  /** Whether the clock advances. */
  playing: boolean;
  /** Clock seconds per real second. */
  speed: number;
}

export const TIME_SPEED_MINIMUM = 0.05;
export const TIME_SPEED_MAXIMUM = 8;

/**
 * Which fluid the Fluid tab simulates. The liquid follows these two; it is a
 * different solver (`VECTOR_TOOLS_FLUID_RESEARCH_BRIEF.md` §8.0).
 */
export type FluidMode = "off" | "windTunnel" | "stirredBox";

/**
 * How fast the lattice runs at high Reynolds numbers (brief §8.1). Accurate is
 * the only setting measured safe from Re 10 to 2000. Lively keeps the faster
 * speed and badges any moment the flow is too fast to be accurate. Auto runs
 * fast while it can and slows the lattice the moment it cannot.
 */
export type FluidSpeedMode = "auto" | "accurate" | "lively";

/**
 * Whether the tab allows something it cannot yet do accurately, labelled, or
 * refuses it. Used for resizing an obstacle and for dragging one above Re 200
 * (brief §8.1).
 */
export type FluidGuardMode = "auto" | "strict";

/** What the tank is coloured by. */
export type FluidShow = "vorticity" | "speed" | "pressure";

/** The simulated rectangle, fixed in graph coordinates (brief §8.0). */
export interface FluidTank {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface FluidConfig {
  mode: FluidMode;
  tank: FluidTank;
  /** Lattice cells across the tank's width. The height follows its shape. */
  cellsAcross: number;
  reynolds: number;
  /** The speed of the incoming flow, in graph units per second. */
  inflowSpeed: number;
  /** The length the Reynolds number is measured against, in graph units. */
  referenceLength: number;
  speedMode: FluidSpeedMode;
  resizeMode: FluidGuardMode;
  dragMode: FluidGuardMode;
  show: FluidShow;
  /** Write measured values into the graph as variables. Opt-in (§8.0). */
  writeback: boolean;
  playing: boolean;
}

export const FLUID_CELLS_MINIMUM = 32;
export const FLUID_CELLS_MAXIMUM = 1024;
/**
 * The measured envelope: GPT's third round ran Re 10 and Re 2000 as the
 * slider's endpoints, and nothing outside them.
 */
export const FLUID_REYNOLDS_MINIMUM = 10;
export const FLUID_REYNOLDS_MAXIMUM = 2000;

/** Persisted panel geometry, so a resized panel stays resized. */
export interface PanelConfig {
  width: number;
  height: number;
  /** Section the panel opens on. */
  tab: PanelTab;
}

export type PanelTab =
  | "field"
  | "arrows"
  | "color"
  | "curve"
  | "flow"
  | "fluid";

export const PANEL_TABS: readonly { id: PanelTab; label: string }[] = [
  { id: "field", label: "Field" },
  { id: "arrows", label: "Arrows" },
  { id: "color", label: "Color" },
  { id: "curve", label: "Curve" },
  { id: "flow", label: "Flow" },
  { id: "fluid", label: "Fluid" },
];

export const PANEL_MIN_WIDTH = 320;
export const PANEL_MAX_WIDTH = 720;
export const PANEL_MIN_HEIGHT = 260;
export const PANEL_MAX_HEIGHT = 900;

export interface SamplingAxisConfig {
  min: number;
  max: number;
  mode: SamplingMode;
  step: number;
  count: number;
}

export interface VectorLengthConfig {
  mode: VectorLengthMode;
  autoLength: boolean;
  targetLength: number;
  scale: number;
  maximumLength: number;
  compression: number;
}

/**
 * The particle color mode that means the same thing as an arrow color mode.
 *
 * The two vocabularies are deliberately different sizes. An arrow is a vector
 * at a fixed point, so it can be colored by its x component or by a signed
 * magnitude; a particle is a moving dot whose only scalar is how fast it is
 * going. Every arrow mode that reads some measure of size therefore lands on
 * `speed`, and only direction and fixed survive as themselves.
 *
 * It lives here rather than in the panel because it is a fact about what the
 * modes mean, not about how the button that uses it is drawn.
 */
export function flowColorModeFor(mode: VectorColorMode): FlowColorMode {
  switch (mode) {
    case "direction":
      return "direction";
    case "fixed":
      return "fixed";
    default:
      return "speed";
  }
}

/**
 * The colours the flow is actually drawn with, once the match is accounted for.
 *
 * The single answer to that question, for the same reason `lengthInputsFor` is
 * the single answer to which length numbers a mode reads: the panel decides
 * what to show from it and the renderer decides what to draw from it, and if
 * those two disagreed the controls would describe a picture nobody is looking
 * at. Matching overrides rather than overwrites, so `config.flow` still holds
 * what the user last chose for themselves.
 */
export function effectiveFlowColor(config: VectorFieldConfig): {
  colorMode: FlowColorMode;
  palette: ColorPalette;
  saturation: number;
  contrast: number;
} {
  if (!config.color.matchFlow) {
    return {
      colorMode: config.flow.colorMode,
      palette: config.flow.palette,
      saturation: config.flow.saturation,
      contrast: config.flow.contrast,
    };
  }
  // Saturation and contrast come across with the ramp, because the checkbox
  // says "the same colors" and a flow that matched the palette while keeping
  // its own strength would not be the same colours. The flow's own pair is
  // left where it is, so unticking gives it back.
  return {
    colorMode: flowColorModeFor(config.color.mode),
    palette: config.color.palette,
    saturation: config.color.saturation,
    contrast: config.color.contrast,
  };
}

/**
 * Which of the four length numbers a mode actually reads.
 *
 * Both halves of the plugin scale a vector by the same factor — the shader's
 * `vtLengthFactor` and the generator's `factor` are the same five cases — and
 * every one of them leaves at least two of the numbers unread. Showing all four
 * whatever the mode is offers the user three controls that do nothing and gives
 * no clue which one is live, so the panel asks here instead.
 *
 * It lives beside the modes rather than in the panel because it is a fact about
 * what the modes mean, and a wrong answer hides a control the field depends on.
 */
export function lengthInputsFor(mode: VectorLengthMode): {
  targetLength: boolean;
  scale: boolean;
  maximumLength: boolean;
  compression: boolean;
} {
  const none = {
    targetLength: false,
    scale: false,
    maximumLength: false,
    compression: false,
  };
  switch (mode) {
    case "actual":
      return none;
    // Both draw every arrow the same length, and it is this one.
    case "normalized":
    case "direction-only":
      return { ...none, targetLength: true };
    case "scaled":
      return { ...none, scale: true };
    case "clamped":
      return { ...none, scale: true, maximumLength: true };
    case "compressed":
      return { ...none, scale: true, compression: true };
  }
}

export interface ArrowheadConfig {
  size: number;
  angleRadians: number;
}

export interface VectorColorConfig {
  mode: VectorColorMode;
  palette: ColorPalette;
  rangeMode: ColorRangeMode;
  minimum: number;
  maximum: number;
  fixedColor: string;
  /**
   * How far the arrows' colours are pushed once the ramp has been walked.
   *
   * See `ColorAdjust` in `field-rendering/palettes`, which owns the arithmetic
   * and applies it in all three places a ramp is emitted — the live arrows'
   * shader, the generated Desmos expressions, and the swatch in the picker, so
   * that the swatch shows what the field will actually look like.
   */
  saturation: number;
  contrast: number;
  /**
   * Whether the flow's colours follow the arrows'.
   *
   * A standing link rather than a copy, and that is the whole point: the flow's
   * own settings are left where they are and merely overridden while this is on,
   * so turning it off puts back what was there instead of leaving the user to
   * reconstruct it. A one-press copy could not be undone.
   */
  matchFlow: boolean;
  /**
   * Keep the field's own colours when the graph is in reverse contrast.
   *
   * Desmos's reverse contrast is `filter: invert(1)` on `.dcg-container`, which
   * is an ancestor of both overlay canvases — so by default the arrows and the
   * flow invert along with everything else, and a bright ramp on a dark graph
   * comes out dark. Switching this on inverts the overlays a second time, which
   * cancels the first, and leaves a dark graph with the field's real colours on
   * it.
   *
   * Off by default, because that is what a graph saved before this existed
   * already looks like.
   */
  keepColorsInReverseContrast: boolean;
}

export interface VectorFieldConfig {
  schemaVersion: number;
  id: string;
  name: string;
  /**
   * The letter this field's generated Desmos symbols are built from.
   *
   * See {@link SYMBOL_TOKENS}. Part of the saved field rather than worked out
   * on the fly, because the symbols are written into the user's graph and have
   * to keep meaning the same thing after another field is deleted.
   */
  symbolToken: string;
  source: FieldSource;
  components: {
    xLatex: string;
    yLatex: string;
  };
  /** The potential whose gradient is the field, used when source is gradient. */
  scalar: {
    fLatex: string;
  };
  domain: {
    x: SamplingAxisConfig;
    y: SamplingAxisConfig;
  };
  length: VectorLengthConfig;
  arrowhead: ArrowheadConfig;
  color: VectorColorConfig;
  zeroVectorMode: ZeroVectorMode;
  /** Whether the extension draws the arrows itself. */
  arrowMode: ArrowMode;
  /**
   * Whether the overlays are drawn over Desmos's graph or under it.
   *
   * One setting for both canvases rather than one each: they are two halves of
   * a single picture, and a field whose arrows floated above the axes while its
   * particles sat below them would be neither of the two things this chooses
   * between. See {@link OverlayLayer} for what each side costs.
   */
  overlayLayer: OverlayLayer;
  /**
   * Whether a grid too dense to read is sampled more coarsely before drawing.
   *
   * On by default, because matching the domain to a zoomed-out viewport asks
   * for hundreds of thousands of arrows by accident. Off draws every one of
   * them, which is the point of drawing them here rather than through Desmos.
   */
  arrowDensityLimit: boolean;
  flow: FlowConfig;
  curve: CurveConfig;
  time: TimeConfig;
  fluid: FluidConfig;
}

/**
 * Every field the user has saved, and which of them the panel is editing.
 *
 * The panel's own geometry lives here rather than on a field: dragging the
 * corner is not a property of the maths, and switching fields should not resize
 * the window. Everything else is per-field, including the clock — two fields
 * can be animating at different speeds and only one of them is being drawn.
 *
 * Only the active field is drawn. Generated Desmos expressions are another
 * matter: those are namespaced per field and stay in the graph, so a field can
 * be generated, set aside, and a second one generated beside it.
 */
export interface VectorFieldLibrary {
  schemaVersion: number;
  fields: VectorFieldConfig[];
  activeId: string;
  panel: PanelConfig;
  /**
   * Whether loading a gallery field also replaces the framing, the particle
   * settings and the arrow mode.
   *
   * Off by default. Those are settings somebody has usually spent time on, and
   * throwing them away because a new field was clicked is how a gallery
   * becomes something you stop clicking. The colours still come with the field,
   * because a palette built to run from near-black is not separable from the
   * dark it is meant to be drawn on.
   *
   * On the library rather than on a field, because it is a preference about
   * how the gallery behaves rather than a property of any particular field.
   */
  galleryWithLook: boolean;
}

export interface ValidationIssue {
  level: "error" | "warning";
  message: string;
}

export interface VectorFieldValidation {
  estimatedVectorCount: number;
  issues: ValidationIssue[];
  canGenerate: boolean;
  requiresConfirmation: boolean;
}

export interface DensityPreset {
  id: "small" | "medium" | "large" | "warning";
  name: string;
  xCount: number;
  yCount: number;
}

export interface ProbeDefinition {
  point: readonly [number, number];
  expected: readonly [number, number];
}

export interface VectorFieldPreset {
  id:
    | "rotational"
    | "radial"
    | "inward-radial"
    | "saddle"
    | "uniform"
    | "vertical-uniform"
    | "nonlinear-trigonometric"
    | "zero"
    | "vortex-decay"
    | "mixed-magnitude";
  name: string;
  xLatex: string;
  yLatex: string;
  probes: readonly ProbeDefinition[];
}

const DEFAULT_AXIS_X: SamplingAxisConfig = {
  min: -10,
  max: 10,
  mode: "step",
  step: 1,
  count: 21,
};

const DEFAULT_AXIS_Y: SamplingAxisConfig = {
  min: -6,
  max: 6,
  mode: "step",
  step: 1,
  count: 13,
};

/**
 * Big enough that the Field tab fits without scrolling.
 *
 * Measured rather than guessed: at 620 the sampling cards were 25px past the
 * fold, which is the worst height to pick — enough to hide a control, not
 * enough to look deliberate. The old default was 420×560, from before the tab
 * held a field chooser or two axis cards.
 */
export const DEFAULT_PANEL_CONFIG: PanelConfig = {
  width: 460,
  height: 650,
  tab: "field",
};

export const DEFAULT_VECTOR_FIELD_CONFIG: VectorFieldConfig = {
  schemaVersion: VECTOR_FIELD_SCHEMA_VERSION,
  id: "default",
  name: "Vector Field",
  // See SYMBOL_TOKENS: `d` is first so a migrated setting keeps the symbols
  // it has already written into saved graphs.
  symbolToken: "d",
  source: "components",
  components: { xLatex: "-y", yLatex: "x" },
  // ∇(x²+y²) = (2x, 2y): a radial field that is obviously the gradient of the
  // bowl it comes from, so switching to gradient mode shows something legible.
  scalar: { fLatex: "x^{2}+y^{2}" },
  domain: { x: DEFAULT_AXIS_X, y: DEFAULT_AXIS_Y },
  length: {
    mode: "normalized",
    autoLength: true,
    targetLength: 0.7,
    scale: 0.25,
    maximumLength: 1.25,
    compression: 1,
  },
  arrowhead: { size: 0.18, angleRadians: 0.55 },
  color: {
    mode: "magnitude",
    palette: "spectral",
    rangeMode: "automatic",
    minimum: 0,
    maximum: 1,
    fixedColor: "#6042a6",
    saturation: 1,
    contrast: 1,
    matchFlow: false,
    keepColorsInReverseContrast: false,
  },
  zeroVectorMode: "hide",
  arrowMode: "live",
  // Under the graph, so a plotted function reads at full contrast on top of
  // the field rather than being covered by it. The arrows lose a little
  // against the grid lines for it, which is the trade `OverlayLayer` sets out.
  overlayLayer: "under",
  arrowDensityLimit: true,
  // Deliberately restrained: the flow is drawn on top of the graph paper, so
  // the defaults have to leave the axes and expressions legible underneath.
  flow: {
    particleCount: 16_000,
    speed: 1,
    trailPersistence: 0.95,
    dropRate: 0.01,
    opacity: 0.42,
    pointSize: 2,
    glow: 0.45,
    glowEnabled: true,
    backdropEnabled: false,
    backdropColor: "#080b18",
    backdropOpacity: 0.92,
    colorMode: "speed",
    palette: "spectral",
    saturation: 1,
    contrast: 1,
    look: "streamlines",
    normalizeSpeed: true,
    renderScale: 1,
  },
  curve: {
    enabled: false,
    // The unit circle, so switching the curve on draws something recognisable
    // rather than nothing.
    xLatex: "\\cos\\left(t\\right)",
    yLatex: "\\sin\\left(t\\right)",
    tMin: 0,
    tMax: 6.283185307179586,
    color: "#c74440",
    lineWidth: 2.5,
    showPoint: true,
  },
  time: { playing: true, speed: 1 },
  // A tank the shape of the mock-up's 300 × 120 lattice, over the default
  // sampling domain's width. Off until somebody chooses a fluid.
  fluid: {
    mode: "off",
    tank: { xMin: -10, xMax: 10, yMin: -4, yMax: 4 },
    cellsAcross: 300,
    reynolds: 100,
    inflowSpeed: 2,
    referenceLength: 1,
    speedMode: "auto",
    resizeMode: "auto",
    dragMode: "auto",
    // Vorticity, because it is what shedding looks like: the wake's
    // alternating vortices are invisible in speed and faint in pressure.
    show: "vorticity",
    writeback: false,
    playing: true,
  },
};

export const DENSITY_PRESETS: readonly DensityPreset[] = [
  { id: "small", name: "Small", xCount: 20, yCount: 12 },
  { id: "medium", name: "Medium", xCount: 40, yCount: 24 },
  { id: "large", name: "Large", xCount: 50, yCount: 30 },
  { id: "warning", name: "Warning", xCount: 52, yCount: 50 },
];

export const VECTOR_FIELD_PRESETS: readonly VectorFieldPreset[] = [
  {
    id: "rotational",
    name: "Rotational",
    xLatex: "-y",
    yLatex: "x",
    probes: [
      { point: [1, 0], expected: [0, 1] },
      { point: [0, 1], expected: [-1, 0] },
      { point: [-1, 0], expected: [0, -1] },
      { point: [0, -1], expected: [1, 0] },
    ],
  },
  {
    id: "radial",
    name: "Radial",
    xLatex: "x",
    yLatex: "y",
    probes: [
      { point: [1, 0], expected: [1, 0] },
      { point: [0, 1], expected: [0, 1] },
      { point: [-1, 0], expected: [-1, 0] },
    ],
  },
  {
    id: "inward-radial",
    name: "Inward Radial",
    xLatex: "-x",
    yLatex: "-y",
    probes: [
      { point: [1, 0], expected: [-1, 0] },
      { point: [0, 1], expected: [0, -1] },
    ],
  },
  {
    id: "saddle",
    name: "Saddle",
    xLatex: "x",
    yLatex: "-y",
    probes: [
      { point: [1, 0], expected: [1, 0] },
      { point: [0, 1], expected: [0, -1] },
    ],
  },
  {
    id: "uniform",
    name: "Uniform",
    xLatex: "1",
    yLatex: "0",
    probes: [
      { point: [0, 0], expected: [1, 0] },
      { point: [5, -3], expected: [1, 0] },
    ],
  },
  {
    id: "vertical-uniform",
    name: "Vertical Uniform",
    xLatex: "0",
    yLatex: "1",
    probes: [{ point: [0, 0], expected: [0, 1] }],
  },
  {
    id: "nonlinear-trigonometric",
    name: "Nonlinear Trigonometric",
    xLatex: "\\sin(y)",
    yLatex: "\\cos(x)",
    probes: [{ point: [0, 0], expected: [0, 1] }],
  },
  {
    id: "zero",
    name: "Zero",
    xLatex: "0",
    yLatex: "0",
    probes: [{ point: [0, 0], expected: [0, 0] }],
  },
  {
    id: "vortex-decay",
    name: "Vortex With Decay",
    xLatex: "-y/(1+x^2+y^2)",
    yLatex: "x/(1+x^2+y^2)",
    probes: [{ point: [1, 0], expected: [0, 0.5] }],
  },
  {
    id: "mixed-magnitude",
    name: "Mixed Magnitude",
    xLatex: "10x",
    yLatex: "y",
    probes: [{ point: [1, 0], expected: [10, 0] }],
  },
];

export function cloneDefaultConfig(): VectorFieldConfig {
  return {
    ...DEFAULT_VECTOR_FIELD_CONFIG,
    components: { ...DEFAULT_VECTOR_FIELD_CONFIG.components },
    scalar: { ...DEFAULT_VECTOR_FIELD_CONFIG.scalar },
    domain: {
      x: { ...DEFAULT_VECTOR_FIELD_CONFIG.domain.x },
      y: { ...DEFAULT_VECTOR_FIELD_CONFIG.domain.y },
    },
    length: { ...DEFAULT_VECTOR_FIELD_CONFIG.length },
    arrowhead: { ...DEFAULT_VECTOR_FIELD_CONFIG.arrowhead },
    color: { ...DEFAULT_VECTOR_FIELD_CONFIG.color },
    flow: { ...DEFAULT_VECTOR_FIELD_CONFIG.flow },
    curve: { ...DEFAULT_VECTOR_FIELD_CONFIG.curve },
    time: { ...DEFAULT_VECTOR_FIELD_CONFIG.time },
    fluid: {
      ...DEFAULT_VECTOR_FIELD_CONFIG.fluid,
      tank: { ...DEFAULT_VECTOR_FIELD_CONFIG.fluid.tank },
    },
  };
}

export function cloneDefaultLibrary(): VectorFieldLibrary {
  const field = cloneDefaultConfig();
  return {
    schemaVersion: VECTOR_FIELD_SCHEMA_VERSION,
    fields: [field],
    activeId: field.id,
    panel: { ...DEFAULT_PANEL_CONFIG },
    galleryWithLook: false,
  };
}

/**
 * The field the panel is editing.
 *
 * Never undefined: a library that somehow lost its active field falls back to
 * the first one rather than leaving the panel with nothing to show, and
 * `normalizeVectorFieldLibrary` guarantees there is always a first one.
 */
export function activeField(library: VectorFieldLibrary): VectorFieldConfig {
  return (
    library.fields.find((field) => field.id === library.activeId) ??
    library.fields[0]
  );
}

/** A token no field in the library is using, or undefined when all are taken. */
export function nextSymbolToken(
  library: VectorFieldLibrary
): string | undefined {
  const taken = new Set(library.fields.map((field) => field.symbolToken));
  return SYMBOL_TOKENS.find((token) => !taken.has(token));
}

/** An id no field is using. Ids reach Desmos as part of an expression id. */
export function nextFieldID(library: VectorFieldLibrary): string {
  const taken = new Set(library.fields.map((field) => field.id));
  for (let index = 1; ; index += 1) {
    const candidate = `field${index}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/**
 * A name nothing else is called.
 *
 * Duplicating a field twice should give two distinguishable things in the
 * chooser; two rows both reading "Vector Field copy" is a chooser that cannot
 * be used.
 */
export function uniqueFieldName(
  library: VectorFieldLibrary,
  base: string
): string {
  const taken = new Set(library.fields.map((field) => field.name));
  if (!taken.has(base)) return base;
  for (let index = 2; ; index += 1) {
    const candidate = `${base} ${index}`;
    if (!taken.has(candidate)) return candidate;
  }
}

export function getAxisSampleCount(axis: SamplingAxisConfig): number {
  if (axis.mode === "count") return axis.count;
  if (!Number.isFinite(axis.step) || axis.step <= 0) return 0;
  const span = axis.max - axis.min;
  if (!Number.isFinite(span) || span < 0) return 0;
  return Math.floor(span / axis.step + 1e-10) + 1;
}

export function getAxisSpacing(axis: SamplingAxisConfig): number {
  return axis.mode === "count"
    ? (axis.max - axis.min) / (axis.count - 1)
    : axis.step;
}

export function estimateVectorCount(config: VectorFieldConfig): number {
  return (
    getAxisSampleCount(config.domain.x) * getAxisSampleCount(config.domain.y)
  );
}

export function validateVectorFieldConfig(
  config: VectorFieldConfig
): VectorFieldValidation {
  const issues: ValidationIssue[] = [];
  // Only the source in use is validated, so an unused P or f cannot block
  // generating the field the user is actually looking at.
  if (config.source === "gradient") {
    validateComponent(config.scalar.fLatex, "f(x,y)", issues);
  } else {
    validateComponent(config.components.xLatex, "P(x,y)", issues);
    validateComponent(config.components.yLatex, "Q(x,y)", issues);
  }
  validateAxis(config.domain.x, "x", issues);
  validateAxis(config.domain.y, "y", issues);
  // Only when it is switched on: a curve nobody asked for must not be able to
  // stop the field being generated.
  if (config.curve.enabled) {
    validateComponent(config.curve.xLatex, "X(t)", issues);
    validateComponent(config.curve.yLatex, "Y(t)", issues);
    if (
      !Number.isFinite(config.curve.tMin) ||
      !Number.isFinite(config.curve.tMax) ||
      config.curve.tMax <= config.curve.tMin
    ) {
      issues.push({
        level: "error",
        message: "The curve's t maximum must exceed its minimum.",
      });
    }
  }
  validateFinitePositive(config.length.targetLength, "Target length", issues);
  validateFinitePositive(config.length.scale, "Length scale", issues);
  validateFinitePositive(config.length.maximumLength, "Maximum length", issues);
  validateFinitePositive(config.length.compression, "Compression", issues);
  validateFinitePositive(config.arrowhead.size, "Arrowhead size", issues);
  if (
    !Number.isFinite(config.arrowhead.angleRadians) ||
    config.arrowhead.angleRadians <= 0 ||
    config.arrowhead.angleRadians >= Math.PI / 2
  ) {
    issues.push({
      level: "error",
      message: "Arrowhead angle must be between 0 and π/2.",
    });
  }
  if (!/^#(?:[\dA-Fa-f]{3}|[\dA-Fa-f]{6})$/.test(config.color.fixedColor)) {
    issues.push({
      level: "error",
      message: "Fixed color must be a hex color.",
    });
  }
  if (
    config.color.rangeMode === "manual" &&
    (!Number.isFinite(config.color.minimum) ||
      !Number.isFinite(config.color.maximum) ||
      config.color.maximum <= config.color.minimum)
  ) {
    issues.push({
      level: "error",
      message: "Manual color maximum must be greater than the minimum.",
    });
  }

  const estimatedVectorCount = estimateVectorCount(config);
  if (estimatedVectorCount > VECTOR_COUNT_HARD_MAXIMUM) {
    issues.push({
      level: "error",
      message: `Vector count exceeds the hard maximum of ${VECTOR_COUNT_HARD_MAXIMUM.toLocaleString()}.`,
    });
  } else if (estimatedVectorCount > VECTOR_COUNT_WARNING) {
    issues.push({
      level: "warning",
      message: `Generating ${estimatedVectorCount.toLocaleString()} vectors requires confirmation.`,
    });
  } else if (estimatedVectorCount > 1_000) {
    issues.push({
      level: "warning",
      message: "Large fields can reduce Desmos responsiveness.",
    });
  }

  return {
    estimatedVectorCount,
    issues,
    canGenerate: issues.every((issue) => issue.level !== "error"),
    requiresConfirmation:
      estimatedVectorCount > VECTOR_COUNT_WARNING &&
      estimatedVectorCount <= VECTOR_COUNT_HARD_MAXIMUM,
  };
}

export function normalizeVectorFieldConfig(value: unknown): VectorFieldConfig {
  const fallback = cloneDefaultConfig();
  if (!isRecord(value)) return fallback;
  const components = asRecord(value.components);
  const scalar = asRecord(value.scalar);
  const domain = asRecord(value.domain);
  const length = asRecord(value.length);
  const arrowhead = asRecord(value.arrowhead);
  const color = asRecord(value.color);
  const config: VectorFieldConfig = {
    ...fallback,
    schemaVersion: VECTOR_FIELD_SCHEMA_VERSION,
    id: validID(value.id) ? value.id : fallback.id,
    name: validString(value.name) ? value.name : fallback.name,
    symbolToken: SYMBOL_TOKENS.includes(
      value.symbolToken as (typeof SYMBOL_TOKENS)[number]
    )
      ? (value.symbolToken as string)
      : fallback.symbolToken,
    // Schema 2 and earlier had no source; those configs are all component
    // fields, which is exactly what the fallback says.
    source: value.source === "gradient" ? "gradient" : fallback.source,
    scalar: {
      fLatex:
        typeof scalar?.fLatex === "string"
          ? scalar.fLatex
          : fallback.scalar.fLatex,
    },
    components: {
      xLatex:
        typeof components?.xLatex === "string"
          ? components.xLatex
          : fallback.components.xLatex,
      yLatex:
        typeof components?.yLatex === "string"
          ? components.yLatex
          : fallback.components.yLatex,
    },
    domain: {
      x: normalizeAxis(domain?.x, fallback.domain.x),
      y: normalizeAxis(domain?.y, fallback.domain.y),
    },
    length: {
      mode: isLengthMode(length?.mode) ? length.mode : fallback.length.mode,
      autoLength:
        typeof length?.autoLength === "boolean"
          ? length.autoLength
          : fallback.length.autoLength,
      targetLength: finiteOr(
        length?.targetLength,
        fallback.length.targetLength
      ),
      scale: finiteOr(length?.scale, fallback.length.scale),
      maximumLength: finiteOr(
        length?.maximumLength,
        fallback.length.maximumLength
      ),
      compression: finiteOr(length?.compression, fallback.length.compression),
    },
    arrowhead: {
      size: finiteOr(arrowhead?.size, fallback.arrowhead.size),
      angleRadians: finiteOr(
        arrowhead?.angleRadians,
        fallback.arrowhead.angleRadians
      ),
    },
    color: {
      mode: isColorMode(color?.mode) ? color.mode : fallback.color.mode,
      palette: isPalette(color?.palette)
        ? color.palette
        : fallback.color.palette,
      // `visible` and `domain` were the two boxes the range used to be
      // measured over; neither is measured any more.
      rangeMode: color?.rangeMode === "manual" ? "manual" : "automatic",
      minimum: finiteOr(color?.minimum, fallback.color.minimum),
      maximum: finiteOr(color?.maximum, fallback.color.maximum),
      fixedColor:
        typeof color?.fixedColor === "string"
          ? color.fixedColor
          : fallback.color.fixedColor,
      saturation: clampNumber(
        color?.saturation,
        fallback.color.saturation,
        COLOR_SATURATION_MINIMUM,
        COLOR_SATURATION_MAXIMUM
      ),
      contrast: clampNumber(
        color?.contrast,
        fallback.color.contrast,
        COLOR_CONTRAST_MINIMUM,
        COLOR_CONTRAST_MAXIMUM
      ),
      matchFlow:
        typeof color?.matchFlow === "boolean"
          ? color.matchFlow
          : fallback.color.matchFlow,
      keepColorsInReverseContrast:
        typeof color?.keepColorsInReverseContrast === "boolean"
          ? color.keepColorsInReverseContrast
          : fallback.color.keepColorsInReverseContrast,
    },
    zeroVectorMode: value.zeroVectorMode === "point" ? "point" : "hide",
    arrowMode:
      value.arrowMode === "desmos" || value.arrowMode === "off"
        ? value.arrowMode
        : "live",
    arrowDensityLimit: value.arrowDensityLimit !== false,
    // A field saved before this setting existed takes the default, which is
    // under the graph — the same as a new one, so there is not a version of
    // Vector Tools whose fields look different depending on when they were
    // first saved. A stored "over" is somebody's answer and is kept.
    overlayLayer:
      value.overlayLayer === "over" ? "over" : fallback.overlayLayer,
    flow: normalizeFlow(value.flow, fallback.flow),
    curve: normalizeCurve(value.curve, fallback.curve),
    time: normalizeTime(value.time, fallback.time),
    fluid: normalizeFluid(value.fluid, fallback.fluid),
  };
  return config;
}

/**
 * Brings any stored value up to the current library schema.
 *
 * Accepts a bare field as well as a library, because that is what every setting
 * saved before this existed contains — schema 3 stored one `VectorFieldConfig`
 * at the top level. Such a value is wrapped into a one-field library, keeping
 * its id and its symbol token, so the expressions it has already generated into
 * the user's graphs stay recognisable and removable.
 *
 * Nothing here throws. A library that cannot be read is one the user cannot get
 * back to, and losing a saved field is worse than restoring a default.
 */
export function normalizeVectorFieldLibrary(
  value: unknown
): VectorFieldLibrary {
  const fallback = cloneDefaultLibrary();
  if (!isRecord(value)) return fallback;

  const stored = Array.isArray(value.fields) ? value.fields : undefined;
  // A pre-library setting is one field, stored where the library now goes.
  const fields = (stored ?? [value]).map((field) =>
    normalizeVectorFieldConfig(field)
  );
  if (fields.length === 0) fields.push(cloneDefaultConfig());

  // Ids and tokens both have to be unique, and a stored file that somehow
  // repeats one would otherwise produce two fields writing over each other's
  // expressions. Later duplicates are moved rather than dropped: the field is
  // still the user's, and only its addressing is wrong.
  const usedIDs = new Set<string>();
  const usedTokens = new Set<string>();
  for (const field of fields) {
    if (usedIDs.has(field.id)) {
      let index = 1;
      while (usedIDs.has(`field${index}`)) index += 1;
      field.id = `field${index}`;
    }
    usedIDs.add(field.id);
    if (usedTokens.has(field.symbolToken)) {
      const free = SYMBOL_TOKENS.find((token) => !usedTokens.has(token));
      // Past the end of the alphabet two fields share a token, which collides
      // only if both are generated into the same graph. Dropping the field
      // would be the worse of the two outcomes.
      field.symbolToken = free ?? field.symbolToken;
    }
    usedTokens.add(field.symbolToken);
  }

  const trimmed = fields.slice(0, MAX_FIELDS);
  const activeId =
    validID(value.activeId) && trimmed.some((f) => f.id === value.activeId)
      ? value.activeId
      : trimmed[0].id;
  return {
    schemaVersion: VECTOR_FIELD_SCHEMA_VERSION,
    fields: trimmed,
    activeId,
    panel: normalizePanel(value.panel, fallback.panel),
    galleryWithLook: value.galleryWithLook === true,
  };
}

function normalizeCurve(value: unknown, fallback: CurveConfig): CurveConfig {
  const curve = asRecord(value);
  const text = (key: keyof CurveConfig, from: string) => {
    const stored = curve?.[key];
    return typeof stored === "string" ? stored : from;
  };
  return {
    enabled: typeof curve?.enabled === "boolean" ? curve.enabled : false,
    xLatex: text("xLatex", fallback.xLatex),
    yLatex: text("yLatex", fallback.yLatex),
    tMin: finiteOr(curve?.tMin, fallback.tMin),
    tMax: finiteOr(curve?.tMax, fallback.tMax),
    color: text("color", fallback.color),
    lineWidth: clampNumber(
      curve?.lineWidth,
      fallback.lineWidth,
      CURVE_LINE_WIDTH_MINIMUM,
      CURVE_LINE_WIDTH_MAXIMUM
    ),
    showPoint:
      typeof curve?.showPoint === "boolean"
        ? curve.showPoint
        : fallback.showPoint,
  };
}

function normalizeTime(value: unknown, fallback: TimeConfig): TimeConfig {
  const time = asRecord(value);
  return {
    playing:
      typeof time?.playing === "boolean" ? time.playing : fallback.playing,
    speed: clampNumber(
      time?.speed,
      fallback.speed,
      TIME_SPEED_MINIMUM,
      TIME_SPEED_MAXIMUM
    ),
  };
}

/**
 * Keys in the order of `DEFAULT_VECTOR_FIELD_CONFIG.fluid`, for the same reason
 * as `normalizeFlow`: the stored library is compared with its own JSON.
 *
 * A tank that is not a real rectangle falls back whole rather than corner by
 * corner, because a tank with one corner from the user and three from the
 * default is a shape nobody chose.
 */
function normalizeFluid(value: unknown, fallback: FluidConfig): FluidConfig {
  const fluid = asRecord(value);
  const tank = asRecord(fluid?.tank);
  const corners = [tank?.xMin, tank?.xMax, tank?.yMin, tank?.yMax];
  const validTank =
    corners.every((c) => typeof c === "number" && Number.isFinite(c)) &&
    (tank!.xMax as number) > (tank!.xMin as number) &&
    (tank!.yMax as number) > (tank!.yMin as number);
  const isGuard = (mode: unknown): mode is FluidGuardMode =>
    mode === "auto" || mode === "strict";
  return {
    mode:
      fluid?.mode === "windTunnel" || fluid?.mode === "stirredBox"
        ? fluid.mode
        : "off",
    tank: validTank
      ? {
          xMin: tank!.xMin as number,
          xMax: tank!.xMax as number,
          yMin: tank!.yMin as number,
          yMax: tank!.yMax as number,
        }
      : { ...fallback.tank },
    cellsAcross: Math.round(
      clampNumber(
        fluid?.cellsAcross,
        fallback.cellsAcross,
        FLUID_CELLS_MINIMUM,
        FLUID_CELLS_MAXIMUM
      )
    ),
    reynolds: clampNumber(
      fluid?.reynolds,
      fallback.reynolds,
      FLUID_REYNOLDS_MINIMUM,
      FLUID_REYNOLDS_MAXIMUM
    ),
    inflowSpeed: clampNumber(
      fluid?.inflowSpeed,
      fallback.inflowSpeed,
      1e-3,
      1e3
    ),
    referenceLength: clampNumber(
      fluid?.referenceLength,
      fallback.referenceLength,
      1e-6,
      1e6
    ),
    speedMode:
      fluid?.speedMode === "accurate" || fluid?.speedMode === "lively"
        ? fluid.speedMode
        : "auto",
    resizeMode: isGuard(fluid?.resizeMode) ? fluid.resizeMode : "auto",
    dragMode: isGuard(fluid?.dragMode) ? fluid.dragMode : "auto",
    show:
      fluid?.show === "speed" || fluid?.show === "pressure"
        ? fluid.show
        : "vorticity",
    writeback: fluid?.writeback === true,
    playing: fluid?.playing !== false,
  };
}

/**
 * The lattice the tank holds: `cellsAcross` along x, and as many along y as
 * keep the cells square, at least eight.
 */
export function fluidLatticeSize(fluid: FluidConfig): {
  nx: number;
  ny: number;
} {
  const { tank, cellsAcross } = fluid;
  const aspect = (tank.yMax - tank.yMin) / (tank.xMax - tank.xMin);
  return {
    nx: cellsAcross,
    ny: Math.max(8, Math.round(cellsAcross * aspect)),
  };
}

function normalizePanel(value: unknown, fallback: PanelConfig): PanelConfig {
  const panel = asRecord(value);
  return {
    width: Math.round(
      clampNumber(
        panel?.width,
        fallback.width,
        PANEL_MIN_WIDTH,
        PANEL_MAX_WIDTH
      )
    ),
    height: Math.round(
      clampNumber(
        panel?.height,
        fallback.height,
        PANEL_MIN_HEIGHT,
        PANEL_MAX_HEIGHT
      )
    ),
    tab: PANEL_TABS.some((tab) => tab.id === panel?.tab)
      ? (panel?.tab as PanelTab)
      : fallback.tab,
  };
}

/**
 * The keys come out in the same order as `DEFAULT_VECTOR_FIELD_CONFIG.flow`,
 * and that is load-bearing rather than tidiness: the stored library is compared
 * against its own JSON on every enable, and two objects with the same values in
 * a different order are two different strings. Reordering this writes a setting
 * on every page load.
 */
function normalizeFlow(value: unknown, fallback: FlowConfig): FlowConfig {
  const flow = asRecord(value);
  // Schema 2 stored a texture edge length rather than a count.
  const legacyResolution = flow?.particleResolution;
  const legacyCount =
    typeof legacyResolution === "number" && Number.isFinite(legacyResolution)
      ? legacyResolution * legacyResolution
      : undefined;
  return {
    particleCount: Math.round(
      clampNumber(
        flow?.particleCount ?? legacyCount,
        fallback.particleCount,
        FLOW_PARTICLE_MINIMUM,
        FLOW_PARTICLE_MAXIMUM
      )
    ),
    speed: clampNumber(flow?.speed, fallback.speed, 0.05, 8),
    trailPersistence: clampNumber(
      flow?.trailPersistence,
      fallback.trailPersistence,
      0,
      0.995
    ),
    dropRate: clampNumber(flow?.dropRate, fallback.dropRate, 0, 0.2),
    opacity: clampNumber(flow?.opacity, fallback.opacity, 0.05, 1),
    pointSize: clampNumber(flow?.pointSize, fallback.pointSize, 0.5, 6),
    glow: clampNumber(flow?.glow, fallback.glow, 0, 1),
    glowEnabled: flow?.glowEnabled !== false,
    backdropEnabled: flow?.backdropEnabled === true,
    backdropColor:
      typeof flow?.backdropColor === "string" &&
      /^#[0-9a-fA-F]{6}$/.test(flow.backdropColor)
        ? flow.backdropColor
        : fallback.backdropColor,
    backdropOpacity: clampNumber(
      flow?.backdropOpacity,
      fallback.backdropOpacity,
      0,
      1
    ),
    colorMode: isFlowColorMode(flow?.colorMode)
      ? flow.colorMode
      : fallback.colorMode,
    palette: isPalette(flow?.palette) ? flow.palette : fallback.palette,
    saturation: clampNumber(
      flow?.saturation,
      fallback.saturation,
      COLOR_SATURATION_MINIMUM,
      COLOR_SATURATION_MAXIMUM
    ),
    contrast: clampNumber(
      flow?.contrast,
      fallback.contrast,
      COLOR_CONTRAST_MINIMUM,
      COLOR_CONTRAST_MAXIMUM
    ),
    look:
      flow?.look === "streamlines" || flow?.look === "texture"
        ? flow.look
        : fallback.look,
    normalizeSpeed:
      typeof flow?.normalizeSpeed === "boolean"
        ? flow.normalizeSpeed
        : fallback.normalizeSpeed,
    renderScale: clampNumber(
      flow?.renderScale,
      fallback.renderScale,
      FLOW_RENDER_SCALE_MINIMUM,
      1
    ),
  };
}

function clampNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number
) {
  return Math.min(max, Math.max(min, finiteOr(value, fallback)));
}

function isFlowColorMode(value: unknown): value is FlowColorMode {
  return ["fixed", "speed", "direction"].includes(value as string);
}

export function configForPreset(
  preset: VectorFieldPreset,
  density: DensityPreset,
  lengthMode: VectorLengthMode,
  colorMode: VectorColorMode
): VectorFieldConfig {
  const config = cloneDefaultConfig();
  config.id = "test";
  config.name = `Test — ${preset.name}`;
  config.components = { xLatex: preset.xLatex, yLatex: preset.yLatex };
  config.domain.x = {
    ...config.domain.x,
    mode: "count",
    count: density.xCount,
  };
  config.domain.y = {
    ...config.domain.y,
    mode: "count",
    count: density.yCount,
  };
  config.length.mode = lengthMode;
  config.color.mode = colorMode;
  if (colorMode === "direction") config.color.palette = "direction-hue";
  return config;
}

export function isDevelopmentBuild(value: boolean = DEV_BUILD): boolean {
  return value;
}

function validateComponent(
  latex: string,
  name: string,
  issues: ValidationIssue[]
) {
  const trimmed = latex.trim();
  if (trimmed.length === 0) {
    issues.push({ level: "error", message: `${name} cannot be empty.` });
  } else if (isClearlyIncomplete(trimmed)) {
    issues.push({ level: "error", message: `${name} appears incomplete.` });
  } else if (containsTopLevelAssignment(trimmed)) {
    issues.push({
      level: "error",
      message: `${name} must be a scalar component, not an assignment.`,
    });
  } else if (isTopLevelVector(trimmed)) {
    issues.push({
      level: "error",
      message: `${name} must be scalar, not a vector.`,
    });
  }
}

function validateAxis(
  axis: SamplingAxisConfig,
  label: string,
  issues: ValidationIssue[]
) {
  if (
    !Number.isFinite(axis.min) ||
    !Number.isFinite(axis.max) ||
    axis.max <= axis.min
  ) {
    issues.push({
      level: "error",
      message: `${label} maximum must exceed minimum.`,
    });
  }
  if (axis.mode === "step") {
    if (!Number.isFinite(axis.step) || axis.step <= 0) {
      issues.push({
        level: "error",
        message: `${label} step must be finite and greater than zero.`,
      });
    }
  } else if (!Number.isInteger(axis.count) || axis.count < 2) {
    issues.push({
      level: "error",
      message: `${label} count must be an integer of at least 2.`,
    });
  }
}

function validateFinitePositive(
  value: number,
  label: string,
  issues: ValidationIssue[]
) {
  if (!Number.isFinite(value) || value <= 0) {
    issues.push({
      level: "error",
      message: `${label} must be finite and greater than zero.`,
    });
  }
}

function isClearlyIncomplete(latex: string) {
  return (
    /[=+\-*/^,(]$/.test(latex) ||
    !balanced(latex, "(", ")") ||
    !balanced(latex, "{", "}")
  );
}

function balanced(value: string, opening: string, closing: string) {
  let depth = 0;
  for (const char of value) {
    if (char === opening) depth++;
    if (char === closing) depth--;
    if (depth < 0) return false;
  }
  return depth === 0;
}

function containsTopLevelAssignment(value: string) {
  return containsTopLevel(value, "=");
}

function isTopLevelVector(value: string) {
  return (
    value.startsWith("(") &&
    value.endsWith(")") &&
    containsTopLevel(value.slice(1, -1), ",")
  );
}

function containsTopLevel(value: string, needle: string) {
  let depth = 0;
  for (const char of value) {
    if (char === "(" || char === "{") depth++;
    if (char === ")" || char === "}") depth--;
    if (char === needle && depth === 0) return true;
  }
  return false;
}

function normalizeAxis(
  value: unknown,
  fallback: SamplingAxisConfig
): SamplingAxisConfig {
  return {
    min: finiteOr(asRecord(value)?.min, fallback.min),
    max: finiteOr(asRecord(value)?.max, fallback.max),
    mode: asRecord(value)?.mode === "count" ? "count" : "step",
    step: finiteOr(asRecord(value)?.step, fallback.step),
    count: finiteOr(asRecord(value)?.count, fallback.count),
  };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function finiteOr(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function validString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function validID(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z][A-Za-z0-9_]*$/.test(value);
}

function isLengthMode(value: unknown): value is VectorLengthMode {
  return [
    "actual",
    "normalized",
    "scaled",
    "clamped",
    "compressed",
    "direction-only",
  ].includes(value as string);
}

function isColorMode(value: unknown): value is VectorColorMode {
  return [
    "fixed",
    "magnitude",
    "log-magnitude",
    "direction",
    "x-component",
    "y-component",
  ].includes(value as string);
}

function isPalette(value: unknown): value is ColorPalette {
  return (PALETTE_IDS as string[]).includes(value as string);
}
