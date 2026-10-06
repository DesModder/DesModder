/** The small amount of WebGL plumbing both contexts need. */

export function program(
  gl: WebGL2RenderingContext,
  vertex: string,
  fragment: string
): WebGLProgram {
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      const numbered = source
        .split("\n")
        .map((line, i) => `${i + 1}: ${line}`)
        .join("\n");
      throw new Error(`${log}\n${numbered}`);
    }
    return shader;
  };
  const p = gl.createProgram()!;
  gl.attachShader(p, compile(gl.VERTEX_SHADER, vertex));
  gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fragment));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(p) ?? "link failed");
  }
  return p;
}

export type Uniforms = Record<string, WebGLUniformLocation | null>;

export function uniforms(
  gl: WebGL2RenderingContext,
  p: WebGLProgram
): Uniforms {
  const out: Uniforms = {};
  const count = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) as number;
  for (let i = 0; i < count; i++) {
    const info = gl.getActiveUniform(p, i)!;
    const name = info.name.replace(/\[0\]$/, "");
    out[name] = gl.getUniformLocation(p, info.name);
  }
  return new Proxy(out, {
    get: (target, key: string) => target[key] ?? null,
  });
}

/**
 * The surface `z = f(x, y)` as a grid of triangles addressed by `gl_VertexID`,
 * shared by the stand-in (which shades it) and the overlay (which only writes
 * its depth, for the "hidden behind the surface" option). Both are built from
 * the same compiled LaTeX; only the resolution differs, and that difference is
 * exactly what the mock-up measures.
 */
export function surfaceVertexSource(surfaceGlsl: string, helpers: string) {
  return `#version 300 es
precision highp float;
uniform mat4 u_mathToView;
uniform mat4 u_projection;
uniform vec3 u_boxMin;
uniform vec3 u_boxMax;
uniform int u_res;
out vec3 v_math;
out vec3 v_view;
out vec3 v_normal;
${helpers}
float vtSurface(vec2 p) { return ${surfaceGlsl}; }
vec3 vtView(vec2 q) {
  return (u_mathToView * vec4(q, vtSurface(q), 1.0)).xyz;
}
const ivec2 CORNER[6] = ivec2[6](
  ivec2(0, 0), ivec2(1, 0), ivec2(1, 1), ivec2(0, 0), ivec2(1, 1), ivec2(0, 1)
);
void main() {
  int quad = gl_VertexID / 6;
  ivec2 cell = ivec2(quad % u_res, quad / u_res) + CORNER[gl_VertexID % 6];
  vec2 t = vec2(cell) / float(u_res);
  vec2 q = mix(u_boxMin.xy, u_boxMax.xy, t);
  float z = vtSurface(q);
  v_math = vec3(q, z);
  v_view = (u_mathToView * vec4(q, z, 1.0)).xyz;
  vec2 h = (u_boxMax.xy - u_boxMin.xy) / float(u_res) * 0.5;
  v_normal = normalize(cross(
    vtView(q + vec2(h.x, 0.0)) - vtView(q - vec2(h.x, 0.0)),
    vtView(q + vec2(0.0, h.y)) - vtView(q - vec2(0.0, h.y))
  ));
  gl_Position = u_projection * vec4(v_view, 1.0);
}
`;
}

/** Anything Desmos would clip to the box, discarded the same way. */
export const CLIP_GLSL = `
bool vtOutsideBox(vec3 m) {
  vec3 eps = (u_boxMax - u_boxMin) * 1.0e-4;
  return any(lessThan(m, u_boxMin - eps)) || any(greaterThan(m, u_boxMax + eps))
    || any(isnan(m));
}
`;
