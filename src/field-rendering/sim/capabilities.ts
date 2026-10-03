/**
 * What this browser's GPU can do for a fluid simulation, found by trying it.
 *
 * Extension names are not enough. `EXT_color_buffer_float` can be advertised
 * on hardware that renders float targets at reduced precision, and nothing in
 * WebGL says whether the shader compiler fuses `a·b + c` into one rounding.
 * That fusion changes how closely the GPU can match the CPU oracle (GPT's
 * third reply, §C2). So every capability that matters is exercised: a float
 * target is rendered, read back and compared bit for bit, and the shader's own
 * arithmetic is asked whether it fused.
 *
 * Nothing here reads `WEBGL_debug_renderer_info`. The GPU's name would
 * fingerprint the user and adds nothing a measurement does not.
 */

export interface SimCapabilities {
  webgl2: boolean;
  /** RGBA32F renders, reads back exactly, and keeps NaN and infinity bits. */
  floatTargets: boolean;
  /** `OES_texture_float_linear`: float textures can be sampled smoothly. */
  floatLinear: boolean;
  /** `EXT_float_blend`: float targets can be blended. */
  floatBlend: boolean;
  maxDrawBuffers: number;
  maxTextureSize: number;
  /** Bits of mantissa in a highp fragment float; 23 is IEEE single. */
  fragmentPrecisionBits: number;
  /**
   * Whether `a·b + c` came out with one rounding instead of two. Undefined
   * when the probe could not run.
   */
  fusedMultiplyAdd: boolean | undefined;
  /** Enough to run the lattice: everything above that the solver needs. */
  ready: boolean;
  /** What is missing, in words for the panel; empty when ready. */
  problems: string[];
}

/**
 * The D2Q9 lattice keeps nine populations per cell, in three RGBA32F targets
 * written in one pass.
 */
export const REQUIRED_DRAW_BUFFERS = 3;

const PROBE_VERTEX = `#version 300 es
void main() {
  vec2 corner = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}`;

/**
 * One pixel, four answers. The uniforms keep the compiler from folding the
 * arithmetic away at compile time.
 *
 * With a = b = 1 + 2⁻¹² and c = −(1 + 2⁻¹¹), the exact a·b + c is 2⁻²⁴. Rounding
 * a·b first gives exactly 1 + 2⁻¹¹ (the 2⁻²⁴ is half an ulp and ties to even),
 * and the sum is then 0. A fused multiply-add keeps the 2⁻²⁴.
 */
const PROBE_FRAGMENT = `#version 300 es
precision highp float;
uniform float u_a;
uniform float u_b;
uniform float u_c;
uniform float u_third;
out vec4 outColor;
void main() {
  outColor = vec4(
    u_a * u_b + u_c,
    uintBitsToFloat(0x7fc00001u),
    uintBitsToFloat(0x7f800000u),
    u_third
  );
}`;

export function probeSimCapabilities(
  gl: WebGL2RenderingContext
): SimCapabilities {
  const problems: string[] = [];
  const colorBufferFloat = gl.getExtension("EXT_color_buffer_float") !== null;
  const floatLinear = gl.getExtension("OES_texture_float_linear") !== null;
  const floatBlend = gl.getExtension("EXT_float_blend") !== null;
  const maxDrawBuffers = gl.getParameter(gl.MAX_DRAW_BUFFERS) as number;
  const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
  const precision = gl.getShaderPrecisionFormat(
    gl.FRAGMENT_SHADER,
    gl.HIGH_FLOAT
  );
  const fragmentPrecisionBits = precision?.precision ?? 0;

  let floatTargets = false;
  let fusedMultiplyAdd: boolean | undefined;
  if (colorBufferFloat) {
    const result = renderProbe(gl);
    if (result === undefined) {
      problems.push("A float32 render target could not be drawn and read.");
    } else {
      fusedMultiplyAdd = result.fused;
      floatTargets = result.exact;
      if (!result.exact) {
        problems.push(
          "Float32 render targets do not keep exact values, so the simulation could not be checked against its reference."
        );
      }
    }
  } else {
    problems.push(
      "This GPU cannot render to float32 textures (EXT_color_buffer_float)."
    );
  }
  if (maxDrawBuffers < REQUIRED_DRAW_BUFFERS) {
    problems.push(
      `The lattice writes ${REQUIRED_DRAW_BUFFERS} targets at once, and this GPU allows ${maxDrawBuffers}.`
    );
  }
  if (fragmentPrecisionBits < 23) {
    problems.push(
      `Fragment shaders here have ${fragmentPrecisionBits}-bit floats; the simulation needs full 32-bit precision.`
    );
  }

  return {
    webgl2: true,
    floatTargets,
    floatLinear,
    floatBlend,
    maxDrawBuffers,
    maxTextureSize,
    fragmentPrecisionBits,
    fusedMultiplyAdd,
    ready: problems.length === 0,
    problems,
  };
}

/**
 * Probes on a context of its own and then gives it back.
 *
 * Capabilities belong to the GPU and driver, not to a context, so a throwaway
 * one answers for all of them. Losing it straight away matters, because a page
 * may hold only a few contexts and Vector Tools already uses two of them.
 */
export function probeWithScratchContext(
  createCanvas: () => HTMLCanvasElement | OffscreenCanvas = () =>
    document.createElement("canvas")
): SimCapabilities {
  const canvas = createCanvas();
  const gl = canvas.getContext("webgl2");
  if (gl === null) {
    return {
      webgl2: false,
      floatTargets: false,
      floatLinear: false,
      floatBlend: false,
      maxDrawBuffers: 0,
      maxTextureSize: 0,
      fragmentPrecisionBits: 0,
      fusedMultiplyAdd: undefined,
      ready: false,
      problems: ["This browser has no WebGL2."],
    };
  }
  try {
    return probeSimCapabilities(gl);
  } finally {
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}

/** Renders the probe pixel and reads it back, or undefined if it cannot. */
function renderProbe(
  gl: WebGL2RenderingContext
): { fused: boolean; exact: boolean } | undefined {
  const created: {
    shaders: WebGLShader[];
    program?: WebGLProgram;
    texture?: WebGLTexture;
    framebuffer?: WebGLFramebuffer;
  } = { shaders: [] };
  try {
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (shader === null) return undefined;
      created.shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return gl.getShaderParameter(shader, gl.COMPILE_STATUS)
        ? shader
        : undefined;
    };
    const vertex = compile(gl.VERTEX_SHADER, PROBE_VERTEX);
    const fragment = compile(gl.FRAGMENT_SHADER, PROBE_FRAGMENT);
    const program = gl.createProgram();
    if (vertex === undefined || fragment === undefined || program === null)
      return undefined;
    created.program = program;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return undefined;

    const texture = gl.createTexture();
    const framebuffer = gl.createFramebuffer();
    if (texture === null || framebuffer === null) return undefined;
    created.texture = texture;
    created.framebuffer = framebuffer;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, 1, 1);
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0
    );
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      return undefined;
    }
    gl.viewport(0, 0, 1, 1);
    gl.disable(gl.BLEND);
    gl.useProgram(program);
    const third = Math.fround(1 / 3);
    gl.uniform1f(gl.getUniformLocation(program, "u_a"), 1 + 2 ** -12);
    gl.uniform1f(gl.getUniformLocation(program, "u_b"), 1 + 2 ** -12);
    gl.uniform1f(gl.getUniformLocation(program, "u_c"), -(1 + 2 ** -11));
    gl.uniform1f(gl.getUniformLocation(program, "u_third"), third);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    const pixel = new Float32Array(4);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, pixel);
    const bits = new Uint32Array(pixel.buffer);
    return {
      fused: pixel[0] !== 0,
      exact:
        (bits[1] & 0x7fffffff) > 0x7f800000 &&
        bits[2] === 0x7f800000 &&
        pixel[3] === third,
    };
  } finally {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (created.framebuffer) gl.deleteFramebuffer(created.framebuffer);
    if (created.texture) gl.deleteTexture(created.texture);
    if (created.program) gl.deleteProgram(created.program);
    for (const shader of created.shaders) gl.deleteShader(shader);
  }
}
