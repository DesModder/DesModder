/**
 * Two ways of drawing a field that show its inside as well as its outside:
 * streamlines traced through the box, and a glow cloud whose density follows
 * the field's strength.
 *
 * Arrows are opaque, and a box full of opaque glyphs is a wall: the front
 * layer hides the middle, which is usually where the interesting part of the
 * field is. Both looks here are many thin, faint marks instead, so the eye
 * sees through the near ones to the far ones, and the structure of the whole
 * volume reads at once, the way pictures of atomic orbitals and of 3D flow
 * read.
 *
 * Streamlines are traced on the GPU and kept: the trace depends on the field,
 * the box and the settings, never on the camera, so turning the view redraws
 * them from the stored trace without integrating anything again.
 */
import { GLSL_PRELUDE } from "../../../src/field-rendering/latexToGLSL";
import { PALETTE_GLSL } from "../../../src/field-rendering/palettes";
import type { Box } from "./camera";
import {
  CLIP_GLSL,
  CUT_GLSL,
  HASH_GLSL,
  program,
  uniforms,
  type Uniforms,
} from "./gl";

function fieldSource(field: string[], helpers: string) {
  return `
${GLSL_PRELUDE}
${helpers}
${HASH_GLSL}
vec3 vtField(vec3 p) {
  vec3 v = vec3(${field[0]}, ${field[1]}, ${field[2]});
  return any(isnan(v)) || any(isinf(v)) ? vec3(0.0) : v;
}
`;
}

/** One step of the trace for every line at once, in a fragment shader. */
function traceFragment(field: string[], helpers: string) {
  return `#version 300 es
precision highp float;
precision highp int;
uniform highp sampler2D u_state;
uniform vec3 u_boxMin;
uniform vec3 u_boxMax;
uniform float u_step;
uniform int u_init;
uniform int u_count;
uniform int u_seed;
layout(location = 0) out vec4 o_state;
layout(location = 1) out vec4 o_history;
${fieldSource(field, helpers)}

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

bool vtInside(vec3 p) {
  return all(greaterThanEqual(p, u_boxMin)) && all(lessThanEqual(p, u_boxMax));
}

void main() {
  ivec2 q = ivec2(gl_FragCoord.xy);
  int width = textureSize(u_state, 0).x;
  int id = q.y * width + q.x;
  vec4 s;
  if (u_init == 1) {
    vec3 t = vtHash3(uint(id) * 2654435761u + uint(u_seed));
    s = vec4(mix(u_boxMin, u_boxMax, t), id < u_count ? 1.0 : -1.0);
  } else {
    s = texelFetch(u_state, q, 0);
    if (s.w > 0.0) {
      // Fourth-order Runge-Kutta, as the 2D flow integrates.
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
      if (length(k1) == 0.0 || !vtInside(next) || any(isnan(next))) s.w = -1.0;
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
uniform vec3 u_boxMin;
uniform vec3 u_boxMax;
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
uniform float u_time;
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
  // Each line fades in from its seed and out towards its end, so lines read
  // as threads rather than as a lattice of hard-ended sticks.
  // How far along the flow this vertex is, 0 at the upstream end. A line
  // traced backwards was stored downstream-first, so it counts the other way.
  float k = float(gl_VertexID);
  float along = (id % 2 == 0 ? k : float(u_steps - 1) - k) / float(max(u_steps - 1, 1));
  float taper;
  if (u_animate == 1) {
    // The animated look of 3dstreamlines (James Runnalls, MIT): a stretch of
    // each line travels along it with the flow, its tail fading by
    // exp(1 - 1/c^2), and every line starts at its own phase so the box
    // always holds lines at every stage. Here it is a window moving over a
    // trace already stored on the GPU, so animating integrates nothing.
    float period = 1.0 + u_window;
    float phase = vtHash3(uint(id) * 747796405u + 11u).x * period;
    float head = mod(u_time * u_flowSpeed + phase, period);
    float behind = head - along;
    float c = 1.0 - behind / u_window;
    taper = behind < 0.0 || behind > u_window ? 0.0 : exp(1.0 - 1.0 / max(c * c, 1.0e-3));
  } else {
    taper = smoothstep(0.0, 0.12, along) * (1.0 - smoothstep(0.75, 1.0, along));
  }
  float a = h.w < 0.0 ? 0.0 : u_opacity * taper;
  v_color = vec4(vtColorFor(h.w) * a, a);
}
`;

const CLOUD_VERTEX = `#version 300 es
precision highp float;
precision highp int;
${COMMON_UNIFORMS}
uniform float u_pointPx;
uniform float u_contrast_;
uniform int u_byDirection;
out vec4 v_color;
out vec3 v_view;
out vec3 v_math;
out float v_fog;
FIELD_SOURCE
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
  // weak: the field's own shape, centre and edges, drawn as density. The
  // exponent sharpens that edge without moving where it is.
  float keep = pow(ramp, u_contrast_);
  if (vtHash3(id ^ 0x68bc21ebu).x > keep) {
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

const GLOW_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
uniform vec3 u_boxMin;
uniform vec3 u_boxMax;
uniform int u_clip;
${CUT_GLSL}
uniform int u_round;
uniform float u_fog;
uniform float u_alpha;
in vec4 v_color;
in vec3 v_view;
in vec3 v_math;
in float v_fog;
out vec4 outColor;
${CLIP_GLSL}
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

export interface LookSettings {
  lines: number;
  steps: number;
  /** Each line's length, as a fraction of the box's diagonal. */
  lineLength: number;
  lineOpacity: number;
  points: number;
  pointPx: number;
  cloudOpacity: number;
  /** How sharply the cloud's density follows the field. */
  cloudContrast: number;
  /** Colour the cloud by the field's direction instead of its strength. */
  cloudByDirection: boolean;
  /** Send each streamline's light along it, with the flow. */
  animate: boolean;
  /** Line lengths travelled per second. */
  flowSpeed: number;
  /** How much of a line is lit at once. */
  flowWindow: number;
  /** Seconds, for the animation. */
  time: number;
}

export interface GlowFrame {
  mathToView: number[];
  projection: readonly number[];
  box: Box;
  speedScale: number;
  colorMode: number;
  fixedColor: [number, number, number];
  depthRange: [number, number];
  clip: boolean;
  fog: boolean;
  uploadCut: (u: Uniforms) => void;
  dpr: number;
  uploadPalette: (u: Uniforms) => void;
}

export class VolumeLooks {
  private traceProgram?: WebGLProgram;
  private traceUniforms?: Uniforms;
  private cloudProgram?: WebGLProgram;
  private cloudUniforms?: Uniforms;
  private readonly lineProgram: WebGLProgram;
  private readonly lineUniforms: Uniforms;
  private readonly framebuffer: WebGLFramebuffer;
  private state: WebGLTexture[] = [];
  private history?: WebGLTexture;
  private traceKey = "";
  private width = 0;
  private fieldVersion = 0;
  readonly canTrace: boolean;

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly vao: WebGLVertexArrayObject
  ) {
    this.canTrace = gl.getExtension("EXT_color_buffer_float") !== null;
    this.lineProgram = program(gl, LINE_VERTEX, GLOW_FRAGMENT);
    this.lineUniforms = uniforms(gl, this.lineProgram);
    this.framebuffer = gl.createFramebuffer()!;
  }

  setField(field: string[], helpers: string) {
    const { gl } = this;
    this.traceProgram = program(
      gl,
      FULLSCREEN_VERTEX,
      traceFragment(field, helpers)
    );
    this.traceUniforms = uniforms(gl, this.traceProgram);
    this.cloudProgram = program(
      gl,
      CLOUD_VERTEX.replace("FIELD_SOURCE", fieldSource(field, helpers)),
      GLOW_FRAGMENT
    );
    this.cloudUniforms = uniforms(gl, this.cloudProgram);
    this.fieldVersion++;
  }

  /** Trace every line again if anything the trace depends on has changed. */
  private trace(box: Box, s: LookSettings) {
    const { gl } = this;
    const key = `${this.fieldVersion}|${box.min}|${box.max}|${s.lines}|${s.steps}|${s.lineLength}`;
    if (key === this.traceKey || this.traceProgram === undefined) return;
    this.traceKey = key;
    const width = Math.ceil(Math.sqrt(s.lines));
    const height = Math.ceil(s.lines / width);
    this.width = width;
    for (const t of this.state) gl.deleteTexture(t);
    if (this.history !== undefined) gl.deleteTexture(this.history);
    const make2D = () => {
      const t = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, width, height);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      return t;
    };
    this.state = [make2D(), make2D()];
    this.history = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.history);
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.RGBA32F, width, height, s.steps);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    const u = this.traceUniforms!;
    gl.useProgram(this.traceProgram);
    gl.bindVertexArray(this.vao);
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    gl.viewport(0, 0, width, height);
    gl.uniform3fv(u.u_boxMin, box.min);
    gl.uniform3fv(u.u_boxMax, box.max);
    gl.uniform1i(u.u_count, s.lines);
    gl.uniform1i(u.u_seed, 7);
    // The whole line spans lineLength of the box's diagonal, measured in
    // box half-widths, where the diagonal is 2√3.
    gl.uniform1f(
      u.u_step,
      (s.lineLength * 2 * Math.sqrt(3)) / Math.max(s.steps - 1, 1)
    );
    gl.uniform1i(u.u_state, 0);
    gl.activeTexture(gl.TEXTURE0);
    let read = 0;
    for (let k = 0; k < s.steps; k++) {
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
        this.history,
        0,
        k
      );
      gl.bindTexture(gl.TEXTURE_2D, this.state[read]);
      gl.uniform1i(u.u_init, k === 0 ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      read = write;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.enable(gl.BLEND);
  }

  private common(u: Uniforms, f: GlowFrame, opacity: number) {
    const { gl } = this;
    gl.uniformMatrix4fv(u.u_mathToView, false, f.mathToView);
    gl.uniformMatrix4fv(u.u_projection, false, f.projection);
    gl.uniform3fv(u.u_boxMin, f.box.min);
    gl.uniform3fv(u.u_boxMax, f.box.max);
    gl.uniform1f(u.u_speedScale, Math.max(1e-9, f.speedScale));
    gl.uniform1i(u.u_colorMode, f.colorMode);
    gl.uniform3fv(u.u_fixedColor, f.fixedColor);
    gl.uniform1f(u.u_opacity, opacity);
    gl.uniform2fv(u.u_depthRange, f.depthRange);
    gl.uniform1i(u.u_clip, f.clip ? 1 : 0);
    f.uploadCut(u);
    gl.uniform1f(u.u_fog, f.fog ? 1 : 0);
    gl.uniform1f(u.u_alpha, 1);
    f.uploadPalette(u);
  }

  /**
   * Prepare a look and return the call that draws it, so the caller can run
   * it under whatever depth state the occlusion setting asks for.
   */
  prepare(
    look: "streamlines" | "cloud",
    f: GlowFrame,
    s: LookSettings,
    restoreViewport: () => void
  ): { draw: (alpha: number) => void; count: number; vertices: number } {
    const { gl } = this;
    if (look === "streamlines") {
      if (!this.canTrace) return { draw: () => {}, count: 0, vertices: 0 };
      this.trace(f.box, s);
      restoreViewport();
      const u = this.lineUniforms;
      return {
        count: s.lines,
        vertices: s.lines * s.steps,
        draw: (alpha) => {
          gl.useProgram(this.lineProgram);
          this.common(u, f, s.lineOpacity);
          gl.uniform1f(u.u_alpha, alpha);
          gl.uniform1i(u.u_round, 0);
          gl.uniform1i(u.u_width, this.width);
          gl.uniform1i(u.u_steps, s.steps);
          gl.uniform1i(u.u_animate, s.animate ? 1 : 0);
          gl.uniform1f(u.u_time, s.time);
          gl.uniform1f(u.u_flowSpeed, s.flowSpeed);
          gl.uniform1f(u.u_window, s.flowWindow);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.history!);
          gl.uniform1i(u.u_history, 0);
          gl.drawArraysInstanced(gl.LINE_STRIP, 0, s.steps, s.lines);
        },
      };
    }
    const u = this.cloudUniforms;
    if (this.cloudProgram === undefined || u === undefined) {
      return { draw: () => {}, count: 0, vertices: 0 };
    }
    return {
      count: s.points,
      vertices: s.points,
      draw: (alpha) => {
        gl.useProgram(this.cloudProgram!);
        this.common(u, f, s.cloudOpacity);
        gl.uniform1f(u.u_alpha, alpha);
        gl.uniform1i(u.u_round, 1);
        gl.uniform1f(u.u_pointPx, s.pointPx * f.dpr);
        gl.uniform1f(u.u_contrast_, s.cloudContrast);
        gl.uniform1i(u.u_byDirection, s.cloudByDirection ? 1 : 0);
        gl.drawArrays(gl.POINTS, 0, s.points);
      },
    };
  }
}
