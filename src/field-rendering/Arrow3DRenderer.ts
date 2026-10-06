/**
 * Live arrows for a field on Desmos 3D, drawn on `Overlay3D`'s canvas.
 *
 * The 2D `ArrowRenderer` model carried over: the field is evaluated in the
 * vertex shader, the glyph exists only in that shader, addressed by
 * `gl_VertexID` and `gl_InstanceID`, and the whole field is one draw call with
 * no vertex buffer.
 *
 * What is new is where the glyph is built. The arrow's two ends are placed in
 * math coordinates, so its tip lands on `start + F` the way Desmos's own
 * `vector(start, end)` would however unequal the box's axes are. Its body is
 * then built in camera space, where lengths are the same in every direction,
 * so a shaft stays round and a head stays a cone in a box twenty units wide
 * and two tall.
 *
 * Ported from the step-1 mock-up, where every choice here was settled against
 * a picture: `docs/mockups/vector-3d-arrows/README.md` has the measurements.
 */
import { multiplyMat4, projectToScreen, type Camera3D } from "./camera3d";
import {
  field3dFunctions,
  sameField3D,
  uploadField3DParameters,
  type Field3D,
} from "./field3d";
import { FlowRendererError } from "./FlowRenderer";
import {
  CLIP_GLSL,
  CUT_GLSL,
  cutUniforms,
  depthRange,
  HASH_GLSL,
  PLACEMENT_INDEX,
  SAMPLE_GLSL,
  uploadCut,
  type CutSettings,
  type Placement3D,
} from "./glsl3d";
import type { Box3D, Overlay3DRenderer } from "./Overlay3D";
import { PALETTE_GLSL, paletteUniforms, type PaletteID } from "./palettes";

export type ArrowShape3D = "lines" | "flat" | "solid";
export type ArrowLength3D = "normalized" | "saturating" | "clamped" | "actual";
/** What Auto takes the colour scale from; see `Arrow3DOptions.scale`. */
export type ScaleRule3D = "field" | "box";

export interface Arrow3DOptions {
  shape: ArrowShape3D | "auto";
  placement: Placement3D;
  /** Arrows per axis, or Auto from the box's size on screen. */
  count: number | "auto";
  sliceAxis: 0 | 1 | 2;
  /** 0..1 across the box along the slice axis. */
  slicePosition: number;
  lengthMode: ArrowLength3D;
  /** The arrow's nominal length as a multiple of the spacing between arrows. */
  lengthMultiple: number;
  /** Shaft width in CSS pixels. */
  widthPx: number;
  colorMode: "magnitude" | "fixed";
  palette: PaletteID;
  fixedColor: string;
  saturation: number;
  contrast: number;
  /**
   * The magnitude that lands 63% of the way along the saturating ramp, or a
   * rule for choosing it.
   *
   * `field`: the median |F| over the arrows drawn, ÷ ln 2, so the median lands
   * mid-ramp. A median survives a pole by construction: a pole moves a handful
   * of samples and the median does not care how large those few are.
   * `box`: the 2D overlay's rule, a third of the box's mean width — which on a
   * point charge left 97% of the arrows in the first tenth of the ramp,
   * because an inverse-square field is small almost everywhere in a box.
   */
  scale: number | ScaleRule3D;
  shading: boolean;
  fog: boolean;
  outline: boolean;
  /** Whether arrows hide each other. */
  selfDepth: boolean;
  /** Whether anything outside the box is cut off, as Desmos does. */
  clip: boolean;
  cut: CutSettings;
}

export const DEFAULT_ARROW_3D_OPTIONS: Arrow3DOptions = {
  shape: "auto",
  placement: "jitter",
  count: "auto",
  sliceAxis: 2,
  slicePosition: 0.5,
  lengthMode: "normalized",
  lengthMultiple: 0.8,
  widthPx: 3,
  colorMode: "magnitude",
  palette: "spectral",
  fixedColor: "#2f6fd6",
  saturation: 1,
  contrast: 1,
  scale: "field",
  shading: true,
  fog: false,
  outline: false,
  selfDepth: true,
  clip: true,
  cut: { cutaway: "off", angle: Math.PI / 2, turn: undefined },
};

/** Sides of the shaded glyph's cylinder and cone. */
export const SIDES = 10;

/** How many vertices one arrow costs, per shape. */
export function verticesPerArrow3D(shape: ArrowShape3D) {
  if (shape === "lines") return 6;
  if (shape === "flat") return 9;
  // A cylinder (two triangles a side), a cone (one a side) and the disc that
  // closes the cone's base (one a side). The shaft's tail is left open: it is
  // a few pixels across and never faces the camera for long.
  return 12 * SIDES;
}

/** Arrows asked for: per axis cubed in a volume, squared on a slice or surface. */
export function arrowInstances3D(placement: Placement3D, count: number) {
  return placement === "grid" || placement === "jitter"
    ? count ** 3
    : count ** 2;
}

/**
 * Auto's count, from the box's size on screen: about one arrow per 75 px
 * across a volume, one per 34 px across a slice or a surface, so the field
 * reads the same whether the box fills the view or a corner of it.
 */
export function autoArrowCount3D(placement: Placement3D, boxPx: number) {
  const volume = placement === "grid" || placement === "jitter";
  return volume
    ? clamp(Math.round(boxPx / 75), 4, 12)
    : clamp(Math.round(boxPx / 34), 8, 32);
}

/**
 * Auto's glyph: shaded 3D until the field is dense enough that its shading
 * turns into noise and its vertices into cost. Measured on an Iris Xe: 1,000
 * shaded arrows ≈ 1.6 ms, 3,375 ≈ 4 ms, 8,000 ≈ 6.5 ms.
 */
export function autoArrowShape3D(instances: number): ArrowShape3D {
  return instances <= 3000 ? "solid" : "flat";
}

/** The 2D overlay's colour scale, a third of the width, in 3D. */
export function boxScale3D(box: Box3D) {
  const w = [0, 1, 2].map((i) => box.max[i] - box.min[i]);
  return (w[0] + w[1] + w[2]) / 9;
}

/** What the last frame drew, for the panel and the tests. */
export interface Arrow3DFrame {
  instances: number;
  count: number;
  shape: ArrowShape3D;
  speedScale: number;
  scaleSource: ScaleRule3D | "manual";
  /** The box's size on screen, which Auto's count follows. */
  boxPx: number;
  /** The camera's direction round z, for fixing a cake slice in place. */
  cameraAzimuth: number;
}

const SHAPE_INDEX: Record<ArrowShape3D, number> = {
  lines: 0,
  flat: 1,
  solid: 2,
};
const LENGTH_INDEX: Record<ArrowLength3D, number> = {
  normalized: 0,
  saturating: 1,
  clamped: 2,
  actual: 3,
};
/** However long Auto would make it, no arrow is longer than this, in box half-widths: an eighth of the diagonal. */
const LENGTH_CAP = 0.125 * 2 * Math.sqrt(3);
/** At most this many samples are read back to find the median. */
const SCALE_SAMPLES = 4096;
const SCALE_WIDTH = 64;

function arrowVertexSource(field: Field3D) {
  return `#version 300 es
precision highp float;
precision highp int;
uniform mat4 u_mathToView;
uniform mat4 u_projection;
uniform int u_ortho;
uniform float u_viewportH;
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

${field3dFunctions(field)}
${HASH_GLSL}
${CLIP_GLSL}
${CUT_GLSL}
${PALETTE_GLSL}
float vtSurface(vec2 p) { return vtUndefined(); }
${SAMPLE_GLSL}

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
  // The cutaway takes whole arrows: one that starts inside the cut is not
  // drawn, and one that starts outside is drawn whole even if its tip
  // reaches in. Clipping fragments instead sliced arrows along the cut's
  // edge into stubs.
  if (vtCutAway(pos, a)) { vtHide(); return; }
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
uniform int u_clip;
uniform int u_shape;
uniform int u_ortho;
uniform int u_shading;
uniform int u_outline;
uniform float u_fog;
uniform float u_alpha;
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

/**
 * |F| at the samples the arrows use, one texel each, for the median the
 * field's colour scale is taken from. The GPU's own evaluation of the same
 * code, so the scale and the arrows cannot disagree about the field.
 */
function magnitudeVertexSource(field: Field3D) {
  return `#version 300 es
precision highp float;
precision highp int;
uniform int u_total;
uniform int u_taken;
out float v_m;
${field3dFunctions(field)}
${HASH_GLSL}
${CLIP_GLSL}
float vtSurface(vec2 p) { return vtUndefined(); }
${SAMPLE_GLSL}
void main() {
  int i = gl_VertexID;
  // Spread over all the arrows when there are more than can be read back.
  int id = int(floor(float(i) * float(u_total) / float(u_taken)));
  vec3 pos;
  v_m = vtSample(id, pos) ? length(vtField(pos)) : -1.0;
  vec2 texel = vec2(float(i % ${SCALE_WIDTH}), float(i / ${SCALE_WIDTH})) + 0.5;
  vec2 size = vec2(${SCALE_WIDTH}.0, float(${SCALE_SAMPLES / SCALE_WIDTH}));
  gl_Position = vec4(texel / size * 2.0 - 1.0, 0.0, 1.0);
  gl_PointSize = 1.0;
}
`;
}

const MAGNITUDE_FRAGMENT = `#version 300 es
precision highp float;
in float v_m;
out vec4 outColor;
void main() { outColor = vec4(v_m, 0.0, 0.0, 1.0); }
`;

type Uniforms = Record<string, WebGLUniformLocation | null>;

export class Arrow3DRenderer implements Overlay3DRenderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly vao: WebGLVertexArrayObject;
  private program?: WebGLProgram;
  private uniforms: Uniforms = {};
  private magnitudeProgram?: WebGLProgram;
  private magnitudeUniforms: Uniforms = {};
  private magnitudeTarget?: {
    framebuffer: WebGLFramebuffer;
    texture: WebGLTexture;
  };
  private readonly canReadBack: boolean;
  private field?: Field3D;
  private options: Arrow3DOptions = DEFAULT_ARROW_3D_OPTIONS;
  private parameters: ReadonlyMap<string, number> = new Map();
  private time = 0;
  private cssHeight = 1;
  /** The median |F| and what it was measured for. */
  private median?: { key: string; value: number };
  last?: Arrow3DFrame;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", {
      antialias: true,
      premultipliedAlpha: true,
      alpha: true,
      depth: true,
    });
    if (gl === null) {
      throw new FlowRendererError(
        "This browser cannot draw the 3D field: it has no WebGL2."
      );
    }
    this.gl = gl;
    this.vao = gl.createVertexArray()!;
    this.canReadBack = gl.getExtension("EXT_color_buffer_float") !== null;
  }

  get isContextLost() {
    return this.gl.isContextLost();
  }

  /** Arrows are a still picture; the plugin's clock redraws a field with t. */
  readonly animating = false;

  /** Builds the shaders if the field changed; a no-op otherwise. */
  setField(field: Field3D) {
    if (sameField3D(this.field, field) && this.program !== undefined) return;
    const { gl } = this;
    const program = link(gl, arrowVertexSource(field), ARROW_FRAGMENT);
    if (this.program !== undefined) gl.deleteProgram(this.program);
    this.program = program;
    this.uniforms = uniformsOf(gl, program);
    if (this.magnitudeProgram !== undefined)
      gl.deleteProgram(this.magnitudeProgram);
    this.magnitudeProgram = this.canReadBack
      ? link(gl, magnitudeVertexSource(field), MAGNITUDE_FRAGMENT)
      : undefined;
    this.magnitudeUniforms =
      this.magnitudeProgram !== undefined
        ? uniformsOf(gl, this.magnitudeProgram)
        : {};
    this.field = field;
    this.median = undefined;
  }

  setOptions(options: Arrow3DOptions) {
    this.options = options;
  }

  setParameters(values: ReadonlyMap<string, number>) {
    this.parameters = values;
  }

  setTime(seconds: number) {
    this.time = seconds;
  }

  resize(width: number, height: number, pixelRatio: number) {
    this.cssHeight = Math.max(1, height);
    const w = Math.max(1, Math.round(width * pixelRatio));
    const h = Math.max(1, Math.round(height * pixelRatio));
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;
  }

  draw(camera: Camera3D, box: Box3D) {
    const { gl, options: o } = this;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clearDepth(1);
    gl.depthMask(true);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const { field, program } = this;
    if (field === undefined || program === undefined) return;

    const mathToView = multiplyMat4(camera.view, camera.world);
    const boxPx = boxScreenSize(camera, box);
    const count =
      o.count === "auto"
        ? autoArrowCount3D(o.placement, boxPx)
        : clamp(Math.round(o.count), 1, 64);
    const instances = arrowInstances3D(o.placement, count);
    const shape = o.shape === "auto" ? autoArrowShape3D(instances) : o.shape;
    const { speedScale, scaleSource } = this.speedScale(box, count, instances);
    const cut = cutUniforms(mathToView, box, o.cut);

    gl.bindVertexArray(this.vao);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const u = this.uniforms;
    gl.useProgram(program);
    uploadField3DParameters(gl, u, field, this.parameters, this.time);
    gl.uniformMatrix4fv(u.u_mathToView, false, mathToView);
    gl.uniformMatrix4fv(u.u_projection, false, camera.projection);
    gl.uniform1i(u.u_ortho, camera.orthographic ? 1 : 0);
    gl.uniform1f(u.u_viewportH, this.cssHeight);
    gl.uniform3fv(u.u_boxMin, box.min);
    gl.uniform3fv(u.u_boxMax, box.max);
    gl.uniform1i(u.u_sampling, PLACEMENT_INDEX[o.placement]);
    gl.uniform1i(u.u_count, count);
    gl.uniform1i(u.u_sliceAxis, o.sliceAxis);
    gl.uniform1f(u.u_slicePos, o.slicePosition);
    gl.uniform1i(u.u_shape, SHAPE_INDEX[shape]);
    gl.uniform1i(u.u_lengthMode, LENGTH_INDEX[o.lengthMode]);
    // The spacing is two box half-widths over the count.
    gl.uniform1f(u.u_length, (o.lengthMultiple * 2) / count);
    gl.uniform1f(u.u_cap, LENGTH_CAP);
    gl.uniform1f(u.u_widthPx, o.widthPx);
    gl.uniform1i(u.u_colorMode, o.colorMode === "fixed" ? 1 : 0);
    gl.uniform3fv(u.u_fixedColor, hexToUnitRGB(o.fixedColor));
    gl.uniform1f(u.u_speedScale, Math.max(1e-9, speedScale));
    gl.uniform2fv(u.u_depthRange, depthRange(mathToView, box));
    gl.uniform1i(u.u_clip, o.clip ? 1 : 0);
    gl.uniform1i(u.u_shading, o.shading ? 1 : 0);
    gl.uniform1i(u.u_outline, o.outline ? 1 : 0);
    gl.uniform1f(u.u_fog, o.fog ? 1 : 0);
    gl.uniform1f(u.u_alpha, 1);
    uploadCut(gl, u, cut);
    const palette = paletteUniforms(o.palette);
    gl.uniform1fv(u.u_paletteAt, palette.positions);
    gl.uniform3fv(u.u_paletteRGB, palette.colors);
    gl.uniform1i(u.u_paletteCount, palette.count);
    gl.uniform1i(u.u_paletteIsHue, o.palette === "direction-hue" ? 1 : 0);
    gl.uniform1f(u.u_saturation, o.saturation);
    gl.uniform1f(u.u_contrast, o.contrast);

    if (o.selfDepth) {
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.depthMask(true);
    } else {
      gl.disable(gl.DEPTH_TEST);
    }
    gl.drawArraysInstanced(
      shape === "lines" ? gl.LINES : gl.TRIANGLES,
      0,
      verticesPerArrow3D(shape),
      instances
    );
    gl.bindVertexArray(null);
    this.last = {
      instances,
      count,
      shape,
      speedScale,
      scaleSource,
      boxPx,
      cameraAzimuth: cut.facing,
    };
  }

  /**
   * The colour scale for this frame: a number given outright, or one of the
   * two rules. The field rule's median is measured only when what it depends
   * on changes — never on a rotation — and falls back to the box rule where
   * the browser cannot read a float back.
   */
  private speedScale(
    box: Box3D,
    count: number,
    instances: number
  ): { speedScale: number; scaleSource: ScaleRule3D | "manual" } {
    const { scale } = this.options;
    if (typeof scale === "number")
      return { speedScale: scale, scaleSource: "manual" };
    if (scale === "field") {
      const median = this.measureMedian(box, count, instances);
      if (median !== undefined && median > 0) {
        return { speedScale: median / Math.LN2, scaleSource: "field" };
      }
    }
    return { speedScale: boxScale3D(box), scaleSource: "box" };
  }

  private measureMedian(box: Box3D, count: number, instances: number) {
    const { gl, magnitudeProgram, field } = this;
    if (magnitudeProgram === undefined || field === undefined) return undefined;
    const o = this.options;
    const params = [...this.parameters].map(([k, v]) => `${k}=${v}`).join();
    const key = [
      box.min.join(),
      box.max.join(),
      o.placement,
      count,
      o.sliceAxis,
      o.slicePosition,
      params,
      // A field that moves with time is re-measured every half second, not
      // every frame: a readback stalls the pipeline.
      field.usesTime ? Math.floor(this.time * 2) : 0,
    ].join("|");
    if (this.median?.key === key) return this.median.value;

    const taken = Math.min(instances, SCALE_SAMPLES);
    const height = SCALE_SAMPLES / SCALE_WIDTH;
    if (this.magnitudeTarget === undefined) {
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, SCALE_WIDTH, height);
      const framebuffer = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        texture,
        0
      );
      this.magnitudeTarget = { framebuffer, texture };
    }
    const u = this.magnitudeUniforms;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.magnitudeTarget.framebuffer);
    gl.viewport(0, 0, SCALE_WIDTH, height);
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.clearColor(-1, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(magnitudeProgram);
    gl.bindVertexArray(this.vao);
    uploadField3DParameters(gl, u, field, this.parameters, this.time);
    gl.uniform3fv(u.u_boxMin, box.min);
    gl.uniform3fv(u.u_boxMax, box.max);
    gl.uniform1i(u.u_sampling, PLACEMENT_INDEX[o.placement]);
    gl.uniform1i(u.u_count, count);
    gl.uniform1i(u.u_sliceAxis, o.sliceAxis);
    gl.uniform1f(u.u_slicePos, o.slicePosition);
    gl.uniform1i(u.u_total, instances);
    gl.uniform1i(u.u_taken, taken);
    gl.drawArrays(gl.POINTS, 0, taken);
    const pixels = new Float32Array(SCALE_WIDTH * height * 4);
    gl.readPixels(0, 0, SCALE_WIDTH, height, gl.RGBA, gl.FLOAT, pixels);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.enable(gl.BLEND);

    const magnitudes: number[] = [];
    for (let i = 0; i < taken; i++) {
      const m = pixels[i * 4];
      if (m > 1e-9 && Number.isFinite(m)) magnitudes.push(m);
    }
    magnitudes.sort((a, b) => a - b);
    const value =
      magnitudes.length > 0
        ? magnitudes[Math.floor(magnitudes.length / 2)]
        : undefined;
    if (value !== undefined) this.median = { key, value };
    return value;
  }

  destroy() {
    const { gl } = this;
    if (this.program !== undefined) gl.deleteProgram(this.program);
    if (this.magnitudeProgram !== undefined)
      gl.deleteProgram(this.magnitudeProgram);
    if (this.magnitudeTarget !== undefined) {
      gl.deleteFramebuffer(this.magnitudeTarget.framebuffer);
      gl.deleteTexture(this.magnitudeTarget.texture);
    }
    gl.deleteVertexArray(this.vao);
    this.program = undefined;
    this.magnitudeProgram = undefined;
    this.magnitudeTarget = undefined;
  }
}

/** The box's size on screen, in CSS pixels: the diagonal of its outline. */
export function boxScreenSize(camera: Camera3D, box: Box3D) {
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
  return Number.isFinite(x0) ? Math.hypot(x1 - x0, y1 - y0) : 0;
}

function link(gl: WebGL2RenderingContext, vertex: string, fragment: string) {
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader) ?? "";
      gl.deleteShader(shader);
      throw new FlowRendererError(
        `The 3D field's shader did not compile: ${log}`
      );
    }
    return shader;
  };
  const vs = compile(gl.VERTEX_SHADER, vertex);
  const fs = compile(gl.FRAGMENT_SHADER, fragment);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? "";
    gl.deleteProgram(program);
    throw new FlowRendererError(`The 3D field's shader did not link: ${log}`);
  }
  return program;
}

function uniformsOf(gl: WebGL2RenderingContext, program: WebGLProgram) {
  const out: Uniforms = {};
  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number;
  for (let i = 0; i < count; i++) {
    const info = gl.getActiveUniform(program, i);
    if (info === null) continue;
    out[info.name.replace(/\[0\]$/, "")] = gl.getUniformLocation(
      program,
      info.name
    );
  }
  return out;
}

function hexToUnitRGB(hex: string): [number, number, number] {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (match === null) return [0.18, 0.43, 0.84];
  const n = parseInt(match[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}
