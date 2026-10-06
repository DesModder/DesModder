/**
 * Live 3D arrows on a WebGL context of their own, drawn from nothing but the
 * camera Desmos reports and the field's LaTeX.
 *
 * The 2D `ArrowRenderer` model carried over whole: the field is evaluated in
 * the vertex shader, the glyph exists only in that shader, addressed by
 * `gl_VertexID` and `gl_InstanceID`, and the whole field is one draw call with
 * no vertex buffer.
 *
 * What is new is where the glyph is built. The arrow's two ends are placed in
 * math coordinates, so its tip lands on the graph point `start + F` the way
 * Desmos's own `vector(start, end)` would, however unequal the box's axes are.
 * Its body is then built in camera space, where lengths are the same in every
 * direction, so a shaft stays round and a head stays a cone in a box that is
 * twenty units wide and two tall. Building the body in math coordinates would
 * squash it with the box.
 */
import type { Camera3D } from "../../../src/field-rendering/camera3d";
import {
  multiplyMat4,
  projectToScreen,
} from "../../../src/field-rendering/camera3d";
import { GLSL_PRELUDE } from "../../../src/field-rendering/latexToGLSL";
import {
  PALETTE_GLSL,
  paletteUniforms,
  type PaletteID,
} from "../../../src/field-rendering/palettes";
import type { Box } from "./camera";
import {
  CLIP_GLSL,
  CUT_GLSL,
  HASH_GLSL,
  program,
  surfaceVertexSource,
  uniforms,
  type Uniforms,
} from "./gl";
import { VolumeLooks, type LookSettings } from "./looks";

export type Shape = "lines" | "flat" | "solid";
export type Sampling = "grid" | "slice" | "jitter" | "surface";
export type LengthMode = "normalized" | "saturating" | "clamped" | "actual";
export type Occlusion = "over" | "hide" | "fade";
export type Look = "arrows" | "streamlines" | "cloud";
export type Cutaway = "off" | "half" | "wedge";

export interface ArrowSettings extends LookSettings {
  look: Look;
  /** Remove part of the box nearer the camera, to see its middle. */
  cutaway: Cutaway;
  /** The cake slice's angle, in radians. */
  cutAngle: number;
  /** Paint the faces the cut leaves with the field. */
  cutFaces: boolean;
  faceOpacity: number;
  shape: Shape;
  sampling: Sampling;
  /** Arrows per axis; slices and surfaces use the first two. */
  count: number;
  sliceAxis: 0 | 1 | 2;
  /** 0..1 across the box along the slice axis. */
  slicePosition: number;
  lengthMode: LengthMode;
  /** The arrow's nominal length, in box half-widths. */
  length: number;
  /** Shaft width in CSS pixels. */
  widthPx: number;
  colorMode: "magnitude" | "fixed";
  palette: PaletteID;
  fixedColor: [number, number, number];
  /** The magnitude that lands 63% of the way along the saturating ramp. */
  speedScale: number;
  shading: boolean;
  fog: boolean;
  outline: boolean;
  selfDepth: boolean;
  occlusion: Occlusion;
  /** Resolution of our own depth-only copy of the surface. */
  meshResolution: number;
  clip: boolean;
}

export const SIDES = 10;

/** How many vertices one arrow costs, per shape. */
export function verticesPerArrow(shape: Shape) {
  if (shape === "lines") return 6;
  if (shape === "flat") return 9;
  // A cylinder (two triangles a side), a cone (one a side) and the disc that
  // closes the cone's base (one a side). The shaft's tail is left open: it is
  // a few pixels across and never faces the camera for long.
  return 12 * SIDES;
}

export function instanceCount(s: ArrowSettings) {
  return s.sampling === "grid" || s.sampling === "jitter"
    ? s.count ** 3
    : s.count ** 2;
}

const SHAPE_INDEX: Record<Shape, number> = { lines: 0, flat: 1, solid: 2 };
const SAMPLING_INDEX: Record<Sampling, number> = {
  grid: 0,
  jitter: 1,
  slice: 2,
  surface: 3,
};
const LENGTH_INDEX: Record<LengthMode, number> = {
  normalized: 0,
  saturating: 1,
  clamped: 2,
  actual: 3,
};

function arrowVertexSource(
  field: string[],
  surface: string | undefined,
  helpers: string
) {
  return `#version 300 es
precision highp float;
precision highp int;
uniform mat4 u_mathToView;
uniform mat4 u_projection;
uniform int u_ortho;
uniform float u_viewportH;
uniform vec3 u_boxMin;
uniform vec3 u_boxMax;
uniform int u_sampling;
uniform int u_count;
uniform int u_sliceAxis;
uniform float u_slicePos;
uniform int u_shape;
uniform int u_lengthMode;
uniform float u_length;
uniform float u_cap;
uniform float u_widthPx;
uniform int u_colorMode;
uniform vec3 u_fixedColor;
uniform float u_speedScale;
uniform vec2 u_depthRange;
out vec4 v_color;
out vec3 v_normal;
out vec3 v_view;
out vec3 v_math;
out vec4 v_edge;
out float v_fog;

${GLSL_PRELUDE}
${helpers}
${HASH_GLSL}
${PALETTE_GLSL}

vec3 vtField(vec3 p) {
  vec3 v = vec3(${field[0]}, ${field[1]}, ${field[2]});
  return any(isnan(v)) || any(isinf(v)) ? vec3(0.0) : v;
}
float vtSurface(vec2 p) { return ${surface ?? "vtUndefined()"}; }

/** Where instance \`id\` samples the field, or false if it has no point. */
bool vtSample(int id, out vec3 pos) {
  vec3 lo = u_boxMin;
  vec3 hi = u_boxMax;
  int n = u_count;
  if (u_sampling <= 1) {
    ivec3 cell = ivec3(id % n, (id / n) % n, id / (n * n));
    // Cell-centred, so no arrow starts on a face of the box, where Desmos
    // would clip it in half.
    vec3 t = (vec3(cell) + 0.5) / float(n);
    // Kept within 14-86% of each cell, as GPT measured: fewer tight clumps
    // than random points, without the lattice the eye reads as structure.
    if (u_sampling == 1) t += (vtHash3(uint(id)) - 0.5) * 0.72 / float(n);
    pos = mix(lo, hi, t);
    return true;
  }
  vec2 t = (vec2(id % n, id / n) + 0.5) / float(n);
  if (u_sampling == 2) {
    float s = u_slicePos;
    if (u_sliceAxis == 0) pos = mix(lo, hi, vec3(s, t.x, t.y));
    else if (u_sliceAxis == 1) pos = mix(lo, hi, vec3(t.x, s, t.y));
    else pos = mix(lo, hi, vec3(t.x, t.y, s));
    return true;
  }
  vec2 q = mix(lo.xy, hi.xy, t);
  float z = vtSurface(q);
  pos = vec3(q, z);
  return !isnan(z) && z >= lo.z && z <= hi.z;
}

const ivec2 QUAD[6] = ivec2[6](
  ivec2(0, 0), ivec2(1, 0), ivec2(1, 1), ivec2(0, 0), ivec2(1, 1), ivec2(0, 1)
);
const vec2 SHAFT[6] = vec2[6](
  vec2(0.0, -1.0), vec2(1.0, -1.0), vec2(1.0, 1.0),
  vec2(0.0, -1.0), vec2(1.0, 1.0), vec2(0.0, 1.0)
);
const vec3 BARY[3] = vec3[3](vec3(1, 0, 0), vec3(0, 1, 0), vec3(0, 0, 1));

void vtHide() {
  gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  v_color = vec4(0.0);
}

void main() {
  vec3 pos;
  if (!vtSample(gl_InstanceID, pos)) { vtHide(); return; }
  vec3 v = vtField(pos);
  float m = length(v);
  vec3 half_ = 0.5 * (u_boxMax - u_boxMin);
  // The vector in box half-widths: what it looks like drawn in this box.
  vec3 w = v / half_;
  float wl = length(w);
  if (m <= 1.0e-9 || wl <= 1.0e-12) { vtHide(); return; }

  float len;
  if (u_lengthMode == 0) len = u_length;
  else if (u_lengthMode == 1) len = u_length * (1.0 - exp(-m / u_speedScale));
  else if (u_lengthMode == 2) len = min(u_length * m / u_speedScale, 1.6 * u_length);
  else len = wl;
  // However the length was chosen, nothing is drawn longer than an eighth of
  // the box's diagonal: past that an arrow leaves the box before its
  // direction reads, which is the 2D overlay's 0.12-of-the-viewport rule.
  len = min(len, u_cap);
  // Direction from the vector, never from the capped one (briefing §6.4).
  vec3 tipMath = pos + (w / wl) * len * half_;

  vec3 a = (u_mathToView * vec4(pos, 1.0)).xyz;
  vec3 b = (u_mathToView * vec4(tipMath, 1.0)).xyz;
  vec3 d = b - a;
  float L = length(d);
  if (L <= 1.0e-9) { vtHide(); return; }
  vec3 D = d / L;
  vec3 mid = 0.5 * (a + b);
  // One CSS pixel, in camera units, at the arrow's depth.
  float f = u_projection[1][1];
  float px = (u_ortho == 1 ? 2.0 : 2.0 * max(-mid.z, 1.0e-3)) / (f * u_viewportH);

  // The 2D rules for thickness: in pixels, so it does not change with zoom,
  // but never wider than a fifth of the arrow (a tenth for a solid one, which
  // reads as fat sooner) and never thinner than about a third of a pixel.
  float halfWidth = max(min(0.5 * u_widthPx * px, (u_shape == 2 ? 0.1 : 0.2) * L), 0.3 * px);
  float headLen = min(0.45 * L, max(0.28 * L, 5.0 * halfWidth));
  float headHalf = min(max(headLen * 0.45, 2.3 * halfWidth), 0.5 * L);
  float shaftEnd = L - headLen;

  vec3 toCamera = u_ortho == 1 ? vec3(0.0, 0.0, 1.0) : normalize(-mid);
  vec3 E = cross(D, toCamera);
  E = length(E) < 1.0e-6 ? normalize(cross(D, vec3(0.0, 1.0, 0.0) + 1.0e-3)) : normalize(E);

  vec3 local;
  vec3 normal = toCamera;
  v_edge = vec4(0.0, 1.0, 1.0, 1.0);
  int vid = gl_VertexID;
  if (u_shape == 0) {
    // Lines: the shaft, then the two wings of the head.
    vec3 wing = b - D * headLen;
    if (vid == 0) local = a;
    else if (vid == 3) local = wing + E * headHalf;
    else if (vid == 5) local = wing - E * headHalf;
    else local = b;
  } else if (u_shape == 1) {
    // Flat: the 2D arrow, turned to face the camera about its own axis.
    if (vid < 6) {
      vec2 c = SHAFT[vid];
      local = a + D * (c.x * shaftEnd) + E * (c.y * halfWidth);
      v_edge = vec4(c.y, 1.0, 1.0, 1.0);
    } else {
      int k = vid - 6;
      local = k == 1 ? b : a + D * shaftEnd + E * (k == 0 ? -headHalf : headHalf);
      v_edge = vec4(0.0, BARY[k]);
    }
  } else {
    // Solid: cylinder, cone, and the disc under the cone.
    vec3 U = normalize(cross(D, abs(D.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
    vec3 V = cross(D, U);
    float step_ = 6.2831853 / float(${SIDES});
    if (vid < ${6 * SIDES}) {
      ivec2 c = QUAD[vid % 6];
      float ang = float(vid / 6 + c.x) * step_;
      vec3 radial = cos(ang) * U + sin(ang) * V;
      local = a + D * (float(c.y) * shaftEnd) + radial * halfWidth;
      normal = radial;
    } else if (vid < ${9 * SIDES}) {
      int k = vid - ${6 * SIDES};
      int corner = k % 3;
      float ang = (float(k / 3) + (corner == 2 ? 0.5 : float(corner))) * step_;
      vec3 radial = cos(ang) * U + sin(ang) * V;
      local = corner == 2 ? b : a + D * shaftEnd + radial * headHalf;
      normal = normalize(radial * headLen + D * headHalf);
    } else {
      int k = vid - ${9 * SIDES};
      int corner = k % 3;
      float ang = float(k / 3 + (corner == 2 ? 1 : 0)) * step_;
      vec3 radial = cos(ang) * U + sin(ang) * V;
      local = a + D * shaftEnd + (corner == 0 ? vec3(0.0) : radial * headHalf);
      normal = -D;
    }
  }

  v_view = local;
  v_normal = normal;
  v_math = mix(pos, tipMath, clamp(dot(local - a, D) / L, 0.0, 1.0));
  v_fog = clamp((-local.z - u_depthRange.x) / max(u_depthRange.y - u_depthRange.x, 1.0e-6), 0.0, 1.0);
  gl_Position = u_projection * vec4(local, 1.0);

  vec3 color = u_colorMode == 1
    ? vtAdjust(u_fixedColor)
    // The 2D overlay's saturating ramp (briefing §6.1), unchanged.
    : vtPalette(1.0 - exp(-m / u_speedScale));
  v_color = vec4(color, 1.0);
}
`;
}

const ARROW_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
uniform vec3 u_boxMin;
uniform vec3 u_boxMax;
uniform int u_clip;
uniform int u_shape;
uniform int u_ortho;
uniform int u_shading;
uniform int u_outline;
uniform float u_fog;
uniform float u_alpha;
${CUT_GLSL}
in vec4 v_color;
in vec3 v_normal;
in vec3 v_view;
in vec3 v_math;
in vec4 v_edge;
in float v_fog;
out vec4 outColor;
${CLIP_GLSL}
void main() {
  if (u_clip == 1 && vtOutsideBox(v_math)) discard;
  if (vtCutAway(v_math, v_view)) discard;
  vec3 c = v_color.rgb;
  vec3 n = normalize(v_normal);
  vec3 V = u_ortho == 1 ? vec3(0.0, 0.0, 1.0) : normalize(-v_view);
  if (dot(n, V) < 0.0) n = -n;
  if (u_shading == 1 && u_shape == 2) {
    vec3 L = normalize(vec3(-0.35, 0.55, 0.75));
    float diffuse = max(dot(n, L), 0.0);
    float spec = pow(max(dot(n, normalize(L + V)), 0.0), 40.0);
    c = c * (0.38 + 0.68 * diffuse) + 0.22 * spec;
  }
  if (u_outline == 1) {
    bool edge = u_shape == 2
      ? dot(n, V) < 0.3
      : u_shape == 1 && (abs(v_edge.x) > 0.55 || min(v_edge.y, min(v_edge.z, v_edge.w)) < 0.09);
    if (edge) c *= 0.22;
  }
  // Distance fading: the far side of the box recedes, so a cluster of arrows
  // separates into near and far without any depth from Desmos.
  float a = u_alpha * mix(1.0, 0.16, v_fog * u_fog);
  outColor = vec4(clamp(c, 0.0, 1.0) * a, a);
}
`;

const DEPTH_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
uniform vec3 u_boxMin;
uniform vec3 u_boxMax;
in vec3 v_math;
in vec3 v_view;
in vec3 v_normal;
out vec4 outColor;
${CLIP_GLSL}
void main() {
  if (vtOutsideBox(v_math)) discard;
  outColor = vec4(0.0);
}
`;

/**
 * The faces the cutaway leaves, coloured by the field at every point on them.
 *
 * A wedge cut out of a field of arrows does not read as a cut: through the
 * gap you simply see more arrows. A cut cake reads as cut because of its
 * faces, which show the inside. These are those faces: two half-planes for a
 * slice, one plane for a half, each painted with the field's own colour and
 * writing depth, so whatever lies behind a face is behind it.
 */
function faceVertexSource() {
  return `#version 300 es
precision highp float;
precision highp int;
uniform mat4 u_mathToView;
uniform mat4 u_projection;
uniform vec3 u_quad[8];
out vec3 v_math;
out float v_face;
const int CORNER[6] = int[6](0, 1, 2, 0, 2, 3);
void main() {
  int quad = gl_VertexID / 6;
  vec3 p = u_quad[quad * 4 + CORNER[gl_VertexID % 6]];
  v_math = p;
  v_face = float(quad);
  gl_Position = u_projection * (u_mathToView * vec4(p, 1.0));
}
`;
}

function faceFragmentSource(field: string[], helpers: string) {
  return `#version 300 es
precision highp float;
precision highp int;
uniform vec3 u_boxMin;
uniform vec3 u_boxMax;
uniform float u_speedScale;
uniform int u_colorMode;
uniform vec3 u_fixedColor;
uniform int u_byDirection;
uniform float u_faceOpacity;
in vec3 v_math;
in float v_face;
out vec4 outColor;
${CLIP_GLSL}
${GLSL_PRELUDE}
${helpers}
${PALETTE_GLSL}
vec3 vtField(vec3 p) {
  vec3 v = vec3(${field[0]}, ${field[1]}, ${field[2]});
  return any(isnan(v)) || any(isinf(v)) ? vec3(0.0) : v;
}
void main() {
  if (vtOutsideBox(v_math)) discard;
  vec3 F = vtField(v_math);
  float m = length(F);
  vec3 c = u_byDirection == 1
    ? abs(F) / max(m, 1.0e-12)
    : u_colorMode == 1
      ? vtAdjust(u_fixedColor)
      : vtPalette(1.0 - exp(-m / u_speedScale));
  // The two faces of a slice a shade apart, so the eye reads a corner.
  c *= v_face > 0.5 ? 0.86 : 1.0;
  outColor = vec4(c * u_faceOpacity, u_faceOpacity);
}
`;
}

export interface FrameStats {
  instances: number;
  vertices: number;
  /** GPU time of the last measured frame, if the timer extension exists. */
  gpuMs?: number;
}

export class Overlay {
  readonly gl: WebGL2RenderingContext;
  private arrowProgram?: WebGLProgram;
  private arrowUniforms?: Uniforms;
  private depthProgram?: WebGLProgram;
  private depthUniforms?: Uniforms;
  private faceProgram?: WebGLProgram;
  private faceUniforms?: Uniforms;
  private readonly vao: WebGLVertexArrayObject;
  private readonly timer: {
    TIME_ELAPSED_EXT: number;
    GPU_DISJOINT_EXT: number;
  } | null;
  private readonly pending: WebGLQuery[] = [];
  private readonly looks: VolumeLooks;
  gpuMs: number[] = [];

  constructor(readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", {
      antialias: true,
      premultipliedAlpha: true,
      alpha: true,
      depth: true,
      preserveDrawingBuffer: true,
    });
    if (gl === null) throw new Error("WebGL2 is not available.");
    this.gl = gl;
    this.vao = gl.createVertexArray()!;
    this.timer = gl.getExtension("EXT_disjoint_timer_query_webgl2");
    this.looks = new VolumeLooks(gl, this.vao);
  }

  /** Whether streamlines can be traced: they need float render targets. */
  get canTrace() {
    return this.looks.canTrace;
  }

  get hasTimer() {
    return this.timer !== null;
  }

  /** Compile the field (three GLSL expressions over \`vec3 p\`) and the surface. */
  setField(
    field: string[],
    fieldHelpers: string,
    surface: string | undefined,
    surfaceHelpers: string
  ) {
    const { gl } = this;
    this.arrowProgram = program(
      gl,
      arrowVertexSource(field, surface, fieldHelpers + surfaceHelpers),
      ARROW_FRAGMENT
    );
    this.arrowUniforms = uniforms(gl, this.arrowProgram);
    this.looks.setField(field, fieldHelpers);
    this.faceProgram = program(
      gl,
      faceVertexSource(),
      faceFragmentSource(field, fieldHelpers)
    );
    this.faceUniforms = uniforms(gl, this.faceProgram);
    this.depthProgram = undefined;
    if (surface !== undefined) {
      this.depthProgram = program(
        gl,
        surfaceVertexSource(surface, GLSL_PRELUDE + surfaceHelpers),
        DEPTH_FRAGMENT
      );
      this.depthUniforms = uniforms(gl, this.depthProgram);
    }
  }

  draw(camera: Camera3D, box: Box, s: ArrowSettings): FrameStats {
    const { gl } = this;
    const instances = instanceCount(s);
    const perArrow = verticesPerArrow(s.shape);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clearDepth(1);
    gl.depthMask(true);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    if (this.arrowProgram === undefined || this.arrowUniforms === undefined) {
      return { instances: 0, vertices: 0 };
    }
    this.collectTimer();
    const query = this.timer !== null ? gl.createQuery() : null;
    if (query !== null && this.timer !== null)
      gl.beginQuery(this.timer.TIME_ELAPSED_EXT, query);

    const mathToView = multiplyMat4(camera.view, camera.world);
    gl.bindVertexArray(this.vao);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    // Our own copy of the surface, depth only. Desmos's depth is in another
    // context and cannot be read, so this is the only way an arrow behind
    // the surface can know it is behind it.
    const occluding = s.occlusion !== "over" && this.depthProgram !== undefined;
    if (occluding && this.depthUniforms !== undefined) {
      const u = this.depthUniforms;
      gl.useProgram(this.depthProgram!);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LESS);
      gl.colorMask(false, false, false, false);
      gl.uniformMatrix4fv(u.u_mathToView, false, mathToView);
      gl.uniformMatrix4fv(u.u_projection, false, camera.projection);
      gl.uniform3fv(u.u_boxMin, box.min);
      gl.uniform3fv(u.u_boxMax, box.max);
      gl.uniform1i(u.u_res, s.meshResolution);
      gl.drawArrays(gl.TRIANGLES, 0, s.meshResolution * s.meshResolution * 6);
      gl.colorMask(true, true, true, true);
    }

    // The cutaway plane passes through the box's centre, facing the camera.
    const centre = [0, 1, 2].map((i) => (box.min[i] + box.max[i]) / 2);
    const cutZ =
      mathToView[2] * centre[0] +
      mathToView[6] * centre[1] +
      mathToView[10] * centre[2] +
      mathToView[14];
    // The camera's direction in box half-widths, for the cake slice: the
    // third column of the inverse of the linear part of math-to-view, divided
    // by the half-widths, which is the camera direction with the box's
    // scaling taken back out.
    const m = mathToView;
    const row = (r: number) => [m[r], m[4 + r], m[8 + r]];
    const [r0, r1] = [row(0), row(1)];
    const toCamera = [
      r0[1] * r1[2] - r0[2] * r1[1],
      r0[2] * r1[0] - r0[0] * r1[2],
      r0[0] * r1[1] - r0[1] * r1[0],
    ];
    const half = [0, 1, 2].map((i) => (box.max[i] - box.min[i]) / 2);
    const azimuth = Math.atan2(toCamera[1] / half[1], toCamera[0] / half[0]);
    const cutMode = { off: 0, half: 1, wedge: 2 }[s.cutaway];
    const uploadCut = (cu: Uniforms) => {
      gl.uniform1i(cu.u_cut, cutMode);
      gl.uniform1f(cu.u_cutZ, cutZ);
      gl.uniform3fv(cu.u_cutCentre, centre);
      gl.uniform3fv(cu.u_cutHalf, half);
      gl.uniform1f(cu.u_cutAzimuth, azimuth);
      gl.uniform1f(cu.u_cutAngle, s.cutAngle);
    };
    const palette = paletteUniforms(s.palette);
    const uploadPalette = (pu: Uniforms) => {
      gl.uniform1fv(pu.u_paletteAt, palette.positions);
      gl.uniform3fv(pu.u_paletteRGB, palette.colors);
      gl.uniform1i(pu.u_paletteCount, palette.count);
      gl.uniform1i(pu.u_paletteIsHue, s.palette === "direction-hue" ? 1 : 0);
      gl.uniform1f(pu.u_saturation, 1);
      gl.uniform1f(pu.u_contrast, 1);
    };

    // The cut faces, drawn before the look and writing depth, so anything
    // behind a face is hidden by it the way the inside of a cake is.
    const facing = s.cutaway !== "off" && s.cutFaces;
    if (
      facing &&
      this.faceProgram !== undefined &&
      this.faceUniforms !== undefined
    ) {
      const quads = cutFaces(
        s.cutaway as "half" | "wedge",
        s.cutAngle,
        azimuth,
        centre,
        half,
        row(2)
      );
      const corners = quads.flat();
      while (corners.length < 24) corners.push(0);
      const fu = this.faceUniforms;
      gl.useProgram(this.faceProgram);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.depthMask(true);
      gl.uniformMatrix4fv(fu.u_mathToView, false, mathToView);
      gl.uniformMatrix4fv(fu.u_projection, false, camera.projection);
      gl.uniform3fv(fu.u_quad, corners);
      gl.uniform3fv(fu.u_boxMin, box.min);
      gl.uniform3fv(fu.u_boxMax, box.max);
      gl.uniform1f(fu.u_speedScale, Math.max(1e-9, s.speedScale));
      gl.uniform1i(fu.u_colorMode, s.colorMode === "fixed" ? 1 : 0);
      gl.uniform3fv(fu.u_fixedColor, s.fixedColor);
      gl.uniform1i(
        fu.u_byDirection,
        s.look === "cloud" && s.cloudByDirection ? 1 : 0
      );
      gl.uniform1f(fu.u_faceOpacity, s.faceOpacity);
      uploadPalette(fu);
      gl.drawArrays(gl.TRIANGLES, 0, (quads.length / 4) * 6);
    }
    const depthTested = occluding || facing;

    if (s.look !== "arrows") {
      // Thin, faint marks: they never write depth, so the near ones never
      // hide the far ones, and the whole volume shows at once.
      const look = this.looks.prepare(
        s.look,
        {
          mathToView,
          projection: camera.projection,
          box,
          speedScale: s.speedScale,
          colorMode: s.colorMode === "fixed" ? 1 : 0,
          fixedColor: s.fixedColor,
          depthRange: depthRange(camera, box),
          clip: s.clip,
          fog: s.fog,
          uploadCut,
          dpr: this.canvas.width / Math.max(1, camera.width),
          uploadPalette,
        },
        s,
        () => gl.viewport(0, 0, this.canvas.width, this.canvas.height)
      );
      gl.bindVertexArray(this.vao);
      gl.depthMask(false);
      if (depthTested && s.occlusion === "fade") {
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.GREATER);
        look.draw(0.25);
      }
      if (depthTested) {
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
      } else {
        gl.disable(gl.DEPTH_TEST);
      }
      look.draw(1);
      gl.depthMask(true);
      gl.bindVertexArray(null);
      this.endTimer(query);
      return {
        instances: look.count,
        vertices: look.vertices,
        gpuMs: this.gpuMs.length > 0 ? median(this.gpuMs) : undefined,
      };
    }

    const u = this.arrowUniforms;
    gl.useProgram(this.arrowProgram);
    uploadCut(u);
    gl.uniformMatrix4fv(u.u_mathToView, false, mathToView);
    gl.uniformMatrix4fv(u.u_projection, false, camera.projection);
    gl.uniform1i(u.u_ortho, camera.orthographic ? 1 : 0);
    gl.uniform1f(u.u_viewportH, camera.height);
    gl.uniform3fv(u.u_boxMin, box.min);
    gl.uniform3fv(u.u_boxMax, box.max);
    gl.uniform1i(u.u_sampling, SAMPLING_INDEX[s.sampling]);
    gl.uniform1i(u.u_count, s.count);
    gl.uniform1i(u.u_sliceAxis, s.sliceAxis);
    gl.uniform1f(u.u_slicePos, s.slicePosition);
    gl.uniform1i(u.u_shape, SHAPE_INDEX[s.shape]);
    gl.uniform1i(u.u_lengthMode, LENGTH_INDEX[s.lengthMode]);
    gl.uniform1f(u.u_length, s.length);
    gl.uniform1f(u.u_cap, 0.125 * 2 * Math.sqrt(3));
    gl.uniform1f(u.u_widthPx, s.widthPx);
    gl.uniform1i(u.u_colorMode, s.colorMode === "fixed" ? 1 : 0);
    gl.uniform3fv(u.u_fixedColor, s.fixedColor);
    gl.uniform1f(u.u_speedScale, Math.max(1e-9, s.speedScale));
    gl.uniform2fv(u.u_depthRange, depthRange(camera, box));
    gl.uniform1i(u.u_clip, s.clip ? 1 : 0);
    gl.uniform1i(u.u_shading, s.shading ? 1 : 0);
    gl.uniform1i(u.u_outline, s.outline ? 1 : 0);
    gl.uniform1f(u.u_fog, s.fog ? 1 : 0);
    uploadPalette(u);

    const mode = s.shape === "lines" ? gl.LINES : gl.TRIANGLES;
    const drawAll = () => gl.drawArraysInstanced(mode, 0, perArrow, instances);

    if (depthTested && s.occlusion === "fade") {
      // What the surface hides, drawn faintly first: only fragments behind
      // our copy of the surface pass a GREATER test against its depth.
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.GREATER);
      gl.depthMask(false);
      gl.uniform1f(u.u_alpha, 0.22);
      drawAll();
    }
    gl.uniform1f(u.u_alpha, 1);
    if (depthTested || s.selfDepth) {
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.depthMask(s.selfDepth);
    } else {
      gl.disable(gl.DEPTH_TEST);
    }
    drawAll();
    gl.depthMask(true);
    gl.bindVertexArray(null);
    this.endTimer(query);
    return {
      instances,
      vertices: instances * perArrow,
      gpuMs: this.gpuMs.length > 0 ? median(this.gpuMs) : undefined,
    };
  }

  private endTimer(query: WebGLQuery | null) {
    if (query === null || this.timer === null) return;
    this.gl.endQuery(this.timer.TIME_ELAPSED_EXT);
    this.pending.push(query);
  }

  private collectTimer() {
    const { gl } = this;
    if (this.timer === null) return;
    const disjoint = gl.getParameter(this.timer.GPU_DISJOINT_EXT) as boolean;
    while (this.pending.length > 0) {
      const query = this.pending[0];
      if (!(gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE) as boolean))
        break;
      this.pending.shift();
      if (!disjoint) {
        this.gpuMs.push(
          (gl.getQueryParameter(query, gl.QUERY_RESULT) as number) / 1e6
        );
        if (this.gpuMs.length > 30) this.gpuMs.shift();
      }
      gl.deleteQuery(query);
    }
  }
}

/**
 * The corners of the cut faces, four per quad, in math coordinates. Each quad
 * is drawn far larger than the box and clipped to it in the fragment shader,
 * which is simpler than intersecting a plane with a box exactly.
 */
function cutFaces(
  mode: "half" | "wedge",
  angle: number,
  azimuth: number,
  centre: number[],
  half: number[],
  depthRow: number[]
): number[][] {
  const at = (x: number, y: number, z: number) => [
    centre[0] + half[0] * x,
    centre[1] + half[1] * y,
    centre[2] + half[2] * z,
  ];
  if (mode === "wedge") {
    const quads: number[][] = [];
    for (const theta of [azimuth - angle / 2, azimuth + angle / 2]) {
      const [c, s] = [Math.cos(theta) * 2, Math.sin(theta) * 2];
      quads.push(at(0, 0, -1), at(c, s, -1), at(c, s, 1), at(0, 0, 1));
    }
    return quads;
  }
  // The plane through the centre that faces the camera: everything whose
  // view depth equals the centre's. Two directions with no depth component
  // span it, found from the depth row of math-to-view.
  const n = depthRow;
  const other = Math.abs(n[0]) < 0.9 * Math.hypot(...n) ? [1, 0, 0] : [0, 1, 0];
  const cross = (a: number[], b: number[]) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const unit = (v: number[]) => v.map((x) => x / Math.hypot(...v));
  const reach = 4 * Math.hypot(...half);
  const u = unit(cross(n, other)).map((x) => x * reach);
  const v = unit(cross(n, u)).map((x) => x * reach);
  const corner = (a: number, b: number) =>
    centre.map((c, i) => c + a * u[i] + b * v[i]);
  return [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)];
}

/** The nearest and farthest the box's corners are from the camera. */
export function depthRange(camera: Camera3D, box: Box): [number, number] {
  const m = multiplyMat4(camera.view, camera.world);
  let near = Infinity;
  let far = -Infinity;
  for (let i = 0; i < 8; i++) {
    const x = i & 1 ? box.max[0] : box.min[0];
    const y = i & 2 ? box.max[1] : box.min[1];
    const z = i & 4 ? box.max[2] : box.min[2];
    const depth = -(m[2] * x + m[6] * y + m[10] * z + m[14]);
    near = Math.min(near, depth);
    far = Math.max(far, depth);
  }
  return [near, far];
}

/** The box's size on screen, in CSS pixels: the diagonal of its outline. */
export function boxScreenSize(camera: Camera3D, box: Box) {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < 8; i++) {
    const p = projectToScreen(
      camera,
      i & 1 ? box.max[0] : box.min[0],
      i & 2 ? box.max[1] : box.min[1],
      i & 4 ? box.max[2] : box.min[2]
    );
    if (p === undefined) continue;
    x0 = Math.min(x0, p.x);
    x1 = Math.max(x1, p.x);
    y0 = Math.min(y0, p.y);
    y1 = Math.max(y1, p.y);
  }
  return Math.hypot(x1 - x0, y1 - y0);
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}
