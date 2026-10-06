/**
 * Depth-only copies of the user's graphed surfaces, drawn into the overlay's
 * own depth buffer before the field so that what a surface covers is behind
 * it — the "Hidden" default.
 *
 * A copy, not Desmos's own depth, which lives in another WebGL context and
 * cannot be read. The copy is a regular grid evaluated in the vertex shader
 * from the same LaTeX Desmos draws, so where it and Desmos's mesh disagree is
 * a question of resolution: on the mock-up's test surfaces, 128 cells a side
 * left at most 0.06 px between the copy and the exact surface, with the box
 * 570 px across. Auto takes 128 for that reason
 * (`docs/mockups/vector-3d-arrows/README.md`).
 */
import { uploadField3DParameters } from "./field3d";
import { CLIP_GLSL } from "./glsl3d";
import { glslParamName, GLSL_PRELUDE } from "./latexToGLSL";
import type { Box3D } from "./Overlay3D";
import type { Surface3D } from "./surfaces3d";
import { linkProgram3D, uniformsOf, type Uniforms } from "./program3d";

/** Auto's resolution: see the comment at the top of the file. */
export const AUTO_SURFACE_RESOLUTION = 128;

function vertexSource(surface: Surface3D) {
  const uniforms = [
    ...surface.params.map((name) => `uniform float ${glslParamName(name)};`),
    ...(surface.usesTime ? ["uniform float u_time;"] : []),
  ].join("\n");
  const point =
    surface.kind === "uv"
      ? `
  u_vp_u = ab.x;
  u_vp_v = ab.y;
  vec3 p = vec3(0.0);
  return vec3(${surface.xyz[0]}, ${surface.xyz[1]}, ${surface.xyz[2]});`
      : surface.axis === 2
        ? `
  vec3 p = vec3(ab, 0.0);
  return vec3(ab, ${surface.body});`
        : surface.axis === 0
          ? `
  vec3 p = vec3(0.0, ab);
  return vec3(${surface.body}, ab);`
          : `
  vec3 p = vec3(ab.x, 0.0, ab.y);
  return vec3(ab.x, ${surface.body}, ab.y);`;
  return `#version 300 es
precision highp float;
precision highp int;
uniform mat4 u_mathToView;
uniform mat4 u_projection;
uniform int u_res;
uniform vec2 u_from;
uniform vec2 u_to;
out vec3 v_math;
${GLSL_PRELUDE}
${uniforms}
${surface.kind === "uv" ? "float u_vp_u;\nfloat u_vp_v;" : ""}
${surface.helpers.map((h) => h.glsl).join("\n")}
vec3 vtPoint(vec2 ab) {${point}
}
const ivec2 CORNER[6] = ivec2[6](
  ivec2(0, 0), ivec2(1, 0), ivec2(1, 1), ivec2(0, 0), ivec2(1, 1), ivec2(0, 1)
);
void main() {
  int quad = gl_VertexID / 6;
  ivec2 cell = ivec2(quad % u_res, quad / u_res) + CORNER[gl_VertexID % 6];
  vec2 ab = mix(u_from, u_to, vec2(cell) / float(u_res));
  vec3 m = vtPoint(ab);
  v_math = m;
  gl_Position = u_projection * (u_mathToView * vec4(m, 1.0));
}
`;
}

const FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
in vec3 v_math;
out vec4 outColor;
${CLIP_GLSL}
void main() {
  // Desmos clips every surface to the box, so the copy is clipped the same
  // way: a surface that leaves the box must not hide anything outside it.
  if (vtOutsideBox(v_math)) discard;
  outColor = vec4(0.0);
}
`;

export class SurfaceDepth {
  private programs: {
    surface: Surface3D;
    program: WebGLProgram;
    uniforms: Uniforms;
  }[] = [];
  private key = "";

  constructor(private readonly gl: WebGL2RenderingContext) {}

  get count() {
    return this.programs.length;
  }

  /** Builds a program per surface; a no-op if the surfaces are the same. */
  setSurfaces(surfaces: readonly Surface3D[]) {
    const key = JSON.stringify(surfaces);
    if (key === this.key) return;
    this.dispose();
    const { gl } = this;
    for (const surface of surfaces) {
      // A surface whose shader will not build is left out rather than taking
      // the field down with it: the field still draws, just not hidden by it.
      try {
        const program = linkProgram3D(gl, vertexSource(surface), FRAGMENT);
        this.programs.push({
          surface,
          program,
          uniforms: uniformsOf(gl, program),
        });
      } catch {
        continue;
      }
    }
    this.key = key;
  }

  /**
   * Draws every surface into the depth buffer only. The caller has the
   * vertex array and the depth state it wants; this leaves colour writes on.
   */
  draw(
    mathToView: readonly number[],
    projection: readonly number[],
    box: Box3D,
    resolution: number,
    parameters: ReadonlyMap<string, number>,
    time: number
  ) {
    const { gl } = this;
    if (this.programs.length === 0) return;
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);
    gl.depthMask(true);
    gl.colorMask(false, false, false, false);
    const res = Math.max(2, Math.round(resolution));
    for (const { surface, program, uniforms: u } of this.programs) {
      gl.useProgram(program);
      uploadField3DParameters(gl, u, surface, parameters, time);
      gl.uniformMatrix4fv(u.u_mathToView, false, mathToView);
      gl.uniformMatrix4fv(u.u_projection, false, projection);
      gl.uniform3fv(u.u_boxMin, box.min);
      gl.uniform3fv(u.u_boxMax, box.max);
      gl.uniform1i(u.u_res, res);
      const [from, to] = gridRange(surface, box);
      gl.uniform2fv(u.u_from, from);
      gl.uniform2fv(u.u_to, to);
      gl.drawArrays(gl.TRIANGLES, 0, res * res * 6);
    }
    gl.colorMask(true, true, true, true);
  }

  dispose() {
    for (const { program } of this.programs) this.gl.deleteProgram(program);
    this.programs = [];
    this.key = "";
  }
}

/** The two coordinates a surface's grid spans. */
export function gridRange(
  surface: Surface3D,
  box: Box3D
): [[number, number], [number, number]] {
  if (surface.kind === "uv") {
    return [
      [surface.u[0], surface.v[0]],
      [surface.u[1], surface.v[1]],
    ];
  }
  const free = [0, 1, 2].filter((i) => i !== surface.axis);
  return [
    [box.min[free[0]], box.min[free[1]]],
    [box.max[free[0]], box.max[free[1]]],
  ];
}
