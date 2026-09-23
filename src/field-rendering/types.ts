/**
 * The vocabulary the renderers share with whatever configures them.
 *
 * These four unions used to live in Vector Tools' `model.ts`, which made a
 * renderer depend on one plugin's configuration format in order to name a
 * length mode. They are not configuration: they are the set of behaviours the
 * shaders actually implement, and the shader is the reason each list has the
 * members it has. Vector Tools still re-exports them, so nothing that read them
 * from `model` had to change.
 */

/**
 * How a vector's drawn length relates to its magnitude.
 *
 * `direction-only` is not a degenerate case of the others — it draws every
 * arrow the same length, which is the right picture when only the direction
 * carries information, and it is what a slope field is.
 */
export type VectorLengthMode =
  | "actual"
  | "normalized"
  | "scaled"
  | "clamped"
  | "compressed"
  | "direction-only";

export type VectorColorMode =
  | "fixed"
  | "magnitude"
  | "log-magnitude"
  | "direction"
  | "x-component"
  | "y-component";

/**
 * Whether the colour ramp follows the viewport or a range the user fixed.
 *
 * `automatic` is the saturating ramp described in the briefing, not a measured
 * minimum and maximum — see VECTOR_TOOLS_BRIEFING.md §6.1 for why measuring
 * loses to a single pole.
 */
export type ColorRangeMode = "automatic" | "manual";

export type FlowColorMode = "fixed" | "speed" | "direction";

/**
 * Where an overlay's canvas sits relative to Desmos's own graph canvas.
 *
 * Not a cosmetic choice. `canvas.dcg-graph-inner` is transparent except where
 * Desmos has drawn something — the white a graph appears to have comes from an
 * ancestor, not from the canvas — so an overlay inserted *before* it is covered
 * by the grid, the axes, the labels and every plotted curve, while one inserted
 * after covers all of them.
 *
 * `"over"` is what these overlays did for their whole history, and it is the
 * right answer for arrows you want to read against the graph paper. `"under"`
 * is the answer when the field is a backdrop for the maths rather than the
 * subject of the picture: your functions come out on top of it at full
 * contrast, at the price of the graph paper being drawn over the field.
 */
export type OverlayLayer = "over" | "under";
