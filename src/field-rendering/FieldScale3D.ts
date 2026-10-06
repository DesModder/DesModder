/**
 * The colour scale of a field over Desmos 3D, shared by every look.
 *
 * Two rules, chosen by the user, or a number given outright:
 *
 * - `field`: the median |F| over the samples drawn, ÷ ln 2, so the median
 *   lands mid-ramp. A median survives a pole by construction: a pole moves a
 *   handful of samples, and the median does not care how large those few are.
 *   The GPU evaluates the same field code at the same samples into a small
 *   float texture, read back, so there is no second evaluator to disagree with
 *   what is drawn. Measured only when what it depends on changes, never on a
 *   rotation, and the box rule where floats cannot be read back.
 * - `box`: the 2D overlay's rule, a third of the box's mean width — which on a
 *   point charge left 97% of the arrows in the first tenth of the ramp,
 *   because an inverse-square field is small almost everywhere in a box.
 */
import {
  field3dFunctions,
  uploadField3DParameters,
  type Field3D,
} from "./field3d";
import {
  CLIP_GLSL,
  HASH_GLSL,
  PLACEMENT_INDEX,
  SAMPLE_GLSL,
  type Placement3D,
} from "./glsl3d";
import type { Box3D } from "./Overlay3D";
import { linkProgram3D, uniformsOf, type Uniforms } from "./program3d";

export type ScaleRule3D = "field" | "box";

/** Where the field is sampled for the median: the same places it is drawn. */
export interface ScaleSampling {
  placement: Placement3D;
  count: number;
  sliceAxis: 0 | 1 | 2;
  slicePosition: number;
  instances: number;
}

/** The 2D overlay's colour scale, a third of the width, in 3D. */
export function boxScale3D(box: Box3D) {
  const w = [0, 1, 2].map((i) => box.max[i] - box.min[i]);
  return (w[0] + w[1] + w[2]) / 9;
}

/** At most this many samples are read back to find the median. */
const SCALE_SAMPLES = 4096;
const SCALE_WIDTH = 64;

/**
 * |F| at the samples the field is drawn at, one texel each, for the median the
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

export class FieldScale3D {
  private magnitudeProgram?: WebGLProgram;
  private magnitudeUniforms: Uniforms = {};
  private magnitudeTarget?: {
    framebuffer: WebGLFramebuffer;
    texture: WebGLTexture;
  };
  private readonly canReadBack: boolean;
  private field?: Field3D;
  /** The median |F| and what it was measured for. */
  private median?: { key: string; value: number };

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly vao: WebGLVertexArrayObject
  ) {
    this.canReadBack = gl.getExtension("EXT_color_buffer_float") !== null;
  }

  setField(field: Field3D) {
    const { gl } = this;
    if (this.magnitudeProgram !== undefined)
      gl.deleteProgram(this.magnitudeProgram);
    this.magnitudeProgram = this.canReadBack
      ? linkProgram3D(gl, magnitudeVertexSource(field), MAGNITUDE_FRAGMENT)
      : undefined;
    this.magnitudeUniforms =
      this.magnitudeProgram !== undefined
        ? uniformsOf(gl, this.magnitudeProgram)
        : {};
    this.field = field;
    this.median = undefined;
  }

  /**
   * The scale for this frame. Leaves the framebuffer unbound and blending on;
   * the caller restores its own viewport.
   */
  resolve(
    scale: number | ScaleRule3D,
    box: Box3D,
    sampling: ScaleSampling,
    parameters: ReadonlyMap<string, number>,
    time: number
  ): { speedScale: number; scaleSource: ScaleRule3D | "manual" } {
    if (typeof scale === "number")
      return { speedScale: scale, scaleSource: "manual" };
    if (scale === "field") {
      const median = this.measureMedian(box, sampling, parameters, time);
      if (median !== undefined && median > 0) {
        return { speedScale: median / Math.LN2, scaleSource: "field" };
      }
    }
    return { speedScale: boxScale3D(box), scaleSource: "box" };
  }

  private measureMedian(
    box: Box3D,
    sampling: ScaleSampling,
    parameters: ReadonlyMap<string, number>,
    time: number
  ) {
    const { gl, magnitudeProgram, field } = this;
    if (magnitudeProgram === undefined || field === undefined) return undefined;
    const o = sampling;
    const { count, instances } = sampling;
    const params = [...parameters].map(([k, v]) => `${k}=${v}`).join();
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
      field.usesTime ? Math.floor(time * 2) : 0,
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
    uploadField3DParameters(gl, u, field, parameters, time);
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

  dispose() {
    const { gl } = this;
    if (this.magnitudeProgram !== undefined)
      gl.deleteProgram(this.magnitudeProgram);
    if (this.magnitudeTarget !== undefined) {
      gl.deleteFramebuffer(this.magnitudeTarget.framebuffer);
      gl.deleteTexture(this.magnitudeTarget.texture);
    }
    this.magnitudeProgram = undefined;
    this.magnitudeTarget = undefined;
  }
}
