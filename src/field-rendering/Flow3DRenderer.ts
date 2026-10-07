/**
 * A field over Desmos 3D drawn as a flowing fluid: particles carried by the
 * field, each trailing the path it has just come along, the picture a fluid
 * or gas simulation draws.
 *
 * The method is fieldplay's (Andrei Kashcha, MIT; see `LICENSE-fieldplay.md`
 * and `FlowRenderer.ts`, its 2D port): particle state in float textures, an
 * RK4 step in a fragment shader each frame, particles that are dropped and
 * respawned somewhere random so the flow never drains into its sinks. What
 * changes in 3D is the trail. The 2D flow fades a screen-space texture, which
 * is right on still graph paper and smears the moment a 3D view rotates,
 * because last frame's pixels were last frame's projection. Here each
 * particle keeps its last few positions in world space, in a ring of texture
 * layers, and the trail is drawn from them every frame with the current
 * camera, so rotating the view never smears it.
 *
 * Unlike the 2D flow, the step follows real time rather than the frame: a
 * 144 Hz display advects no faster than a 60 Hz one (briefing §11.1, which
 * records the 2D flow's version of that defect).
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

export interface Flow3DOptions {
  /** Particles, or Auto from the box's size on screen. Up to 200,000. */
  particles: number | "auto";
  /** Box half-widths per second at the scale's speed, or along each path. */
  speed: number;
  /**
   * Every particle at the same speed, along the field's direction. Off, the
   * field's own strength sets the pace (capped near a pole), as a simulation
   * would show it; on, slow regions stay readable.
   */
  normalizeSpeed: boolean;
  /** Frames of trail behind each particle. */
  trail: number;
  /** Seconds a particle lives, on average, before it starts again elsewhere. */
  lifetime: number;
  opacity: number;
  /** How bright a soft dot each particle's head is, 0 for none. */
  glow: number;
  /**
   * Whether a particle that reaches a pole's core starts again elsewhere,
   * as a sink in a simulation absorbs what flows into it. Off, particles pile
   * up at sinks, which is also a true picture of the field.
   */
  absorb: boolean;
  pointPx: number;
  /** A dark laid over the graph, as a simulation is drawn on; "" for none. */
  backdrop: string;
  backdropOpacity: number;
  colorMode: "speed" | "fixed" | "direction";
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
   * A black hole at the origin bending the light of what is behind it: the
   * flow behind the hole is drawn where a lens of that mass shows it, the
   * hole's shadow is drawn black, and the horizon absorbs what reaches it.
   */
  lens: boolean;
  /** The horizon's radius, the Schwarzschild radius, in math units. */
  horizon: number;
  /**
   * With the lens: gas coming towards you brighter and hotter, going away
   * dimmer, at the orbital speed the hole's mass gives — Doppler beaming —
   * and everything dimmed close to the horizon by gravitational redshift.
   */
  beaming: boolean;
}

export const MAX_FLOW_PARTICLES_3D = 200_000;
export const MAX_FLOW_TRAIL_3D = 64;

export const DEFAULT_FLOW_3D_OPTIONS: Flow3DOptions = {
  particles: "auto",
  speed: 0.35,
  normalizeSpeed: false,
  trail: 48,
  lifetime: 4,
  opacity: 0.6,
  glow: 0.3,
  absorb: true,
  pointPx: 2,
  backdrop: "#05070d",
  backdropOpacity: 0.9,
  colorMode: "speed",
  palette: "spectral",
  fixedColor: "#8fd3f0",
  saturation: 1,
  contrast: 1,
  scale: "field",
  fog: true,
  clip: true,
  cut: { cutaway: "off", angle: Math.PI / 2, turn: undefined },
  occlusion: "hide",
  surfaceResolution: "auto",
  lens: false,
  horizon: 0.45,
  beaming: true,
};

/**
 * Auto's particle count, from the box's size on screen: about one particle
 * per 30 square pixels of it. Fewer and longer-trailed than a 2D flow's,
 * because a 3D flow is seen through its own depth: at one per 12 the box
 * filled with an even fuzz in which no structure showed, where a simulation
 * picture reads through fewer, longer lines.
 */
export function autoFlowParticles3D(boxPx: number) {
  return clamp(Math.round(boxPx ** 2 / 30), 4_000, 40_000);
}

export interface Flow3DFrame {
  particles: number;
  trail: number;
  speedScale: number;
  scaleSource: ScaleRule3D | "manual";
  cameraAzimuth: number;
  hidingSurfaces: number;
  /** Steps taken since starting, for the tests. */
  steps: number;
}

const SCALE_SAMPLING = {
  placement: "jitter" as const,
  count: 10,
  sliceAxis: 2 as const,
  slicePosition: 0.5,
  instances: 1000,
};

/** One step for every particle, writing its new state and its trail point. */
function stepFragment(field: Field3D) {
  return `#version 300 es
precision highp float;
precision highp int;
uniform highp sampler2D u_state;
uniform int u_init;
uniform int u_count;
uniform float u_frame;
uniform float u_dt;
uniform float u_speed;
uniform float u_speedScale;
uniform int u_normalize;
uniform float u_lifetime;
uniform int u_absorb;
uniform int u_lens;
uniform float u_horizon;
uniform uint u_seed;
layout(location = 0) out vec4 o_state;
layout(location = 1) out vec4 o_trail;
${field3dFunctions(field)}
${HASH_GLSL}
${CLIP_GLSL}

/**
 * Velocity in math units per second. Along the field's direction in box
 * half-widths, so a box with unequal axes still looks like the field; at the
 * field's own relative strength, capped at four times the scale's speed so a
 * pole does not fling its particles out of the box in one frame.
 */
vec3 vtVelocity(vec3 p) {
  vec3 half_ = 0.5 * (u_boxMax - u_boxMin);
  vec3 F = vtField(p);
  vec3 w = F / half_;
  float l = length(w);
  if (l < 1.0e-12) return vec3(0.0);
  float pace = u_normalize == 1 ? 1.0 : min(length(F) / u_speedScale, 4.0);
  return half_ * (w / l) * u_speed * pace;
}

/**
 * Where a particle is born: a point through the box kept with the chance the
 * seed gives there, tried up to 64 times. Rejection sampling, so the births
 * follow the seed's density exactly, whatever shape it has. A seed so thin no
 * try lands returns a point outside the box, which is no particle this step;
 * the next step tries again.
 */
vec3 vtBirth(uint key) {
  for (uint i = 0u; i < 64u; i++) {
    vec3 h = vtHash3(key + i * 2246822519u);
    vec3 p = mix(u_boxMin, u_boxMax, h);
    if (vtHash3(key ^ (i * 3266489917u + 374761393u)).x < vtSeed(p)) return p;
  }
  return u_boxMax + (u_boxMax - u_boxMin);
}

void main() {
  ivec2 q = ivec2(gl_FragCoord.xy);
  int width = textureSize(u_state, 0).x;
  int id = q.y * width + q.x;
  vec4 s = texelFetch(u_state, q, 0);
  vec3 r = vtHash3(uint(id) * 2654435761u ^ u_seed);
  // Each step a particle starts again with probability dt / lifetime, so
  // lifetimes are spread out — the flow never blinks as one generation ends
  // — and their mean is the lifetime in seconds at any frame rate. r is new
  // every step, because the seed is.
  bool respawn = u_init == 1 || r.x < u_dt / max(u_lifetime, 1.0e-3);
  if (!respawn) {
    vec3 p = s.xyz;
    float h = u_dt;
    vec3 k1 = vtVelocity(p);
    vec3 k2 = vtVelocity(p + 0.5 * h * k1);
    vec3 k3 = vtVelocity(p + 0.5 * h * k2);
    vec3 k4 = vtVelocity(p + h * k3);
    vec3 next = p + h * (k1 + 2.0 * k2 + 2.0 * k3 + k4) / 6.0;
    // Out of the box, or stopped where the field vanishes: start again. So
    // too in a pole's core, where the field is thirty times the scale: there
    // a sink would otherwise collect every particle in the box into one
    // white knot, where a simulation's outflow absorbs them.
    bool core = u_absorb == 1 && length(vtField(next)) > 30.0 * u_speedScale;
    // Nothing comes back out of a horizon.
    bool fell = u_lens == 1 && length(next) < u_horizon;
    if (vtOutsideBox(next) || length(k1) == 0.0 || core || fell) respawn = true;
    else s.xyz = next;
  }
  if (respawn) {
    vec3 born = vtBirth(uint(id) ^ (u_seed * 747796405u));
    // Not born this step: hidden, and tried again next step.
    s = vec4(born, vtOutsideBox(born) ? -1.0e9 : u_frame);
  }
  if (id >= u_count) s.w = -1.0e9;
  o_state = s;
  o_trail = vec4(s.xyz, length(vtField(s.xyz)));
}
`;
}

const FULLSCREEN_VERTEX = `#version 300 es
const vec2 P[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
void main() { gl_Position = vec4(P[gl_VertexID], 0.0, 1.0); }
`;

const DRAW_UNIFORMS = `
uniform mat4 u_mathToView;
uniform mat4 u_projection;
uniform highp sampler2D u_state;
uniform highp sampler2DArray u_trail;
uniform int u_width;
uniform int u_layers;
uniform int u_newest;
uniform float u_frame;
uniform float u_speedScale;
uniform int u_colorMode;
uniform vec3 u_fixedColor;
uniform float u_opacity;
uniform vec2 u_depthRange;
uniform int u_lens;
uniform int u_ortho;
uniform vec3 u_lensView;
uniform float u_horizonView;
uniform float u_horizon;
uniform float u_image;
uniform int u_side;
uniform int u_beaming;
`;

/**
 * The lens: where a point mass at the origin shows a point behind it.
 *
 * The thin-lens equation of a point mass, the textbook weak-field
 * approximation: a source β from the line of sight to the hole is seen at
 * θ = (β ± √(β² + 4θ_E²)) / 2, with θ_E² = 2 r_s d / (D_L D_S) for a source d
 * behind the hole. The + image is the main one, pushed outward; the − image is
 * the faint second one on the far side of the hole, flipped. Worked in the
 * lens plane (angles times D_L), which an orthographic camera reaches as D_L
 * grows without bound. A point in front of the hole is not lensed, and one
 * just behind barely is, so a trail crossing the hole's depth stays joined.
 * The images nearest the hole are where the approximation is weakest: the
 * real ones sit a little closer in.
 */
const LENS_GLSL = `
vec3 vtLens(vec3 P) {
  if (u_lens == 0) return P;
  float dL = -u_lensView.z;
  float dS = -P.z;
  // The second image's pass clamps points in front to just behind, where
  // their image is at the hole's centre, under its shadow.
  float d = u_image < 0.0 ? max(dS - dL, 1.0e-4) : dS - dL;
  if (d <= 0.0 || dL <= 0.0) return P;
  dS = dL + d;
  vec2 b;
  float E2;
  if (u_ortho == 1) {
    b = P.xy - u_lensView.xy;
    E2 = 2.0 * u_horizonView * d;
  } else {
    b = (P.xy / dS - u_lensView.xy / dL) * dL;
    E2 = 2.0 * u_horizonView * d * dL / dS;
  }
  float bl = max(length(b), 1.0e-6);
  float th = 0.5 * (bl + u_image * sqrt(bl * bl + 4.0 * E2));
  vec2 img = b / bl * th;
  if (u_ortho == 1) P.xy = u_lensView.xy + img;
  else P.xy = (u_lensView.xy / dL + img / dL) * dS;
  P.z = -dS;
  return P;
}
/**
 * 1 for a point on the side of the hole this pass draws, else 0. "Behind" is
 * behind the near face of the shadow's sphere, not the hole's depth plane: gas
 * plunging inside that sphere is under the shadow, and a plane would cut the
 * disk with a straight edge across it.
 */
float vtSide(vec3 view) {
  if (u_side == 0) return 1.0;
  float dL = -u_lensView.z;
  vec2 b = u_ortho == 1 ? view.xy - u_lensView.xy : view.xy * dL / max(-view.z, 1.0e-6) - u_lensView.xy;
  float R = 2.598 * u_horizonView;
  bool behind = -view.z > dL - sqrt(max(R * R - dot(b, b), 0.0));
  return (u_side == 1) == behind ? 1.0 : 0.0;
}
/**
 * Doppler beaming and gravitational redshift: the factor δ = √(1−β²)/(1−β·n)
 * for gas at the circular-orbit speed β = √(r_s / 2r) of the hole's mass,
 * moving along the flow, seen along n; times √(1 − r_s/r) for the climb out.
 * Brightness goes as that factor cubed.
 */
float vtShift(vec3 math, vec3 along, vec3 view) {
  if (u_lens == 0 || u_beaming == 0) return 1.0;
  float r = max(length(math), u_horizon * 1.0001);
  float beta = min(sqrt(u_horizon / (2.0 * r)), 0.7);
  vec3 dir = mat3(u_mathToView) * along;
  dir = length(dir) > 0.0 ? normalize(dir) : vec3(0.0);
  vec3 n = u_ortho == 1 ? vec3(0.0, 0.0, 1.0) : normalize(-view);
  float delta = sqrt(1.0 - beta * beta) / (1.0 - beta * dot(dir, n));
  return delta * sqrt(1.0 - u_horizon / r);
}
`;

const DRAW_COLOR = `
/** The colour, shifted hotter or cooler by g, the beaming's frequency ratio. */
vec3 vtFlowColor(float m, vec3 along, float g) {
  if (u_colorMode == 1) return vtAdjust(u_fixedColor);
  if (u_colorMode == 2) return abs(along);
  return vtPalette(clamp(1.0 - exp(-m / u_speedScale) + 0.3 * log2(g), 0.0, 1.0));
}
/** Colour and opacity, brightened by g³ without passing white. */
vec4 vtLit(vec3 c, float a, float g) {
  float gain = g * g * g;
  return vec4(min(c * a * gain, vec3(1.0)), min(a * gain, 1.0));
}
float vtFogFor(vec3 view) {
  return clamp((-view.z - u_depthRange.x) / max(u_depthRange.y - u_depthRange.x, 1.0e-6), 0.0, 1.0);
}
`;

/** Each particle's trail, newest point first, as one line strip. */
const TRAIL_VERTEX = `#version 300 es
precision highp float;
precision highp int;
${DRAW_UNIFORMS}
out vec4 v_color;
out vec3 v_view;
out vec3 v_math;
out float v_fog;
${PALETTE_GLSL}
${DRAW_COLOR}
${LENS_GLSL}
vec4 vtTrailAt(ivec2 q, int back) {
  int layer = (u_newest - back + u_layers * 4) % u_layers;
  return texelFetch(u_trail, ivec3(q, layer), 0);
}
void main() {
  ivec2 q = ivec2(gl_InstanceID % u_width, gl_InstanceID / u_width);
  vec4 s = texelFetch(u_state, q, 0);
  int age = int(u_frame - s.w);
  int back = gl_VertexID;
  // Points from before this particle's current life are not its trail:
  // collapse them onto its oldest real point, invisibly, so the strip has no
  // segment jumping from where it died to where it was reborn.
  bool real = back <= age && s.w > -1.0e8;
  vec4 t = vtTrailAt(q, real ? back : max(min(age, u_layers - 1), 0));
  vec4 ahead = vtTrailAt(q, max(back - 1, 0));
  vec3 view = (u_mathToView * vec4(t.xyz, 1.0)).xyz;
  v_view = view;
  v_math = t.xyz;
  v_fog = vtFogFor(view);
  gl_Position = u_projection * vec4(vtLens(view), 1.0);
  // Bright at the head, fading to nothing at the tail, as a streak behind a
  // moving particle does.
  float f = 1.0 - float(back) / float(max(u_layers - 1, 1));
  float a = real ? u_opacity * f * f * vtSide(view) : 0.0;
  vec3 along = ahead.xyz - t.xyz;
  along = length(along) > 0.0 ? normalize(along) : vec3(0.0, 0.0, 1.0);
  float g = vtShift(t.xyz, along, view);
  v_color = vtLit(vtFlowColor(t.w, along, g), a, g);
}
`;

/** Each particle's head, as a soft dot. */
const HEAD_VERTEX = `#version 300 es
precision highp float;
precision highp int;
${DRAW_UNIFORMS}
uniform float u_pointPx;
out vec4 v_color;
out vec3 v_view;
out vec3 v_math;
out float v_fog;
${PALETTE_GLSL}
${DRAW_COLOR}
${LENS_GLSL}
void main() {
  ivec2 q = ivec2(gl_VertexID % u_width, gl_VertexID / u_width);
  vec4 s = texelFetch(u_state, q, 0);
  vec4 t = texelFetch(u_trail, ivec3(q, u_newest), 0);
  vec4 before = texelFetch(u_trail, ivec3(q, (u_newest + u_layers - 1) % u_layers), 0);
  vec3 view = (u_mathToView * vec4(t.xyz, 1.0)).xyz;
  v_view = view;
  v_math = t.xyz;
  v_fog = vtFogFor(view);
  bool shown = s.w > -1.0e8 && vtSide(view) > 0.0;
  gl_Position = shown ? u_projection * vec4(vtLens(view), 1.0) : vec4(2.0, 2.0, 2.0, 1.0);
  gl_PointSize = u_pointPx;
  vec3 along = t.xyz - before.xyz;
  along = length(along) > 0.0 ? normalize(along) : vec3(0.0, 0.0, 1.0);
  float g = vtShift(t.xyz, along, view);
  v_color = vtLit(vtFlowColor(t.w, along, g), u_opacity, g);
}
`;

const FLOW_FRAGMENT = `#version 300 es
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
    // A soft core and a falloff: thousands of these overlapping are what
    // makes a dense flow read as light rather than as dots.
    float r = length(gl_PointCoord - 0.5) * 2.0;
    if (r > 1.0) discard;
    a = exp(-4.0 * r * r);
  }
  a *= u_alpha * mix(1.0, 0.2, v_fog * u_fog);
  outColor = v_color * a;
}
`;

/**
 * The hole's shadow and its photon ring, over the flow behind it.
 *
 * The shadow is the disc no light from behind gets through: radius
 * (3√3 / 2) r_s, the photon sphere's capture radius seen from far away. The
 * ring at its edge is the light that went round the hole on the way.
 */
const SHADOW_FRAGMENT = `#version 300 es
precision highp float;
uniform vec2 u_centerPx;
uniform float u_radiusPx;
uniform int u_mode;
uniform vec3 u_ringColor;
uniform float u_ring;
out vec4 outColor;
void main() {
  float r = length(gl_FragCoord.xy - u_centerPx) / max(u_radiusPx, 1.0e-3);
  if (u_mode == 0) {
    float a = 1.0 - smoothstep(0.96, 1.0, r);
    outColor = vec4(0.0, 0.0, 0.0, a);
  } else {
    float w = 1.5 / max(u_radiusPx, 1.0);
    float g = u_ring * exp(-pow((r - 1.0 - w) / w, 2.0));
    outColor = vec4(u_ringColor * g, g);
  }
}
`;

export class Flow3DRenderer implements Overlay3DRenderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly vao: WebGLVertexArrayObject;
  private readonly framebuffer: WebGLFramebuffer;
  private readonly trailProgram: WebGLProgram;
  private readonly trailUniforms: Uniforms;
  private readonly headProgram: WebGLProgram;
  private readonly headUniforms: Uniforms;
  private readonly shadowProgram: WebGLProgram;
  private readonly shadowUniforms: Uniforms;
  private stepProgram?: WebGLProgram;
  private stepUniforms: Uniforms = {};
  private readonly surfaceDepth: SurfaceDepth;
  private readonly scale: FieldScale3D;
  private state: WebGLTexture[] = [];
  private trail?: WebGLTexture;
  /** Texels a side of the state texture; particles ≤ side². */
  private side = 0;
  private layers = 0;
  private read = 0;
  private frame = 0;
  private newest = 0;
  private needsInit = true;
  private lastStep?: number;
  private field?: Field3D;
  private options: Flow3DOptions = DEFAULT_FLOW_3D_OPTIONS;
  private parameters: ReadonlyMap<string, number> = new Map();
  private time = 0;
  private pixelRatio = 1;
  last?: Flow3DFrame;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", {
      antialias: true,
      premultipliedAlpha: true,
      alpha: true,
      depth: true,
    });
    if (gl === null) {
      throw new FlowRendererError(
        "This browser cannot draw the 3D flow: it has no WebGL2."
      );
    }
    if (gl.getExtension("EXT_color_buffer_float") === null) {
      throw new FlowRendererError(
        "The 3D flow needs float render targets, which this browser does not offer. The arrows still work."
      );
    }
    this.gl = gl;
    this.vao = gl.createVertexArray();
    this.framebuffer = gl.createFramebuffer();
    this.trailProgram = linkProgram3D(gl, TRAIL_VERTEX, FLOW_FRAGMENT);
    this.trailUniforms = uniformsOf(gl, this.trailProgram);
    this.headProgram = linkProgram3D(gl, HEAD_VERTEX, FLOW_FRAGMENT);
    this.headUniforms = uniformsOf(gl, this.headProgram);
    this.shadowProgram = linkProgram3D(gl, FULLSCREEN_VERTEX, SHADOW_FRAGMENT);
    this.shadowUniforms = uniformsOf(gl, this.shadowProgram);
    this.surfaceDepth = new SurfaceDepth(gl);
    this.scale = new FieldScale3D(gl, this.vao);
  }

  get isContextLost() {
    return this.gl.isContextLost();
  }

  /** A flow is always moving. */
  readonly animating = true;

  setField(field: Field3D) {
    if (sameField3D(this.field, field) && this.stepProgram !== undefined)
      return;
    const { gl } = this;
    const step = linkProgram3D(gl, FULLSCREEN_VERTEX, stepFragment(field));
    if (this.stepProgram !== undefined) gl.deleteProgram(this.stepProgram);
    this.stepProgram = step;
    this.stepUniforms = uniformsOf(gl, step);
    this.field = field;
    this.scale.setField(field);
    // A new field is a new flow: every particle starts again.
    this.needsInit = true;
  }

  setSurfaces(surfaces: readonly Surface3D[]) {
    this.surfaceDepth.setSurfaces(surfaces);
  }

  setOptions(options: Flow3DOptions) {
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

  /**
   * State and trail storage big enough for this many particles and this long
   * a trail. The state side grows in powers of two, so dragging the count
   * slider does not reallocate on every move; a different trail length is a
   * different ring, so it starts the trails again.
   */
  private allocate(particles: number, trail: number) {
    const { gl } = this;
    const side =
      2 ** Math.ceil(Math.log2(Math.max(16, Math.ceil(Math.sqrt(particles)))));
    if (side === this.side && trail === this.layers && this.trail !== undefined)
      return;
    for (const t of this.state) gl.deleteTexture(t);
    if (this.trail !== undefined) gl.deleteTexture(this.trail);
    const make2D = () => {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, side, side);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      return t;
    };
    this.state = [make2D(), make2D()];
    // Half floats for the trail: positions to about one part in two
    // thousand of the box, which no screen resolves, at half the memory —
    // which is what lets 200,000 particles keep a trail on an integrated GPU.
    this.trail = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.trail);
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.RGBA16F, side, side, trail);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    this.side = side;
    this.layers = trail;
    this.needsInit = true;
  }

  /** Advances every particle by the real time since the last step. */
  private step(box: Box3D, particles: number, speedScale: number) {
    const { gl, field } = this;
    if (this.stepProgram === undefined || field === undefined) return;
    const now = performance.now();
    const elapsed =
      this.lastStep === undefined ? 0 : (now - this.lastStep) / 1000;
    // Desmos redraws and the animation loop can both land in one frame; a
    // second step a few milliseconds later would only crowd the trail.
    if (!this.needsInit && elapsed < 0.004) return;
    this.lastStep = now;
    // Capped, so a backgrounded tab resumes as a flow, not a teleport.
    const dt = Math.min(elapsed, 0.05);
    const o = this.options;
    this.frame++;
    this.newest = this.frame % this.layers;
    const write = 1 - this.read;
    const u = this.stepUniforms;
    gl.useProgram(this.stepProgram);
    gl.bindVertexArray(this.vao);
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
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
      this.trail!,
      0,
      this.newest
    );
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    gl.viewport(0, 0, this.side, this.side);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.state[this.read]);
    gl.uniform1i(u.u_state, 0);
    uploadField3DParameters(gl, u, field, this.parameters, this.time);
    gl.uniform3fv(u.u_boxMin, box.min);
    gl.uniform3fv(u.u_boxMax, box.max);
    gl.uniform1i(u.u_init, this.needsInit ? 1 : 0);
    gl.uniform1i(u.u_count, particles);
    gl.uniform1f(u.u_frame, this.frame);
    gl.uniform1f(u.u_dt, dt);
    gl.uniform1f(u.u_speed, o.speed);
    gl.uniform1f(u.u_speedScale, Math.max(1e-9, speedScale));
    gl.uniform1i(u.u_normalize, o.normalizeSpeed ? 1 : 0);
    gl.uniform1f(u.u_lifetime, o.lifetime);
    gl.uniform1i(u.u_absorb, o.absorb ? 1 : 0);
    gl.uniform1i(u.u_lens, o.lens ? 1 : 0);
    gl.uniform1f(u.u_horizon, o.horizon);
    gl.uniform1ui(u.u_seed, (this.frame * 2246822519) >>> 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.drawBuffers([gl.BACK]);
    this.read = write;
    this.needsInit = false;
  }

  draw(camera: Camera3D, box: Box3D) {
    const { gl, options: o, field } = this;
    if (field === undefined) return;
    const boxPx = boxScreenSize(camera, box);
    const particles = Math.min(
      MAX_FLOW_PARTICLES_3D,
      o.particles === "auto"
        ? autoFlowParticles3D(boxPx)
        : Math.max(1, Math.round(o.particles))
    );
    const trail = Math.round(clamp(o.trail, 2, MAX_FLOW_TRAIL_3D));
    this.allocate(particles, trail);
    const { speedScale, scaleSource } = this.scale.resolve(
      o.scale,
      box,
      SCALE_SAMPLING,
      this.parameters,
      this.time
    );
    this.step(box, particles, speedScale);

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    // The backdrop, as a simulation is drawn on: a dark laid over the graph,
    // not opaque, so the box and the axes still show through it faintly.
    const [br, bg, bb] = hexToUnitRGB(
      o.backdrop === "" ? "#000000" : o.backdrop
    );
    const ba = o.backdrop === "" ? 0 : clamp(o.backdropOpacity, 0, 1);
    gl.clearColor(br * ba, bg * ba, bb * ba, ba);
    gl.clearDepth(1);
    gl.depthMask(true);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.bindVertexArray(this.vao);

    const mathToView = multiplyMat4(camera.view, camera.world);
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
    gl.enable(gl.BLEND);
    // On a dark backdrop, light builds up where trails cross, which is the
    // glow of a dense flow — by screen blending, which brightens towards
    // white without passing it, rather than adding, which clipped every
    // crowded region to a flat white blob. On the white graph paper light
    // would vanish, so there it is ordinary see-through paint.
    if (ba > 0) {
      gl.blendFuncSeparate(
        gl.ONE,
        gl.ONE_MINUS_SRC_COLOR,
        gl.ONE,
        gl.ONE_MINUS_SRC_ALPHA
      );
    } else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);

    const cut = cutUniforms(mathToView, box, o.cut);
    const palette = paletteUniforms(o.palette);
    const hole = lensFrame(camera, mathToView, o);
    const common = (u: Uniforms) => {
      gl.uniformMatrix4fv(u.u_mathToView, false, mathToView);
      gl.uniformMatrix4fv(u.u_projection, false, camera.projection);
      gl.uniform3fv(u.u_boxMin, box.min);
      gl.uniform3fv(u.u_boxMax, box.max);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.state[this.read]);
      gl.uniform1i(u.u_state, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.trail ?? null);
      gl.uniform1i(u.u_trail, 1);
      gl.activeTexture(gl.TEXTURE0);
      gl.uniform1i(u.u_width, this.side);
      gl.uniform1i(u.u_layers, this.layers);
      gl.uniform1i(u.u_newest, this.newest);
      gl.uniform1f(u.u_frame, this.frame);
      gl.uniform1f(u.u_speedScale, Math.max(1e-9, speedScale));
      gl.uniform1i(
        u.u_colorMode,
        o.colorMode === "fixed" ? 1 : o.colorMode === "direction" ? 2 : 0
      );
      gl.uniform3fv(u.u_fixedColor, hexToUnitRGB(o.fixedColor));
      gl.uniform2fv(u.u_depthRange, depthRange(mathToView, box));
      gl.uniform1i(u.u_clip, o.clip ? 1 : 0);
      gl.uniform1f(u.u_fog, o.fog ? 1 : 0);
      uploadCut(gl, u, cut);
      gl.uniform1fv(u.u_paletteAt, palette.positions);
      gl.uniform3fv(u.u_paletteRGB, palette.colors);
      gl.uniform1i(u.u_paletteCount, palette.count);
      gl.uniform1i(u.u_paletteIsHue, o.palette === "direction-hue" ? 1 : 0);
      gl.uniform1f(u.u_saturation, o.saturation);
      gl.uniform1f(u.u_contrast, o.contrast);
      gl.uniform1i(u.u_lens, hole === undefined ? 0 : 1);
      gl.uniform1i(u.u_ortho, camera.orthographic ? 1 : 0);
      gl.uniform3fv(u.u_lensView, hole?.view ?? [0, 0, 0]);
      gl.uniform1f(u.u_horizonView, hole?.horizonView ?? 0);
      gl.uniform1f(u.u_horizon, o.horizon);
      gl.uniform1i(u.u_beaming, o.beaming ? 1 : 0);
    };
    const passes = (draw: (alpha: number) => void) => {
      if (occluding && o.occlusion === "fade") {
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.GREATER);
        draw(0.25);
      }
      if (occluding) {
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
      } else {
        gl.disable(gl.DEPTH_TEST);
      }
      draw(1);
    };

    const trails = (side: number, image: number) => {
      gl.useProgram(this.trailProgram);
      const tu = this.trailUniforms;
      common(tu);
      gl.uniform1i(tu.u_side, side);
      gl.uniform1f(tu.u_image, image);
      gl.uniform1f(tu.u_opacity, o.opacity);
      gl.uniform1i(tu.u_round, 0);
      passes((alpha) => {
        gl.uniform1f(tu.u_alpha, alpha);
        gl.drawArraysInstanced(gl.LINE_STRIP, 0, this.layers, particles);
      });
      if (o.glow <= 0) return;
      gl.useProgram(this.headProgram);
      const hu = this.headUniforms;
      common(hu);
      gl.uniform1i(hu.u_side, side);
      gl.uniform1f(hu.u_image, image);
      gl.uniform1f(hu.u_opacity, o.opacity * o.glow);
      gl.uniform1i(hu.u_round, 1);
      gl.uniform1f(
        hu.u_pointPx,
        o.pointPx * (1 + 2 * o.glow) * this.pixelRatio
      );
      passes((alpha) => {
        gl.uniform1f(hu.u_alpha, alpha);
        gl.drawArrays(gl.POINTS, 0, particles);
      });
    };
    if (hole === undefined) trails(0, 1);
    else {
      // Behind the hole, both images of it; then the shadow over them; then
      // what is in front, over the shadow.
      trails(1, 1);
      trails(1, -1);
      this.drawShadow(hole, palette, ba > 0);
      trails(2, 1);
    }
    gl.depthMask(true);
    gl.bindVertexArray(null);
    this.last = {
      particles,
      trail: this.layers,
      speedScale,
      scaleSource,
      cameraAzimuth: cut.facing,
      hidingSurfaces: occluding ? this.surfaceDepth.count : 0,
      steps: this.frame,
    };
  }

  /** The hole's shadow, then its photon ring in the palette's hottest colour. */
  private drawShadow(
    hole: LensFrame,
    palette: ReturnType<typeof paletteUniforms>,
    dark: boolean
  ) {
    const { gl } = this;
    const u = this.shadowUniforms;
    gl.useProgram(this.shadowProgram);
    gl.disable(gl.DEPTH_TEST);
    gl.uniform2fv(u.u_centerPx, [
      hole.centerPx[0] * this.canvas.width,
      hole.centerPx[1] * this.canvas.height,
    ]);
    gl.uniform1f(u.u_radiusPx, hole.shadowPx * this.canvas.height);
    // Black over what is drawn, and opaque, so the graph does not show
    // through the hole.
    gl.blendFuncSeparate(
      gl.ZERO,
      gl.ONE_MINUS_SRC_ALPHA,
      gl.ONE,
      gl.ONE_MINUS_SRC_ALPHA
    );
    gl.uniform1i(u.u_mode, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    const n = palette.count;
    const hottest = palette.colors.slice((n - 1) * 3, n * 3);
    gl.uniform3fv(u.u_ringColor, hottest);
    gl.uniform1f(u.u_ring, 0.8);
    gl.uniform1i(u.u_mode, 1);
    if (dark) {
      gl.blendFuncSeparate(
        gl.ONE,
        gl.ONE_MINUS_SRC_COLOR,
        gl.ONE,
        gl.ONE_MINUS_SRC_ALPHA
      );
    } else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  destroy() {
    const { gl } = this;
    for (const t of this.state) gl.deleteTexture(t);
    if (this.trail !== undefined) gl.deleteTexture(this.trail);
    if (this.stepProgram !== undefined) gl.deleteProgram(this.stepProgram);
    gl.deleteProgram(this.trailProgram);
    gl.deleteProgram(this.headProgram);
    gl.deleteProgram(this.shadowProgram);
    gl.deleteFramebuffer(this.framebuffer);
    this.surfaceDepth.dispose();
    this.scale.dispose();
    gl.deleteVertexArray(this.vao);
  }
}

interface LensFrame {
  /** The hole's centre in view coordinates. */
  view: number[];
  /** The horizon radius in view units. */
  horizonView: number;
  /** The hole's centre on the canvas, 0..1 from the bottom left. */
  centerPx: [number, number];
  /** The shadow's radius as a fraction of the canvas height. */
  shadowPx: number;
}

/**
 * Where the hole is for this frame, or nothing without a lens or with the
 * hole behind the camera.
 *
 * The world matrix scales math units to view units, unequally if the box's
 * axes differ; the horizon is scaled by the geometric mean, the scale of a
 * volume, so a sphere stays the size of a sphere on average.
 */
function lensFrame(
  camera: Camera3D,
  mathToView: readonly number[],
  o: Flow3DOptions
): LensFrame | undefined {
  if (!o.lens || !(o.horizon > 0)) return undefined;
  const m = mathToView;
  const det =
    m[0] * (m[5] * m[10] - m[9] * m[6]) -
    m[4] * (m[1] * m[10] - m[9] * m[2]) +
    m[8] * (m[1] * m[6] - m[5] * m[2]);
  const unit = Math.cbrt(Math.abs(det));
  const view = [m[12], m[13], m[14]];
  const distance = -view[2];
  if (!(distance > 0) || !(unit > 0)) return undefined;
  const horizonView = o.horizon * unit;
  const p = camera.projection;
  const clip = [
    p[0] * view[0] + p[4] * view[1] + p[8] * view[2] + p[12],
    p[1] * view[0] + p[5] * view[1] + p[9] * view[2] + p[13],
    p[3] * view[0] + p[7] * view[1] + p[11] * view[2] + p[15],
  ];
  const shadow = ((3 * Math.sqrt(3)) / 2) * horizonView;
  // Half the canvas height per unit of NDC; p[5] maps view height to NDC.
  const shadowNdc = camera.orthographic
    ? shadow * p[5]
    : (shadow * p[5]) / distance;
  return {
    view,
    horizonView,
    centerPx: [(clip[0] / clip[2] + 1) / 2, (clip[1] / clip[2] + 1) / 2],
    shadowPx: shadowNdc / 2,
  };
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}
