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
  /**
   * Where a flow's particles are born, as GLSL over `vec2 p`: a chance from
   * 0 to 1 at each point. Absent, they are born evenly. Read only by the
   * flow; every other renderer ignores the `vtSeed` it is given.
   */
  seed?: string;
  /**
   * Perturbations layered on top of the compiled components.
   *
   * Absent by default, and absent means the shader is emitted exactly as it
   * was before this existed — which matters because {@link FlowField} is
   * compared by value to decide whether to relink, and a key that is always
   * present would change every field's identity.
   */
  disturbances?: FieldDisturbances;
}

/**
 * The parts of a field that cannot be written as an expression, because they
 * are events rather than functions.
 *
 * A ripple has a birthplace and a birth time; a pointer has wherever the cursor
 * happens to be. Neither can be derived from `x`, `y` and the clock, so neither
 * can live in the LaTeX — they arrive as state the renderer uploads each frame.
 * What lives here is only how many of them the shader must make room for, since
 * that is the part a program has to be rebuilt for.
 */
export interface FieldDisturbances {
  /**
   * How many ripples may be alive at once, or 0 for none.
   *
   * A count rather than the ripples themselves: the slots are a fixed-size
   * uniform array, and the ripples in them change many times a second.
   */
  ripples?: number;
  /** Whether the field responds to a pointer position. */
  pointer?: boolean;
}

/** Where one ripple started, when, and how hard. */
export interface Ripple {
  x: number;
  y: number;
  /** Seconds on the same clock as {@link DisturbanceState.time}. */
  birth: number;
  /** Signed. Positive pushes outward on the crest, negative pulls inward. */
  strength: number;
}

/**
 * Everything the disturbances need this frame.
 *
 * Handed over whole rather than set piecemeal, for the same reason parameters
 * are: these change every frame and none of them is worth a program rebuild.
 */
export interface DisturbanceState {
  /**
   * Ripple slots, packed as x, y, birth, strength.
   *
   * A `Float32Array` rather than an array of objects because it is uploaded
   * verbatim with `uniform4fv`, and rebuilding it per frame from objects is the
   * one allocation a steady loop cannot afford. A slot with zero strength is
   * ignored by the shader.
   */
  ripples?: Float32Array;
  /** Metres per second the crest travels outward, in graph units. */
  rippleSpeed: number;
  /** Distance between crests, in graph units. */
  rippleWavelength: number;
  /** Seconds a ripple takes to fade to nothing. */
  rippleLifetime: number;
  /** Pointer position in graph coordinates. */
  pointerX: number;
  pointerY: number;
  /** Outward push at the pointer. Negative pulls particles in. */
  pointerRadial: number;
  /** Rotation around the pointer. */
  pointerSwirl: number;
  /** How far the pointer's influence reaches, in graph units. */
  pointerRadius: number;
}

export const NO_DISTURBANCES: DisturbanceState = {
  rippleSpeed: 0,
  rippleWavelength: 1,
  rippleLifetime: 1,
  pointerX: 0,
  pointerY: 0,
  pointerRadial: 0,
  pointerSwirl: 0,
  pointerRadius: 1,
};

/** Floats per ripple slot in {@link DisturbanceState.ripples}. */
export const RIPPLE_STRIDE = 4;

/**
 * The field to advect by, as compiled GLSL.
 *
 * A gradient field arrives as its scalar function rather than as two
 * components, because the GPU cannot differentiate symbolically the way the
 * generated Desmos expressions do — it has to sample instead.
 */
export type FlowField =
  | ({ kind: "components"; p: string; q: string } & FieldDependencies)
  | ({ kind: "gradient"; f: string } & FieldDependencies)
  /**
   * A velocity measured rather than written: a simulation's, published as a
   * grid of samples under `source` (see {@link publishVelocitySample}). The
   * renderers read it from a texture, bilinearly, and it is zero outside the
   * grid's bounds.
   */
  | ({ kind: "sampled"; source: string } & FieldDependencies);

/**
 * One published velocity grid: `width × height` samples, x and y
 * interleaved, row 0 at the bottom, in graph units per second, covering
 * `bounds` cell for cell.
 */
export interface VelocitySample {
  width: number;
  height: number;
  data: Float32Array;
  bounds: FlowBounds;
}

/**
 * The latest sample from each source, with a version so that each renderer's
 * context uploads it once, not once per frame.
 *
 * A module-level bus because a sample has to reach two renderers in two WebGL
 * contexts, and a texture cannot cross contexts: each keeps its own copy, and
 * both draw from the same numbers.
 */
const samples = new Map<string, VelocitySample & { version: number }>();
let sampleVersion = 0;

export function publishVelocitySample(source: string, sample: VelocitySample) {
  samples.set(source, { ...sample, version: ++sampleVersion });
}

export function withdrawVelocitySample(source: string) {
  samples.delete(source);
}

/** Each context's copy of each source's latest sample. */
const sampleTextures = new WeakMap<
  WebGL2RenderingContext,
  Map<
    string,
    { texture: WebGLTexture; version: number; width: number; height: number }
  >
>();

/** The texture unit sampled fields use, clear of both renderers' own. */
const SAMPLE_UNIT = 7;

function uploadSample(
  gl: WebGL2RenderingContext,
  uniforms: Record<string, WebGLUniformLocation | null>,
  source: string
) {
  const sample = samples.get(source);
  const bounds = uniforms.u_sampledBounds;
  if (bounds !== null && bounds !== undefined) {
    const b = sample?.bounds ?? { xMin: 0, xMax: 0, yMin: 0, yMax: 0 };
    gl.uniform4f(bounds, b.xMin, b.xMax, b.yMin, b.yMax);
  }
  const sampler = uniforms.u_sampled;
  if (sampler === null || sampler === undefined || sample === undefined) return;
  let perContext = sampleTextures.get(gl);
  if (perContext === undefined) {
    perContext = new Map();
    sampleTextures.set(gl, perContext);
  }
  let entry = perContext.get(source);
  if (
    entry === undefined ||
    entry.width !== sample.width ||
    entry.height !== sample.height
  ) {
    if (entry) gl.deleteTexture(entry.texture);
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    // Half floats, because they filter in WebGL2 without an extension, and a
    // velocity in graph units per second needs nothing like float32's range.
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RG16F, sample.width, sample.height);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    entry = {
      texture,
      version: -1,
      width: sample.width,
      height: sample.height,
    };
    perContext.set(source, entry);
  }
  gl.activeTexture(gl.TEXTURE0 + SAMPLE_UNIT);
  gl.bindTexture(gl.TEXTURE_2D, entry.texture);
  if (entry.version !== sample.version) {
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      0,
      0,
      sample.width,
      sample.height,
      gl.RG,
      gl.FLOAT,
      sample.data
    );
    entry.version = sample.version;
  }
  gl.uniform1i(sampler, SAMPLE_UNIT);
  gl.activeTexture(gl.TEXTURE0);
}

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
  if (field?.kind === "sampled") uploadSample(gl, uniforms, field.source);
  // The clock is a uniform like any other name the field reads. It differs only
  // in where the number comes from.
  if (field !== undefined && fieldReadsTime(field)) upload("u_time", time);
}

/**
 * Whether anything in this field needs `u_time` declared and uploaded.
 *
 * A ripple is dated — its age is the whole of what it looks like — so asking
 * for ripples asks for the clock whether or not the expression mentions it.
 * Both the shader that declares the uniform and the frame that uploads it ask
 * here, because the two disagreeing means a shader reading an uninitialised
 * float, which is a field of ripples that are all infinitely old.
 */
export function fieldReadsTime(field: FlowField) {
  return field.usesTime === true || (field.disturbances?.ripples ?? 0) > 0;
}

/**
 * Uploads this frame's ripples and pointer.
 *
 * Separate from {@link uploadFieldParameters} because the two answer to
 * different owners — parameters come from the expression list, disturbances
 * from whatever is driving the field — and a renderer that has one need not
 * have the other.
 *
 * Silently does nothing for a field that declared no disturbances, so a caller
 * does not have to ask before calling.
 */
export function uploadFieldDisturbances(
  gl: WebGL2RenderingContext,
  uniforms: Record<string, WebGLUniformLocation | null>,
  field: FlowField | undefined,
  state: DisturbanceState
) {
  const disturbances = field?.disturbances;
  if (disturbances === undefined) return;
  const slots = disturbances.ripples ?? 0;
  if (slots > 0) {
    const location = uniforms.u_ripples;
    if (location !== null && location !== undefined) {
      // Sized here rather than trusted from the caller: a short array would
      // leave the tail of the uniform holding the previous frame's ripples,
      // which is a ring that never dies.
      const packed = state.ripples;
      gl.uniform4fv(
        location,
        packed !== undefined && packed.length === slots * RIPPLE_STRIDE
          ? packed
          : new Float32Array(slots * RIPPLE_STRIDE)
      );
    }
    const shape = uniforms.u_rippleShape;
    if (shape !== null && shape !== undefined)
      gl.uniform3f(
        shape,
        finite(state.rippleSpeed, 0),
        finite(state.rippleWavelength, 1),
        finite(state.rippleLifetime, 1)
      );
  }
  if (disturbances.pointer === true) {
    const pointer = uniforms.u_pointer;
    if (pointer !== null && pointer !== undefined)
      gl.uniform4f(
        pointer,
        finite(state.pointerX, 0),
        finite(state.pointerY, 0),
        finite(state.pointerRadial, 0),
        finite(state.pointerSwirl, 0)
      );
    const radius = uniforms.u_pointerRadius;
    if (radius !== null && radius !== undefined)
      gl.uniform1f(radius, finite(state.pointerRadius, 1));
  }
}

function finite(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback;
}

/**
 * The ripple and pointer terms, as GLSL, or "" when the field asked for
 * neither.
 *
 * Emitting nothing in that case is what keeps every field that predates this
 * compiling to exactly the source it did before, and so keeps `setField`'s
 * program cache from missing on a field that has not changed.
 */
function disturbanceFunctions(field: FlowField) {
  const { disturbances } = field;
  if (disturbances === undefined) return "";
  const slots = disturbances.ripples ?? 0;
  const parts: string[] = [];
  if (slots > 0)
    parts.push(`
uniform vec4 u_ripples[${slots}];
uniform vec3 u_rippleShape;

vec2 vtRipples(vec2 p) {
  vec2 sum = vec2(0.0);
  float speed = u_rippleShape.x;
  float wavelength = max(u_rippleShape.y, 1e-3);
  float lifetime = max(u_rippleShape.z, 1e-3);
  // The crest is a band rather than a line, or a particle would have to land
  // exactly on it to feel anything.
  float width = wavelength * 0.75;
  for (int i = 0; i < ${slots}; i++) {
    vec4 ripple = u_ripples[i];
    if (ripple.w == 0.0) continue;
    float age = u_time - ripple.z;
    if (age < 0.0 || age > lifetime) continue;
    vec2 offset = p - ripple.xy;
    float r = length(offset);
    if (r < 1e-4) continue;
    // Zero on the crest, positive outside it, negative inside.
    float front = r - speed * age;
    float envelope = exp(-(front * front) / (width * width));
    // A crest spreads around a circle that keeps growing, so its energy per
    // unit of front falls with the radius the way a real surface wave's does.
    // Without that, a ripple reaching the edge of the view is as strong as it
    // was at its origin and the field reads as a hard shockwave.
    float decay = (1.0 - age / lifetime) / sqrt(max(r, 1.0));
    sum += (offset / r) * ripple.w *
           sin(6.2831853 * front / wavelength) * envelope * decay;
  }
  return sum;
}`);
  if (disturbances.pointer === true)
    parts.push(`
uniform vec4 u_pointer;
uniform float u_pointerRadius;

vec2 vtPointer(vec2 p) {
  if (u_pointer.z == 0.0 && u_pointer.w == 0.0) return vec2(0.0);
  vec2 offset = p - u_pointer.xy;
  float r = length(offset);
  if (r < 1e-4) return vec2(0.0);
  // Gaussian rather than an inverse power, so the cursor has a definite reach
  // instead of a tail that faintly drags the entire field toward it.
  float radius = max(u_pointerRadius, 1e-4);
  float falloff = exp(-(r * r) / (radius * radius));
  vec2 radial = offset / r;
  return (radial * u_pointer.z +
          vec2(-radial.y, radial.x) * u_pointer.w) * falloff;
}`);
  return parts.join("\n");
}

/** The expression added to the base field, or "" when there are no terms. */
function disturbanceSum(field: FlowField) {
  const { disturbances } = field;
  if (disturbances === undefined) return "";
  const terms: string[] = [];
  if ((disturbances.ripples ?? 0) > 0) terms.push("vtRipples(p)");
  if (disturbances.pointer === true) terms.push("vtPointer(p)");
  return terms.length === 0 ? "" : ` + ${terms.join(" + ")}`;
}

/**
 * Both shaders that evaluate the field include this, and both declare `u_min`
 * and `u_max` before it — which is what lets the gradient step size follow the
 * viewport without an extra uniform.
 */
export function fieldFunctions(field: FlowField) {
  const body =
    field.kind === "sampled"
      ? `
uniform sampler2D u_sampled;
uniform vec4 u_sampledBounds;
vec2 vtField(vec2 p) {
  // The published grid's cells span its bounds exactly, so its uv is the
  // point's fraction of the way across; outside it there is no flow.
  vec2 uv = (p - u_sampledBounds.xz) / (u_sampledBounds.yw - u_sampledBounds.xz);
  vec2 s = any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))
    ? vec2(0.0)
    : texture(u_sampled, uv).xy;
  float u = s.x;
  float v = s.y;`
      : field.kind === "gradient"
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
    ...(fieldReadsTime(field) ? ["uniform float u_time;"] : []),
  ].join("\n");
  // Dependencies first: the compiler registers a definition only after its own
  // body compiled, so this order is already the one GLSL needs.
  const helpers = (field.helpers ?? []).map((helper) => helper.glsl).join("\n");
  return `
${GLSL_PRELUDE}
${uniforms}
${helpers}
${disturbanceFunctions(field)}
${body}
  if (isnan(u) || isinf(u)) u = 0.0;
  if (isnan(v) || isinf(v)) v = 0.0;
  // Disturbances are added after the guard rather than before it, so a pole in
  // the expression cannot take the ripples down with it.
  return vec2(u, v)${disturbanceSum(field)};
}
float vtSeed(vec2 p) {
  float s = ${field.seed ?? "1.0"};
  return isnan(s) || isinf(s) ? 0.0 : clamp(s, 0.0, 1.0);
}
`;
}
