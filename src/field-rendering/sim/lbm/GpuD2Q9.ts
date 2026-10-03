/**
 * The D2Q9 lattice on the GPU: one fragment pass per step, which pulls each
 * cell's nine populations from its neighbours and collides them.
 *
 * It is the CPU reference in `d2q9.ts` transcribed into GLSL, in the same
 * operation order, and the integration test holds the two to each other. The
 * shifted populations live in three RGBA32F textures, written at once
 * through three draw buffers:
 *
 *   texture 0: g0 g1 g2 g3
 *   texture 1: g4 g5 g6 g7
 *   texture 2: g8 δρ ux uy
 *
 * The last three channels are the macroscopic fields at collision time. The
 * solver does not need them, but anything that draws the flow does, and they
 * come free with the collision.
 *
 * Two sets of textures ping-pong, so a step reads one set and writes the
 * other, and nothing is read and written in the same pass. The lattice is
 * fully periodic for now; walls and open boundaries are the next gate.
 */

import { Q, shiftedEquilibrium } from "./d2q9";

export interface GpuLatticeOptions {
  nx: number;
  ny: number;
  tau: number;
  force?: readonly [number, number];
}

const VERTEX = `#version 300 es
void main() {
  vec2 corner = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}`;

/**
 * Pull streaming: population i arrives at x from x − c_i. The collision is
 * `collideCell` line for line; keep the two in step.
 */
const STEP = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
uniform sampler2D u_g0;
uniform sampler2D u_g1;
uniform sampler2D u_g2;
uniform ivec2 u_size;
uniform float u_omega;
uniform vec2 u_force;
layout(location = 0) out vec4 o0;
layout(location = 1) out vec4 o1;
layout(location = 2) out vec4 o2;

ivec2 wrap(ivec2 p) { return (p + u_size) % u_size; }

void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  float g0 = texelFetch(u_g0, c, 0).x;
  float g1 = texelFetch(u_g0, wrap(c + ivec2(-1, 0)), 0).y;
  float g2 = texelFetch(u_g0, wrap(c + ivec2(0, -1)), 0).z;
  float g3 = texelFetch(u_g0, wrap(c + ivec2(1, 0)), 0).w;
  float g4 = texelFetch(u_g1, wrap(c + ivec2(0, 1)), 0).x;
  float g5 = texelFetch(u_g1, wrap(c + ivec2(-1, -1)), 0).y;
  float g6 = texelFetch(u_g1, wrap(c + ivec2(1, -1)), 0).z;
  float g7 = texelFetch(u_g1, wrap(c + ivec2(1, 1)), 0).w;
  float g8 = texelFetch(u_g2, wrap(c + ivec2(-1, 1)), 0).x;

  float fx = u_force.x;
  float fy = u_force.y;
  float omega = u_omega;
  float dr = (((((((g0 + g1) + g2) + g3) + g4) + g5) + g6) + g7) + g8;
  float rho = 1.0 + dr;
  float jx = ((((g1 - g3) + g5) - g6) - g7) + g8;
  float jy = ((((g2 - g4) + g5) + g6) - g7) - g8;
  float ux = (jx + 0.5 * fx) / rho;
  float uy = (jy + 0.5 * fy) / rho;
  float usq = 1.5 * (ux * ux + uy * uy);
  float keep = 1.0 - omega;
  float source = 1.0 - 0.5 * omega;

  #define COLLIDE(G, W, CX, CY) { \\
    float cu = CX * ux + CY * uy; \\
    float eq = W * (dr + rho * ((3.0 * cu + (4.5 * cu) * cu) - usq)); \\
    float cf = CX * fx + CY * fy; \\
    float s = W * (3.0 * ((CX - ux) * fx + (CY - uy) * fy) + (9.0 * cu) * cf); \\
    G = (keep * G + omega * eq) + source * s; }

  COLLIDE(g0, 0.44444444444444444, 0.0, 0.0)
  COLLIDE(g1, 0.11111111111111111, 1.0, 0.0)
  COLLIDE(g2, 0.11111111111111111, 0.0, 1.0)
  COLLIDE(g3, 0.11111111111111111, -1.0, 0.0)
  COLLIDE(g4, 0.11111111111111111, 0.0, -1.0)
  COLLIDE(g5, 0.02777777777777778, 1.0, 1.0)
  COLLIDE(g6, 0.02777777777777778, -1.0, 1.0)
  COLLIDE(g7, 0.02777777777777778, -1.0, -1.0)
  COLLIDE(g8, 0.02777777777777778, 1.0, -1.0)

  o0 = vec4(g0, g1, g2, g3);
  o1 = vec4(g4, g5, g6, g7);
  o2 = vec4(g8, dr, ux, uy);
}`;

interface TextureSet {
  textures: WebGLTexture[];
  framebuffer: WebGLFramebuffer;
}

export class GpuD2Q9 {
  readonly nx: number;
  readonly ny: number;
  tau: number;
  force: readonly [number, number];
  steps = 0;
  private readonly program: WebGLProgram;
  private readonly sets: [TextureSet, TextureSet];
  /** Which set holds the current populations. */
  private current = 0;
  private readonly uniforms: {
    g: (WebGLUniformLocation | null)[];
    size: WebGLUniformLocation | null;
    omega: WebGLUniformLocation | null;
    force: WebGLUniformLocation | null;
  };

  constructor(
    private readonly gl: WebGL2RenderingContext,
    options: GpuLatticeOptions
  ) {
    if (gl.getExtension("EXT_color_buffer_float") === null) {
      throw new Error("This GPU cannot render to float32 textures.");
    }
    this.nx = options.nx;
    this.ny = options.ny;
    this.tau = options.tau;
    this.force = options.force ?? [0, 0];
    this.program = link(gl, VERTEX, STEP);
    this.uniforms = {
      g: [0, 1, 2].map((i) => gl.getUniformLocation(this.program, `u_g${i}`)),
      size: gl.getUniformLocation(this.program, "u_size"),
      omega: gl.getUniformLocation(this.program, "u_omega"),
      force: gl.getUniformLocation(this.program, "u_force"),
    };
    this.sets = [this.createSet(), this.createSet()];
  }

  private createSet(): TextureSet {
    const { gl } = this;
    const textures = [0, 1, 2].map(() => {
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, this.nx, this.ny);
      // Exact texel reads only: a filtered read would average neighbours.
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      return texture;
    });
    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    textures.forEach((texture, i) =>
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0 + i,
        gl.TEXTURE_2D,
        texture,
        0
      )
    );
    gl.drawBuffers([
      gl.COLOR_ATTACHMENT0,
      gl.COLOR_ATTACHMENT1,
      gl.COLOR_ATTACHMENT2,
    ]);
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error(`The lattice framebuffer is incomplete (${status}).`);
    }
    return { textures, framebuffer };
  }

  /** Sets every cell to equilibrium at the density and velocity given. */
  initialize(
    at: (x: number, y: number) => { deltaRho?: number; ux: number; uy: number }
  ) {
    const cells = this.nx * this.ny;
    const populations = new Float32Array(Q * cells);
    const eq = new Array<number>(Q);
    for (let y = 0; y < this.ny; y++) {
      for (let x = 0; x < this.nx; x++) {
        const { deltaRho = 0, ux, uy } = at(x, y);
        shiftedEquilibrium(deltaRho, ux, uy, eq);
        const k = y * this.nx + x;
        for (let i = 0; i < Q; i++) populations[i * cells + k] = eq[i];
      }
    }
    this.setPopulations(populations);
  }

  /** Uploads shifted populations, structure of arrays `i·N + k`. */
  setPopulations(populations: Float32Array) {
    const { gl, nx, ny } = this;
    const cells = nx * ny;
    const set = this.sets[this.current];
    for (let t = 0; t < 3; t++) {
      const texel = new Float32Array(4 * cells);
      for (let k = 0; k < cells; k++) {
        for (let c = 0; c < 4; c++) {
          const i = t * 4 + c;
          texel[k * 4 + c] = i < Q ? populations[i * cells + k] : 0;
        }
      }
      gl.bindTexture(gl.TEXTURE_2D, set.textures[t]);
      gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,
        0,
        0,
        nx,
        ny,
        gl.RGBA,
        gl.FLOAT,
        texel
      );
    }
    this.steps = 0;
  }

  step(count = 1) {
    const { gl } = this;
    gl.useProgram(this.program);
    gl.viewport(0, 0, this.nx, this.ny);
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.SCISSOR_TEST);
    gl.uniform2i(this.uniforms.size, this.nx, this.ny);
    gl.uniform1f(this.uniforms.omega, 1 / this.tau);
    gl.uniform2f(this.uniforms.force, this.force[0], this.force[1]);
    for (let n = 0; n < count; n++) {
      const from = this.sets[this.current];
      const to = this.sets[1 - this.current];
      for (let t = 0; t < 3; t++) {
        gl.activeTexture(gl.TEXTURE0 + t);
        gl.bindTexture(gl.TEXTURE_2D, from.textures[t]);
        gl.uniform1i(this.uniforms.g[t], t);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, to.framebuffer);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      this.current = 1 - this.current;
      this.steps++;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /** The three textures holding the current state, for anything drawing it. */
  get textures(): readonly WebGLTexture[] {
    return this.sets[this.current].textures;
  }

  /**
   * Reads everything back: the shifted populations as `i·N + k`, and δρ, ux
   * and uy at the last collision. Slow, because it waits for the GPU; for
   * tests and measurements, not for drawing.
   */
  read(): {
    populations: Float32Array;
    deltaRho: Float32Array;
    ux: Float32Array;
    uy: Float32Array;
  } {
    const { gl, nx, ny } = this;
    const cells = nx * ny;
    const set = this.sets[this.current];
    const populations = new Float32Array(Q * cells);
    const deltaRho = new Float32Array(cells);
    const ux = new Float32Array(cells);
    const uy = new Float32Array(cells);
    const texel = new Float32Array(4 * cells);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, set.framebuffer);
    for (let t = 0; t < 3; t++) {
      gl.readBuffer(gl.COLOR_ATTACHMENT0 + t);
      gl.readPixels(0, 0, nx, ny, gl.RGBA, gl.FLOAT, texel);
      for (let k = 0; k < cells; k++) {
        for (let c = 0; c < 4; c++) {
          const i = t * 4 + c;
          if (i < Q) populations[i * cells + k] = texel[k * 4 + c];
        }
        if (t === 2) {
          deltaRho[k] = texel[k * 4 + 1];
          ux[k] = texel[k * 4 + 2];
          uy[k] = texel[k * 4 + 3];
        }
      }
    }
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    return { populations, deltaRho, ux, uy };
  }

  dispose() {
    const { gl } = this;
    for (const set of this.sets) {
      for (const texture of set.textures) gl.deleteTexture(texture);
      gl.deleteFramebuffer(set.framebuffer);
    }
    gl.deleteProgram(this.program);
  }
}

function link(
  gl: WebGL2RenderingContext,
  vertexSource: string,
  fragmentSource: string
): WebGLProgram {
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Lattice shader failed to compile: ${log}`);
    }
    return shader;
  };
  const vertex = compile(gl.VERTEX_SHADER, vertexSource);
  const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(
      `Lattice shader failed to link: ${gl.getProgramInfoLog(program)}`
    );
  }
  return program;
}

/** A lattice on a context of its own, as the verification tests use. */
export function createStandaloneLattice(options: GpuLatticeOptions): {
  lattice: GpuD2Q9;
  release: () => void;
} {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const gl = canvas.getContext("webgl2", { antialias: false });
  if (gl === null) throw new Error("This browser has no WebGL2.");
  const lattice = new GpuD2Q9(gl, options);
  return {
    lattice,
    release: () => {
      lattice.dispose();
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
