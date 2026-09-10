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
