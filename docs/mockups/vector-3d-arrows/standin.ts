/**
 * The stand-in for Desmos 3D: a box, its axes, the translucent z = 0 plane and
 * one surface, drawn on a WebGL context of its own.
 *
 * It being a separate context is the point. In the real page Desmos draws on
 * its own canvas and our overlay cannot read its depth buffer, so any option
 * that "hides arrows behind the surface" has to redraw that surface itself.
 * Faking both layers on one context would quietly give the overlay a depth it
 * will never have, and the mock-up would show a picture the plugin cannot draw.
 */
import type { Camera3D } from "../../../src/field-rendering/camera3d";
import { multiplyMat4 } from "../../../src/field-rendering/camera3d";
import { GLSL_PRELUDE } from "../../../src/field-rendering/latexToGLSL";
import type { Box } from "./camera";
import {
  CLIP_GLSL,
  program,
  surfaceVertexSource,
  uniforms,
  type Uniforms,
} from "./gl";

const SURFACE_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
uniform vec3 u_boxMin;
uniform vec3 u_boxMax;
uniform int u_ortho;
uniform vec3 u_color;
uniform float u_opacity;
in vec3 v_math;
in vec3 v_view;
in vec3 v_normal;
out vec4 outColor;
${CLIP_GLSL}
void main() {
  if (vtOutsideBox(v_math)) discard;
  vec3 n = normalize(v_normal);
  vec3 V = u_ortho == 1 ? vec3(0.0, 0.0, 1.0) : normalize(-v_view);
  if (dot(n, V) < 0.0) n = -n;
  vec3 L = normalize(vec3(-0.3, 0.6, 0.75));
  float diffuse = max(dot(n, L), 0.0);
  vec3 c = u_color * (0.45 + 0.6 * diffuse);
  outColor = vec4(c * u_opacity, u_opacity);
}
`;

const LINE_VERTEX = `#version 300 es
precision highp float;
precision highp int;
uniform mat4 u_mathToClip;
in vec3 a_position;
void main() { gl_Position = u_mathToClip * vec4(a_position, 1.0); }
`;
const LINE_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
uniform vec4 u_color;
out vec4 outColor;
void main() { outColor = vec4(u_color.rgb * u_color.a, u_color.a); }
`;

/** Desmos 3D's default red, which is the colour a first surface gets. */
const SURFACE_RGB: [number, number, number] = [0.78, 0.27, 0.25];
export const STANDIN_RESOLUTION = 160;

export interface Theme {
  paper: [number, number, number];
  ink: [number, number, number];
  dark: boolean;
}

export class StandIn {
  readonly gl: WebGL2RenderingContext;
  private surfaceProgram?: WebGLProgram;
  private surfaceUniforms?: Uniforms;
  private readonly lineProgram: WebGLProgram;
  private readonly lineUniforms: Uniforms;
  private readonly lineBuffer: WebGLBuffer;
  private readonly lineVao: WebGLVertexArrayObject;
  private readonly emptyVao: WebGLVertexArrayObject;
  surfaceOpacity = 0.85;

  constructor(readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", {
      antialias: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: true,
    });
    if (gl === null) throw new Error("WebGL2 is not available.");
    this.gl = gl;
    this.lineProgram = program(gl, LINE_VERTEX, LINE_FRAGMENT);
    this.lineUniforms = uniforms(gl, this.lineProgram);
    this.lineBuffer = gl.createBuffer()!;
    this.lineVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.lineVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuffer);
    const loc = gl.getAttribLocation(this.lineProgram, "a_position");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
    this.emptyVao = gl.createVertexArray()!;
    gl.bindVertexArray(null);
  }

  /** The surface to draw, as GLSL over `vec2 p`, or undefined for none. */
  setSurface(glsl: string | undefined, helpers: string) {
    const { gl } = this;
    this.surfaceProgram = undefined;
    if (glsl === undefined) return;
    this.surfaceProgram = program(
      gl,
      surfaceVertexSource(glsl, GLSL_PRELUDE + helpers),
      SURFACE_FRAGMENT
    );
    this.surfaceUniforms = uniforms(gl, this.surfaceProgram);
  }

  draw(camera: Camera3D, box: Box, theme: Theme) {
    const { gl } = this;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(...theme.paper, 1);
    gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const mathToView = multiplyMat4(camera.view, camera.world);
    const mathToClip = multiplyMat4(camera.projection, mathToView);

    if (
      this.surfaceProgram !== undefined &&
      this.surfaceUniforms !== undefined
    ) {
      const u = this.surfaceUniforms;
      gl.useProgram(this.surfaceProgram);
      gl.bindVertexArray(this.emptyVao);
      gl.uniformMatrix4fv(u.u_mathToView, false, mathToView);
      gl.uniformMatrix4fv(u.u_projection, false, camera.projection);
      gl.uniform3fv(u.u_boxMin, box.min);
      gl.uniform3fv(u.u_boxMax, box.max);
      gl.uniform1i(u.u_res, STANDIN_RESOLUTION);
      gl.uniform1i(u.u_ortho, camera.orthographic ? 1 : 0);
      gl.uniform3fv(u.u_color, SURFACE_RGB);
      gl.uniform1f(u.u_opacity, this.surfaceOpacity);
      gl.depthMask(true);
      gl.drawArrays(
        gl.TRIANGLES,
        0,
        STANDIN_RESOLUTION * STANDIN_RESOLUTION * 6
      );
    }

    gl.useProgram(this.lineProgram);
    gl.bindVertexArray(this.lineVao);
    gl.uniformMatrix4fv(this.lineUniforms.u_mathToClip, false, mathToClip);
    const ink = theme.ink;
    const drawLines = (
      points: number[],
      rgba: [number, number, number, number],
      mode: number = gl.LINES
    ) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(points), gl.DYNAMIC_DRAW);
      gl.uniform4fv(this.lineUniforms.u_color, rgba);
      gl.drawArrays(mode, 0, points.length / 3);
    };

    // The box's twelve edges.
    const [x0, y0, z0] = box.min;
    const [x1, y1, z1] = box.max;
    const edges: number[] = [];
    for (const [a, b] of [
      [
        [x0, y0, z0],
        [x1, y0, z0],
      ],
      [
        [x0, y1, z0],
        [x1, y1, z0],
      ],
      [
        [x0, y0, z1],
        [x1, y0, z1],
      ],
      [
        [x0, y1, z1],
        [x1, y1, z1],
      ],
      [
        [x0, y0, z0],
        [x0, y1, z0],
      ],
      [
        [x1, y0, z0],
        [x1, y1, z0],
      ],
      [
        [x0, y0, z1],
        [x0, y1, z1],
      ],
      [
        [x1, y0, z1],
        [x1, y1, z1],
      ],
      [
        [x0, y0, z0],
        [x0, y0, z1],
      ],
      [
        [x1, y0, z0],
        [x1, y0, z1],
      ],
      [
        [x0, y1, z0],
        [x0, y1, z1],
      ],
      [
        [x1, y1, z0],
        [x1, y1, z1],
      ],
    ])
      edges.push(...a, ...b);
    gl.depthMask(true);
    drawLines(edges, [...ink, 0.35]);

    // Axes through the origin, where the origin is in the box.
    const axes: number[] = [];
    const inside = (v: number, lo: number, hi: number) => v >= lo && v <= hi;
    if (inside(0, y0, y1) && inside(0, z0, z1)) axes.push(x0, 0, 0, x1, 0, 0);
    if (inside(0, x0, x1) && inside(0, z0, z1)) axes.push(0, y0, 0, 0, y1, 0);
    if (inside(0, x0, x1) && inside(0, y0, y1)) axes.push(0, 0, z0, 0, 0, z1);
    if (axes.length > 0) drawLines(axes, [...ink, 0.85]);

    // The z = 0 plane, translucent, with its grid: drawn last and without
    // writing depth, so it tints whatever is behind it as Desmos's does.
    if (inside(0, z0, z1)) {
      gl.depthMask(false);
      const step = niceStep(Math.max(x1 - x0, y1 - y0) / 10);
      const grid: number[] = [];
      for (let x = Math.ceil(x0 / step) * step; x <= x1 + 1e-9; x += step) {
        grid.push(x, y0, 0, x, y1, 0);
      }
      for (let y = Math.ceil(y0 / step) * step; y <= y1 + 1e-9; y += step) {
        grid.push(x0, y, 0, x1, y, 0);
      }
      drawLines(grid, [...ink, 0.12]);
      drawLines(
        [x0, y0, 0, x1, y0, 0, x1, y1, 0, x0, y0, 0, x1, y1, 0, x0, y1, 0],
        [0.45, 0.55, 0.7, theme.dark ? 0.16 : 0.1],
        gl.TRIANGLES
      );
      gl.depthMask(true);
    }
    gl.bindVertexArray(null);
  }
}

function niceStep(raw: number) {
  const power = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / power;
  return (unit < 1.5 ? 1 : unit < 3.5 ? 2 : unit < 7.5 ? 5 : 10) * power;
}
