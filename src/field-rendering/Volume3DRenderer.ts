/**
 * Two ways of drawing a field over Desmos 3D that show its middle as well as
 * its edges: streamlines traced through the box, and a glow cloud whose
 * density follows the field's strength.
 *
 * Arrows are opaque, and a box full of opaque glyphs is a wall: the front
 * layer hides the middle, which is usually where the field's structure is.
 * Both looks here are many thin, faint marks instead, so the eye sees through
 * the near ones to the far ones.
 *
 * Streamlines are traced on the GPU — RK4, at unit speed in box units, every
 * other line backwards so sources and sinks look alike — into a history
 * texture array, and kept: the trace depends on the field, the box and the
 * settings, never on the camera, so turning the view only redraws it. The
 * animated look is that of 3dstreamlines (James Runnalls, MIT): a lit stretch
 * of each line travels along it, its tail fading by exp(1 − 1/c²), each line
 * at its own phase. Here it is a window moving over the stored trace, so
 * animating integrates nothing.
 *
 * Ported from the step-1 mock-up (`docs/mockups/vector-3d-arrows/looks.ts`).
 */
import { multiplyMat4, type Camera3D } from "./camera3d";
import {
  field3dFunctions,
  sameField3D,
  uploadField3DParameters,
  type Field3D,
} from "./field3d";
import { FieldScale3D, type ScaleRule3D } from "./FieldScale3D";
import { FlowRendererError } from "./FlowRenderer";
import {
  CLIP_GLSL,
  CUT_GLSL,
  cutUniforms,
  depthRange,
  HASH_GLSL,
  hexToUnitRGB,
  uploadCut,
  type CutSettings,
} from "./glsl3d";
import type { Box3D, Overlay3DRenderer } from "./Overlay3D";
import { PALETTE_GLSL, paletteUniforms, type PaletteID } from "./palettes";
import { linkProgram3D, uniformsOf, type Uniforms } from "./program3d";
import { AUTO_SURFACE_RESOLUTION, SurfaceDepth } from "./SurfaceDepth";
import type { Surface3D } from "./surfaces3d";
import { boxScreenSize, type Occlusion3D } from "./Arrow3DRenderer";

export type VolumeLook3D = "streamlines" | "cloud";

export interface Volume3DOptions {
  look: VolumeLook3D;
  /** Streamlines, or Auto from the box's size on screen. */
  lines: number | "auto";
  /** Steps along each line. */
  steps: number;
  /** Each line's length, as a fraction of the box's diagonal. */
  lineLength: number;
  lineOpacity: number;
  /** Send a lit stretch along each streamline, with the flow. */
  animate: boolean;
  /** Line lengths travelled per second. */
  flowSpeed: number;
  /** How much of a line is lit at once. */
  flowWindow: number;
  /** Points tried for the cloud, or Auto. */
  points: number | "auto";
  pointPx: number;
  cloudOpacity: number;
  /** How sharply the cloud thins out where the field is weak. */
  cloudContrast: number;
  /** Colour the cloud by direction, which separates a dipole's lobes. */
  cloudByDirection: boolean;
  colorMode: "magnitude" | "fixed";
  palette: PaletteID;
  fixedColor: string;
  saturation: number;
  contrast: number;
  scale: number | ScaleRule3D;
  fog: boolean;
  clip: boolean;
  cut: CutSettings;
  occlusion: Occlusion3D;
  surfaceResolution: number | "auto";
  /**
   * A dark laid over the graph, as the particle flow is drawn on; "" for
   * none. On it, light builds up where lines cross.
   */
  backdrop?: string;
  backdropOpacity?: number;
}

export const DEFAULT_VOLUME_3D_OPTIONS: Volume3DOptions = {
  look: "streamlines",
  lines: "auto",
  steps: 96,
  lineLength: 0.6,
  lineOpacity: 0.4,
  animate: true,
  flowSpeed: 0.25,
  flowWindow: 0.4,
  points: "auto",
  pointPx: 2,
  cloudOpacity: 0.35,
  cloudContrast: 3,
  cloudByDirection: false,
  colorMode: "magnitude",
  palette: "spectral",
  fixedColor: "#2f6fd6",
  saturation: 1,
  contrast: 1,
  scale: "field",
  fog: false,
  clip: true,
  cut: { cutaway: "off", angle: Math.PI / 2, turn: undefined },
  occlusion: "hide",
  surfaceResolution: "auto",
};

/**
 * Auto's counts, from the box's size on screen: threads about one per 9 px of
 * it, and a cloud of about half a point per square pixel — dense enough to
 * read as a volume, faint enough to see through.
 */
export function autoLines3D(boxPx: number) {
  return clamp(Math.round((boxPx / 9) ** 2), 800, 6000);
}
export function autoPoints3D(boxPx: number) {
  return clamp(Math.round(0.5 * boxPx ** 2), 40_000, 400_000);
}

export interface Volume3DFrame {
  look: VolumeLook3D;
  /** Lines traced, or points tried. */
  count: number;
  vertices: number;
  speedScale: number;
  scaleSource: ScaleRule3D | "manual";
  boxPx: number;
  cameraAzimuth: number;
  hidingSurfaces: number;
}

/** The colour scale is measured over a jittered 10³, as the arrows' would be. */
const SCALE_SAMPLING = {
  placement: "jitter" as const,
  count: 10,
  sliceAxis: 2 as const,
  slicePosition: 0.5,
  instances: 1000,
};

/** One step of every line at once, in a fragment shader. */
function traceFragment(field: Field3D) {
  return `#version 300 es
precision highp float;
precision highp int;
uniform highp sampler2D u_state;
uniform float u_step;
uniform int u_init;
uniform int u_count;
layout(location = 0) out vec4 o_state;
layout(location = 1) out vec4 o_history;
${field3dFunctions(field)}
${HASH_GLSL}
${CLIP_GLSL}

/**
 * The direction of the line at p, at unit speed in box half-widths. A line
 * at unit speed has the same length whatever the field's magnitude, so a
 * line near a pole does not leave the box in one step and a line where the
 * field is weak does not stall: magnitude is shown by colour instead.
 */
vec3 vtDirection(vec3 p) {
  vec3 half_ = 0.5 * (u_boxMax - u_boxMin);
  vec3 w = vtField(p) / half_;
  float l = length(w);
  return l < 1.0e-12 ? vec3(0.0) : half_ * (w / l);
}

void main() {
  ivec2 q = ivec2(gl_FragCoord.xy);
  int width = textureSize(u_state, 0).x;
  int id = q.y * width + q.x;
  vec4 s;
  if (u_init == 1) {
    vec3 t = vtHash3(uint(id) * 2654435761u + 7u);
    s = vec4(mix(u_boxMin, u_boxMax, t), id < u_count ? 1.0 : -1.0);
  } else {
    s = texelFetch(u_state, q, 0);
    if (s.w > 0.0) {
      vec3 p = s.xyz;
      // Every other line is traced backwards. Traced only forwards, lines
      // start anywhere but all end in the sinks, and pile up there: a
      // negative charge would look far busier than the positive one.
      float h = id % 2 == 0 ? u_step : -u_step;
      vec3 k1 = vtDirection(p);
      vec3 k2 = vtDirection(p + 0.5 * h * k1);
      vec3 k3 = vtDirection(p + 0.5 * h * k2);
      vec3 k4 = vtDirection(p + h * k3);
      vec3 next = p + h * (k1 + 2.0 * k2 + 2.0 * k3 + k4) / 6.0;
      // A line that leaves the box, or reaches a point with no direction,
      // ends there. Its position stays where it was, so the rest of the
      // line collapses onto its last point instead of jumping anywhere.
      if (length(k1) == 0.0 || vtOutsideBox(next)) s.w = -1.0;
      else s.xyz = next;
    }
  }
  o_state = s;
  o_history = vec4(s.xyz, s.w > 0.0 ? length(vtField(s.xyz)) : -1.0);
}
`;
}

const FULLSCREEN_VERTEX = `#version 300 es
const vec2 P[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
void main() { gl_Position = vec4(P[gl_VertexID], 0.0, 1.0); }
`;

const COMMON_UNIFORMS = `
uniform mat4 u_mathToView;
uniform mat4 u_projection;
uniform float u_speedScale;
uniform int u_colorMode;
uniform vec3 u_fixedColor;
uniform float u_opacity;
uniform vec2 u_depthRange;
`;

const COLOR_GLSL = `
vec3 vtColorFor(float m) {
  return u_colorMode == 1 ? vtAdjust(u_fixedColor) : vtPalette(1.0 - exp(-m / u_speedScale));
}
float vtFogFor(vec3 view) {
  return clamp((-view.z - u_depthRange.x) / max(u_depthRange.y - u_depthRange.x, 1.0e-6), 0.0, 1.0);
}
`;

const LINE_VERTEX = `#version 300 es
precision highp float;
precision highp int;
${COMMON_UNIFORMS}
uniform highp sampler2DArray u_history;
uniform int u_width;
uniform int u_steps;
uniform int u_animate;
uniform float u_clock;
uniform float u_flowSpeed;
uniform float u_window;
out vec4 v_color;
out vec3 v_view;
out vec3 v_math;
out float v_fog;
${HASH_GLSL}
${PALETTE_GLSL}
${COLOR_GLSL}
void main() {
  int id = gl_InstanceID;
  vec4 h = texelFetch(u_history, ivec3(id % u_width, id / u_width, gl_VertexID), 0);
  vec3 view = (u_mathToView * vec4(h.xyz, 1.0)).xyz;
  v_view = view;
  v_math = h.xyz;
  v_fog = vtFogFor(view);
  gl_Position = u_projection * vec4(view, 1.0);
  // How far along the flow this vertex is, 0 at the upstream end. A line
  // traced backwards was stored downstream-first, so it counts the other way.
  float k = float(gl_VertexID);
  float along = (id % 2 == 0 ? k : float(u_steps - 1) - k) / float(max(u_steps - 1, 1));
  float taper;
  if (u_animate == 1) {
    float period = 1.0 + u_window;
    float phase = vtHash3(uint(id) * 747796405u + 11u).x * period;
    float head = mod(u_clock * u_flowSpeed + phase, period);
    float behind = head - along;
    float c = 1.0 - behind / u_window;
    taper = behind < 0.0 || behind > u_window ? 0.0 : exp(1.0 - 1.0 / max(c * c, 1.0e-3));
  } else {
    // Each line fades in from one end and out towards the other, so lines
    // read as threads rather than as hard-ended sticks.
    taper = smoothstep(0.0, 0.12, along) * (1.0 - smoothstep(0.75, 1.0, along));
  }
  float a = h.w < 0.0 ? 0.0 : u_opacity * taper;
  v_color = vec4(vtColorFor(h.w) * a, a);
}
`;

function cloudVertexSource(field: Field3D) {
  return `#version 300 es
precision highp float;
precision highp int;
${COMMON_UNIFORMS}
uniform float u_pointPx;
uniform float u_densityContrast;
uniform int u_byDirection;
out vec4 v_color;
out vec3 v_view;
out vec3 v_math;
out float v_fog;
${field3dFunctions(field)}
${HASH_GLSL}
${CLIP_GLSL}
${PALETTE_GLSL}
${COLOR_GLSL}
void main() {
  uint id = uint(gl_VertexID);
  vec3 p = mix(u_boxMin, u_boxMax, vtHash3(id * 2246822519u + 3u));
  vec3 F = vtField(p);
  float m = length(F);
  float ramp = 1.0 - exp(-m / u_speedScale);
  // Keep a point with probability rising with the ramp, so the cloud is
  // dense where the field is strong and thins out to nothing where it is
  // weak: the field's own shape drawn as density. The exponent sharpens that
  // edge without moving where it is.
  if (vtHash3(id ^ 0x68bc21ebu).x > pow(ramp, u_densityContrast)) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    v_color = vec4(0.0);
    return;
  }
  vec3 view = (u_mathToView * vec4(p, 1.0)).xyz;
  v_view = view;
  v_math = p;
  v_fog = vtFogFor(view);
  gl_Position = u_projection * vec4(view, 1.0);
  gl_PointSize = u_pointPx;
  // By direction: the absolute direction as red, green and blue, the map 3D
  // flow and diffusion imaging use. Strength alone is a featureless blob for
  // many fields (a dipole's is); direction is what separates its lobes.
  vec3 rgb = u_byDirection == 1 ? abs(F) / max(m, 1.0e-12) : vtColorFor(m);
  v_color = vec4(rgb * u_opacity, u_opacity);
}
`;
}

const GLOW_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
uniform int u_clip;
uniform int u_round;
uniform float u_fog;
uniform float u_alpha;
in vec4 v_color;
in vec3 v_view;
in vec3 v_math;
in float v_fog;
out vec4 outColor;
${CLIP_GLSL}
${CUT_GLSL}
void main() {
  if (u_clip == 1 && vtOutsideBox(v_math)) discard;
  if (vtCutAway(v_math, v_view)) discard;
  float a = 1.0;
  if (u_round == 1) {
    float r = length(gl_PointCoord - 0.5);
    if (r > 0.5) discard;
    a = 1.0 - smoothstep(0.3, 0.5, r);
  }
  a *= u_alpha * mix(1.0, 0.25, v_fog * u_fog);
  outColor = v_color * a;
}
`;

export class Volume3DRenderer implements Overlay3DRenderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly vao: WebGLVertexArrayObject;
  private readonly framebuffer: WebGLFramebuffer;
  private readonly lineProgram: WebGLProgram;
  private readonly lineUniforms: Uniforms;
  private traceProgram?: WebGLProgram;
  private traceUniforms: Uniforms = {};
  private cloudProgram?: WebGLProgram;
  private cloudUniforms: Uniforms = {};
  private readonly surfaceDepth: SurfaceDepth;
  private readonly scale: FieldScale3D;
  private readonly canTrace: boolean;
  private state: WebGLTexture[] = [];
  private history?: WebGLTexture;
  private traceKey = "";
  private traceWidth = 0;
  private historySteps = 0;
  private field?: Field3D;
  private fieldVersion = 0;
  private options: Volume3DOptions = DEFAULT_VOLUME_3D_OPTIONS;
  private parameters: ReadonlyMap<string, number> = new Map();
  /** The field's own clock, `t`. */
  private time = 0;
  private pixelRatio = 1;
  last?: Volume3DFrame;

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
    this.vao = gl.createVertexArray();
    this.framebuffer = gl.createFramebuffer();
    this.canTrace = gl.getExtension("EXT_color_buffer_float") !== null;
    this.lineProgram = linkProgram3D(gl, LINE_VERTEX, GLOW_FRAGMENT);
    this.lineUniforms = uniformsOf(gl, this.lineProgram);
    this.surfaceDepth = new SurfaceDepth(gl);
    this.scale = new FieldScale3D(gl, this.vao);
  }

  get isContextLost() {
    return this.gl.isContextLost();
  }

  /** Animated streamlines want frames between Desmos's redraws. */
  get animating() {
    return this.options.look === "streamlines" && this.options.animate;
  }

  setField(field: Field3D) {
    if (sameField3D(this.field, field) && this.cloudProgram !== undefined)
      return;
    const { gl } = this;
    const cloud = linkProgram3D(gl, cloudVertexSource(field), GLOW_FRAGMENT);
    const trace = this.canTrace
      ? linkProgram3D(gl, FULLSCREEN_VERTEX, traceFragment(field))
      : undefined;
    if (this.cloudProgram !== undefined) gl.deleteProgram(this.cloudProgram);
    if (this.traceProgram !== undefined) gl.deleteProgram(this.traceProgram);
    this.cloudProgram = cloud;
    this.cloudUniforms = uniformsOf(gl, cloud);
    this.traceProgram = trace;
    this.traceUniforms = trace !== undefined ? uniformsOf(gl, trace) : {};
    this.field = field;
    this.fieldVersion++;
    this.scale.setField(field);
  }

  setSurfaces(surfaces: readonly Surface3D[]) {
    this.surfaceDepth.setSurfaces(surfaces);
  }

  setOptions(options: Volume3DOptions) {
    this.options = options;
  }

  setParameters(values: ReadonlyMap<string, number>) {
    this.parameters = values;
  }

  setTime(seconds: number) {
    this.time = seconds;
  }

  resize(width: number, height: number, pixelRatio: number) {
    this.pixelRatio = pixelRatio;
    const w = Math.max(1, Math.round(width * pixelRatio));
    const h = Math.max(1, Math.round(height * pixelRatio));
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;
  }

  draw(camera: Camera3D, box: Box3D, clock: number) {
    const { gl, options: o, field } = this;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    const dark = o.backdrop !== undefined && o.backdrop !== "";
    const [br, bg, bb] = hexToUnitRGB(dark ? o.backdrop! : "#000000");
    const ba = dark ? Math.min(1, Math.max(0, o.backdropOpacity ?? 0.9)) : 0;
    gl.clearColor(br * ba, bg * ba, bb * ba, ba);
    gl.clearDepth(1);
    gl.depthMask(true);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    if (field === undefined || this.cloudProgram === undefined) return;
    if (o.look === "streamlines" && !this.canTrace) {
      throw new FlowRendererError(
        "Streamlines need float render targets, which this browser does not offer. The arrows and the glow cloud still work."
      );
    }

    const mathToView = multiplyMat4(camera.view, camera.world);
    const boxPx = boxScreenSize(camera, box);
    const { speedScale, scaleSource } = this.scale.resolve(
      o.scale,
      box,
      SCALE_SAMPLING,
      this.parameters,
      this.time
    );
    const lines =
      o.lines === "auto"
        ? autoLines3D(boxPx)
        : Math.max(1, Math.round(o.lines));
    const points =
      o.points === "auto"
        ? autoPoints3D(boxPx)
        : Math.max(1, Math.round(o.points));
    if (o.look === "streamlines") this.trace(box, lines, o.steps, o.lineLength);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.bindVertexArray(this.vao);
    gl.enable(gl.BLEND);
    // On the backdrop, screen blending, as the particle flow: crossings
    // brighten towards white without passing it.
    if (ba > 0) {
      gl.blendFuncSeparate(
        gl.ONE,
        gl.ONE_MINUS_SRC_COLOR,
        gl.ONE,
        gl.ONE_MINUS_SRC_ALPHA
      );
    } else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const cut = cutUniforms(mathToView, box, o.cut);
    const occluding = o.occlusion !== "over" && this.surfaceDepth.count > 0;
    if (occluding) {
      this.surfaceDepth.draw(
        mathToView,
        camera.projection,
        box,
        o.surfaceResolution === "auto"
          ? AUTO_SURFACE_RESOLUTION
          : o.surfaceResolution,
        this.parameters,
        this.time
      );
    }

    const streamlines = o.look === "streamlines";
    const program = streamlines ? this.lineProgram : this.cloudProgram;
    const u = streamlines ? this.lineUniforms : this.cloudUniforms;
    gl.useProgram(program);
    gl.uniformMatrix4fv(u.u_mathToView, false, mathToView);
    gl.uniformMatrix4fv(u.u_projection, false, camera.projection);
    gl.uniform3fv(u.u_boxMin, box.min);
    gl.uniform3fv(u.u_boxMax, box.max);
    gl.uniform1f(u.u_speedScale, Math.max(1e-9, speedScale));
    gl.uniform1i(u.u_colorMode, o.colorMode === "fixed" ? 1 : 0);
    gl.uniform3fv(u.u_fixedColor, hexToUnitRGB(o.fixedColor));
    gl.uniform2fv(u.u_depthRange, depthRange(mathToView, box));
    gl.uniform1i(u.u_clip, o.clip ? 1 : 0);
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
    let draw: () => void;
    if (streamlines) {
      gl.uniform1f(u.u_opacity, o.lineOpacity);
      gl.uniform1i(u.u_round, 0);
      gl.uniform1i(u.u_width, this.traceWidth);
      gl.uniform1i(u.u_steps, o.steps);
      gl.uniform1i(u.u_animate, o.animate ? 1 : 0);
      gl.uniform1f(u.u_clock, clock);
      gl.uniform1f(u.u_flowSpeed, o.flowSpeed);
      gl.uniform1f(u.u_window, o.flowWindow);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.history ?? null);
      gl.uniform1i(u.u_history, 0);
      draw = () => gl.drawArraysInstanced(gl.LINE_STRIP, 0, o.steps, lines);
    } else {
      uploadField3DParameters(gl, u, field, this.parameters, this.time);
      gl.uniform1f(u.u_opacity, o.cloudOpacity);
      gl.uniform1i(u.u_round, 1);
      gl.uniform1f(u.u_pointPx, o.pointPx * this.pixelRatio);
      gl.uniform1f(u.u_densityContrast, o.cloudContrast);
      gl.uniform1i(u.u_byDirection, o.cloudByDirection ? 1 : 0);
      draw = () => gl.drawArrays(gl.POINTS, 0, points);
    }
    // Thin, faint marks never write depth, so the near ones never hide the
    // far ones; the surfaces' copies still hide what they cover.
    gl.depthMask(false);
    if (occluding && o.occlusion === "fade") {
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.GREATER);
      gl.uniform1f(u.u_alpha, 0.25);
      draw();
      gl.uniform1f(u.u_alpha, 1);
    }
    if (occluding) {
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
    } else {
      gl.disable(gl.DEPTH_TEST);
    }
    draw();
    gl.depthMask(true);
    gl.bindVertexArray(null);
    this.last = {
      look: o.look,
      count: streamlines ? lines : points,
      vertices: streamlines ? lines * o.steps : points,
      speedScale,
      scaleSource,
      boxPx,
      cameraAzimuth: cut.facing,
      hidingSurfaces: occluding ? this.surfaceDepth.count : 0,
    };
  }

  /** Traces every line again, if anything the trace depends on changed. */
  private trace(box: Box3D, lines: number, steps: number, lineLength: number) {
    const { gl, field } = this;
    if (this.traceProgram === undefined || field === undefined) return;
    const params = [...this.parameters].map(([k, v]) => `${k}=${v}`).join();
    const key = [
      this.fieldVersion,
      box.min.join(),
      box.max.join(),
      lines,
      steps,
      lineLength,
      params,
      // A field that moves with t is retraced ten times a second, not every
      // frame: ninety-odd passes per trace.
      field.usesTime ? Math.floor(this.time * 10) : 0,
    ].join("|");
    if (key === this.traceKey) return;
    this.traceKey = key;
    const width = Math.ceil(Math.sqrt(lines));
    const height = Math.ceil(lines / width);
    const sizeChanged = width !== this.traceWidth || this.history === undefined;
    if (sizeChanged || this.historySteps !== steps) {
      for (const t of this.state) gl.deleteTexture(t);
      if (this.history !== undefined) gl.deleteTexture(this.history);
      const make2D = () => {
        const t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, width, height);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        return t;
      };
      this.state = [make2D(), make2D()];
      this.history = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.history);
      // Half floats, as for the 3D flow's trails: to about one part in two
      // thousand of the box, which no screen resolves, at half the memory —
      // what lets 200,000 lines fit on an integrated GPU.
      gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.RGBA16F, width, height, steps);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      this.traceWidth = width;
      this.historySteps = steps;
    }
    const u = this.traceUniforms;
    gl.useProgram(this.traceProgram);
    gl.bindVertexArray(this.vao);
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    gl.viewport(0, 0, width, height);
    uploadField3DParameters(gl, u, field, this.parameters, this.time);
    gl.uniform3fv(u.u_boxMin, box.min);
    gl.uniform3fv(u.u_boxMax, box.max);
    gl.uniform1i(u.u_count, lines);
    // The whole line spans lineLength of the box's diagonal, in box
    // half-widths, where the diagonal is 2√3.
    gl.uniform1f(
      u.u_step,
      (lineLength * 2 * Math.sqrt(3)) / Math.max(steps - 1, 1)
    );
    gl.uniform1i(u.u_state, 0);
    gl.activeTexture(gl.TEXTURE0);
    let read = 0;
    for (let k = 0; k < steps; k++) {
      const write = 1 - read;
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        this.state[write],
        0
      );
      gl.framebufferTextureLayer(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT1,
        this.history!,
        0,
        k
      );
      gl.bindTexture(gl.TEXTURE_2D, this.state[read]);
      gl.uniform1i(u.u_init, k === 0 ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      read = write;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.drawBuffers([gl.BACK]);
    gl.enable(gl.BLEND);
  }

  destroy() {
    const { gl } = this;
    for (const t of this.state) gl.deleteTexture(t);
    if (this.history !== undefined) gl.deleteTexture(this.history);
    if (this.cloudProgram !== undefined) gl.deleteProgram(this.cloudProgram);
    if (this.traceProgram !== undefined) gl.deleteProgram(this.traceProgram);
    gl.deleteProgram(this.lineProgram);
    gl.deleteFramebuffer(this.framebuffer);
    this.surfaceDepth.dispose();
    this.scale.dispose();
    gl.deleteVertexArray(this.vao);
  }
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}
