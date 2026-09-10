/**
 * What every part of the overlay needs to know about a field.
 *
 * Split out from `FlowRenderer` because the range probe reads a field too, and
 * the renderer reads the probe — a cycle if either owned these.
 */
import { GLSL_PRELUDE, glslParamName } from "./latexToGLSL";
import type { CompiledHelper } from "./latexToGLSL";

export interface FlowBounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

/**
 * What a component needed from the rest of the graph, compiled.
 *
 * These are part of the field's identity rather than settings alongside it,
 * because changing either means a different shader. What is deliberately *not*
 * here is any parameter's value: a value is a uniform, uploaded per frame, so
 * that moving a slider does not rebuild a program. `setField` compares whole
 * fields, so leaving values out of this type is what makes that true rather
 * than something each renderer has to remember.
 */
export interface FieldDependencies {
  /** Definitions compiled to GLSL functions, dependencies first. */
  helpers?: readonly CompiledHelper[];
  /** Desmos names the field reads, each declared as a uniform. */
  params?: readonly string[];
  /**
   * Whether the field reads the clock.
   *
   * Part of the field's identity because it decides whether `u_time` is
   * declared, and read by the overlays because a field that reads the clock has
   * to keep being drawn rather than settling into a still picture.
   */
  usesTime?: boolean;
}

/**
 * The field to advect by, as compiled GLSL.
 *
 * A gradient field arrives as its scalar function rather than as two
 * components, because the GPU cannot differentiate symbolically the way the
 * generated Desmos expressions do — it has to sample instead.
 */
export type FlowField =
  | ({ kind: "components"; p: string; q: string } & FieldDependencies)
  | ({ kind: "gradient"; f: string } & FieldDependencies);

export class FlowRendererError extends Error {}

/**
 * Uploads the current value of every name the field reads.
 *
 * Both renderers do this identically and must keep agreeing, since they draw
 * the same field from the same graph; a name that went to one and not the other
 * would show as the arrows and the flow disagreeing about where the field is.
 *
 * A name with no value yet uploads zero rather than being skipped, because a
 * skipped uniform keeps whatever the last frame left in it — which would be a
 * stale number that looks like a real one.
 */
export function uploadFieldParameters(
  gl: WebGL2RenderingContext,
  uniforms: Record<string, WebGLUniformLocation | null>,
  field: FlowField | undefined,
  values: ReadonlyMap<string, number>,
  time = 0
) {
  const upload = (uniformName: string, value: number | undefined) => {
    const location = uniforms[uniformName];
    // Null when the linker found the uniform unused, which is not an error.
    if (location === null || location === undefined) return;
    gl.uniform1f(location, value === undefined || !isFinite(value) ? 0 : value);
  };
  for (const name of field?.params ?? []) {
    upload(glslParamName(name), values.get(name));
  }
  // The clock is a uniform like any other name the field reads. It differs only
  // in where the number comes from.
  if (field?.usesTime === true) upload("u_time", time);
}

/**
 * Both shaders that evaluate the field include this, and both declare `u_min`
 * and `u_max` before it — which is what lets the gradient step size follow the
 * viewport without an extra uniform.
 */
export function fieldFunctions(field: FlowField) {
  const body =
    field.kind === "gradient"
      ? `
float vtScalar(vec2 p) { return ${field.f}; }
vec2 vtField(vec2 p) {
  // The generated Desmos arrows differentiate symbolically; the GPU cannot, so
  // it central-differences instead. The step follows the viewport so the
  // gradient stays smooth at any zoom, and it is exact for the quadratics that
  // most potentials are built from.
  float h = 1.0e-3 * max(u_max.x - u_min.x, u_max.y - u_min.y);
  float u = (vtScalar(p + vec2(h, 0.0)) - vtScalar(p - vec2(h, 0.0))) / (2.0 * h);
  float v = (vtScalar(p + vec2(0.0, h)) - vtScalar(p - vec2(0.0, h))) / (2.0 * h);`
      : `
vec2 vtField(vec2 p) {
  float u = ${field.p};
  float v = ${field.q};`;
  // Values the graph binds, as uniforms. Declared before the helpers because a
  // helper may read one, and emitted even when a component reads none, in which
  // case this is empty rather than absent.
  const uniforms = [
    ...(field.params ?? []).map(
      (name) => `uniform float ${glslParamName(name)};`
    ),
    ...(field.usesTime === true ? ["uniform float u_time;"] : []),
  ].join("\n");
  // Dependencies first: the compiler registers a definition only after its own
  // body compiled, so this order is already the one GLSL needs.
  const helpers = (field.helpers ?? []).map((helper) => helper.glsl).join("\n");
  return `
${GLSL_PRELUDE}
${uniforms}
${helpers}
${body}
  if (isnan(u) || isinf(u)) u = 0.0;
  if (isnan(v) || isinf(v)) v = 0.0;
  return vec2(u, v);
}
`;
}
