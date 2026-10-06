/**
 * A vector field on Desmos 3D, compiled: three GLSL expressions over `vec3 p`,
 * and what they read from the graph.
 *
 * The 3D sibling of `FlowField`, kept separate rather than widened, because
 * every 2D renderer, the generator and the simulation read `FlowField` as a
 * two-component field over `vec2 p`, and a third component threaded through
 * them would be a third component they all have to ignore.
 */
import {
  glslParamName,
  GLSL_PRELUDE,
  type CompiledHelper,
} from "./latexToGLSL";

export interface Field3D {
  p: string;
  q: string;
  r: string;
  helpers: readonly CompiledHelper[];
  /** Names the field reads from the graph; each is a uniform. */
  params: readonly string[];
  usesTime: boolean;
}

/** Whether two compiled fields would build the same shader. */
export function sameField3D(a: Field3D | undefined, b: Field3D | undefined) {
  if (a === undefined || b === undefined) return a === b;
  return (
    a.p === b.p &&
    a.q === b.q &&
    a.r === b.r &&
    a.usesTime === b.usesTime &&
    a.params.join() === b.params.join() &&
    a.helpers.map((h) => h.glsl).join() === b.helpers.map((h) => h.glsl).join()
  );
}

/**
 * `vtField(vec3 p)` and everything it needs, for any shader that evaluates the
 * field.
 *
 * Non-finite components collapse to zero, as in 2D (briefing §4.3), and a zero
 * vector draws nothing, so a pole draws no arrow at the pole itself.
 */
export function field3dFunctions(field: Field3D) {
  const uniforms = [
    ...field.params.map((name) => `uniform float ${glslParamName(name)};`),
    ...(field.usesTime ? ["uniform float u_time;"] : []),
  ].join("\n");
  return `
${GLSL_PRELUDE}
${uniforms}
${field.helpers.map((helper) => helper.glsl).join("\n")}
vec3 vtField(vec3 p) {
  vec3 v = vec3(${field.p}, ${field.q}, ${field.r});
  return any(isnan(v)) || any(isinf(v)) ? vec3(0.0) : v;
}
`;
}

/**
 * Uploads the values behind the names the field reads, and the clock.
 *
 * A name with no value yet uploads zero rather than being skipped, for the
 * reason `uploadFieldParameters` gives: a skipped uniform keeps last frame's
 * number, which looks like a real one.
 */
export function uploadField3DParameters(
  gl: WebGL2RenderingContext,
  uniforms: Record<string, WebGLUniformLocation | null>,
  field: Field3D,
  values: ReadonlyMap<string, number>,
  time: number
) {
  const upload = (name: string, value: number | undefined) => {
    const location = uniforms[name];
    if (location === null || location === undefined) return;
    gl.uniform1f(location, value === undefined || !isFinite(value) ? 0 : value);
  };
  for (const name of field.params)
    upload(glslParamName(name), values.get(name));
  if (field.usesTime) upload("u_time", time);
}
