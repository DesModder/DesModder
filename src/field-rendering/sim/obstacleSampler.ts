/**
 * {@link ObstacleSamples} on the GPU: a moving solid's signed function and its
 * gradient at every cell centre, from the GLSL its compiler already emits.
 *
 * Sampling on the CPU is one evaluation of the inequality per cell, every
 * time a slider moves it. Measured on the live tab (300 × 182 cells, two
 * parabolas reading one slider), that was 12 ms of every frame of a drag,
 * and the page fell to 30 frames a second. On the GPU it is one draw per
 * row; the samples come back through a pixel-pack buffer a frame later, the
 * way the forces do (`GpuD2Q9.beginRead`), and `partialSolidsFromSamples`
 * builds the cells from them as it does from the CPU's.
 *
 * The GLSL is held to the CPU evaluator, and both to live Desmos, by the
 * strict-semantics tests; `obstacleSampler.int.test.ts` holds these samples
 * to `sampleObstacle`.
 */

import { glslParamName } from "../latexToGLSL";
import { STRICT_GLSL_PRELUDE } from "./strictGLSL";
import { link, VERTEX } from "./lbm/GpuD2Q9";
import {
  gradientStep,
  type MovingSolidsGrid,
  type ObstacleSamples,
} from "./movingSolids";
import type { CompiledObstacle } from "./obstacles";

/** A sample the GPU has been asked for and may not have taken yet. */
export interface PendingSample {
  readonly width: number;
  readonly height: number;
  readonly buffer: WebGLBuffer;
  readonly sync: WebGLSync;
}

interface Program {
  program: WebGLProgram;
  uniforms: Map<string, WebGLUniformLocation | null>;
}

export class ObstacleSampler {
  private readonly programs = new Map<string, Program>();
  private target:
    | {
        texture: WebGLTexture;
        framebuffer: WebGLFramebuffer;
        width: number;
        height: number;
      }
    | undefined;
  private readonly emptyArray: WebGLVertexArrayObject;

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.emptyArray = gl.createVertexArray()!;
  }

  /**
   * Draws one row's samples at these slider values and time, and starts
   * copying them out without waiting for the GPU.
   */
  begin(
    obstacle: CompiledObstacle,
    grid: MovingSolidsGrid,
    scope: { time: number; params: ReadonlyMap<string, number> }
  ): PendingSample {
    const { gl } = this;
    const { nx, ny, tank } = grid;
    const { program, uniforms } = this.programFor(obstacle);
    const target = this.targetFor(nx, ny);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
    gl.viewport(0, 0, nx, ny);
    gl.disable(gl.BLEND);
    gl.useProgram(program);
    gl.bindVertexArray(this.emptyArray);
    gl.uniform2f(uniforms.get("u_min")!, tank.xMin, tank.yMin);
    gl.uniform2f(
      uniforms.get("u_cell")!,
      (tank.xMax - tank.xMin) / nx,
      (tank.yMax - tank.yMin) / ny
    );
    gl.uniform1f(uniforms.get("u_h")!, gradientStep(grid));
    gl.uniform1f(uniforms.get("u_time")!, scope.time);
    for (const name of obstacle.params) {
      // NaN marks an undefined slider, as the CPU's scope does.
      gl.uniform1f(
        uniforms.get(glslParamName(name))!,
        scope.params.get(name) ?? NaN
      );
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buffer);
    gl.bufferData(gl.PIXEL_PACK_BUFFER, 16 * nx * ny, gl.STREAM_READ);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, target.framebuffer);
    gl.readBuffer(gl.COLOR_ATTACHMENT0);
    gl.readPixels(0, 0, nx, ny, gl.RGBA, gl.FLOAT, 0);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)!;
    gl.flush();
    return { width: nx, height: ny, buffer, sync };
  }

  /** The samples if the GPU has taken them, or undefined if not yet. */
  finish(pending: PendingSample): ObstacleSamples | undefined {
    const { gl } = this;
    if (gl.clientWaitSync(pending.sync, 0, 0) === gl.TIMEOUT_EXPIRED)
      return undefined;
    const cells = pending.width * pending.height;
    const texel = new Float32Array(4 * cells);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pending.buffer);
    gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, texel);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    this.cancel(pending);
    // F, ∂F/∂x, ∂F/∂y and flags: 1 where F is defined, plus 2 where all four
    // of the gradient's points are.
    const signed = new Float32Array(cells);
    const gradient = new Float32Array(2 * cells);
    for (let k = 0; k < cells; k++) {
      const flags = texel[4 * k + 3];
      const defined = flags === 1 || flags === 3;
      signed[k] = defined ? texel[4 * k] : NaN;
      const sloped = flags >= 2;
      gradient[2 * k] = sloped ? texel[4 * k + 1] : NaN;
      gradient[2 * k + 1] = sloped ? texel[4 * k + 2] : NaN;
    }
    return { signed, gradient };
  }

  cancel(pending: PendingSample) {
    this.gl.deleteSync(pending.sync);
    this.gl.deleteBuffer(pending.buffer);
  }

  dispose() {
    const { gl } = this;
    for (const { program } of this.programs.values()) gl.deleteProgram(program);
    this.programs.clear();
    if (this.target) {
      gl.deleteTexture(this.target.texture);
      gl.deleteFramebuffer(this.target.framebuffer);
      this.target = undefined;
    }
    gl.deleteVertexArray(this.emptyArray);
  }

  private programFor(obstacle: CompiledObstacle): Program {
    const { glsl } = obstacle;
    const key = [...glsl.helpers, glsl.signedFunction].join("\n");
    const cached = this.programs.get(key);
    if (cached) return cached;
    const [, name] = /float (vsSigned_\w+)\(/.exec(glsl.signedFunction)!;
    const params = obstacle.params.map(glslParamName);
    const source = `#version 300 es
precision highp float;
precision highp int;
uniform float u_time;
${params.map((uniform) => `uniform float ${uniform};`).join("\n")}
uniform vec2 u_min;
uniform vec2 u_cell;
uniform float u_h;
out vec4 outColor;
${STRICT_GLSL_PRELUDE}
${glsl.helpers.join("\n")}
${glsl.signedFunction}
void main() {
  // gl_FragCoord is the cell's centre, half a cell in.
  vec2 p = u_min + gl_FragCoord.xy * u_cell;
  bool ok;
  float f = ${name}(p, ok);
  bool a;
  bool b;
  bool c;
  bool d;
  float right = ${name}(p + vec2(u_h, 0.0), a);
  float left = ${name}(p - vec2(u_h, 0.0), b);
  float up = ${name}(p + vec2(0.0, u_h), c);
  float down = ${name}(p - vec2(0.0, u_h), d);
  bool sloped = a && b && c && d;
  outColor = vec4(
    ok ? f : 0.0,
    sloped ? (right - left) / (2.0 * u_h) : 0.0,
    sloped ? (up - down) / (2.0 * u_h) : 0.0,
    (ok ? 1.0 : 0.0) + (sloped ? 2.0 : 0.0)
  );
}`;
    const program = link(this.gl, VERTEX, source);
    const uniforms = new Map<string, WebGLUniformLocation | null>();
    for (const uniform of ["u_min", "u_cell", "u_h", "u_time", ...params])
      uniforms.set(uniform, this.gl.getUniformLocation(program, uniform));
    const entry = { program, uniforms };
    this.programs.set(key, entry);
    return entry;
  }

  private targetFor(width: number, height: number) {
    const { gl } = this;
    if (this.target?.width === width && this.target.height === height)
      return this.target;
    if (this.target) {
      gl.deleteTexture(this.target.texture);
      gl.deleteFramebuffer(this.target.framebuffer);
    }
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, width, height);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.bindTexture(gl.TEXTURE_2D, null);
    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0
    );
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.target = { texture, framebuffer, width, height };
    return this.target;
  }
}
