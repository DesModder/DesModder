/**
 * The D2Q9 lattice Boltzmann method on the CPU: the reference the GPU solver
 * is held to.
 *
 * Conventions are GPT's oracle's (`VECTOR_TOOLS_FLUID_RESEARCH_FOLLOWUP*.md`),
 * so its measurements carry over:
 * - **Directions.** 0 is rest; then E, N, W, S; then NE, NW, SW, SE.
 * - **Coordinates.** y points up, and the cell index is `y·nx + x`.
 * - **Units.** c_s² = 1/3 and ν = (τ − ½)/3.
 * - **Streaming.** Populations are stored after collision, and each step
 *   pulls from `x − c_i` and then collides.
 *
 * **Shifted populations.** What is stored is `g_i = f_i − w_i`: each
 * population minus its share of the rest density, with ρ₀ = 1. In float32 the
 * background `w_i` would swallow the small signal a slow flow is made of.
 * GPT's third round measured this: after 100,000 steps of a weak Taylor–Green
 * vortex, unshifted float32 arithmetic lost 96% of the amplitude, and shifted
 * float32 tracked float64 to 0.17%. The density increment δρ = Σ g_i is
 * carried explicitly and never recovered as ρ − 1.
 *
 * **Forcing.** Guo forcing, with the half-force velocity convention:
 * `u = (Σ c_i f_i + F/2)/ρ`. That convention is what makes a uniform force grow
 * momentum by exactly F per step.
 *
 * `collideCell` is written in the same operation order as the GLSL in
 * `GpuD2Q9.ts`. In float32 mode it rounds after every operation with
 * `Math.fround`, so the CPU can stand in for a GPU that does not reorder or
 * fuse (see `capabilities.ts` for the probe that says whether it does).
 */

export const Q = 9;
export const CX = [0, 1, 0, -1, 0, 1, -1, -1, 1] as const;
export const CY = [0, 0, 1, 0, -1, 1, 1, -1, -1] as const;
export const W = [
  4 / 9,
  1 / 9,
  1 / 9,
  1 / 9,
  1 / 9,
  1 / 36,
  1 / 36,
  1 / 36,
  1 / 36,
] as const;
export const OPPOSITE = [0, 3, 4, 1, 2, 7, 8, 5, 6] as const;

export type Arithmetic = "float64" | "float32";

/** What one collision needs besides the nine populations. */
export interface CollisionParameters {
  /** 1/τ. */
  omega: number;
  fx: number;
  fy: number;
}

/**
 * One cell's BGK collision with Guo forcing, in place on `g` (length 9).
 * Returns δρ, ux and uy, the macroscopic fields at collision time, which the
 * GPU stores beside the populations for anything that draws them.
 */
export function collideCell(
  g: Float64Array | number[],
  { omega, fx, fy }: CollisionParameters,
  arithmetic: Arithmetic,
  out: [number, number, number] = [0, 0, 0]
): [number, number, number] {
  const r = arithmetic === "float32" ? Math.fround : identity;
  const [g0, g1, g2, g3, g4, g5, g6, g7, g8] = g;
  // The same association as the shader: left to right.
  const dr = r(
    r(r(r(r(r(r(r(r(g0 + g1) + g2) + g3) + g4) + g5) + g6) + g7) + g8)
  );
  const rho = r(1 + dr);
  const jx = r(r(r(r(r(g1 - g3) + g5) - g6) - g7) + g8);
  const jy = r(r(r(r(r(g2 - g4) + g5) + g6) - g7) - g8);
  const ux = r(r(jx + r(0.5 * fx)) / rho);
  const uy = r(r(jy + r(0.5 * fy)) / rho);
  const usq = r(1.5 * r(r(ux * ux) + r(uy * uy)));
  const keep = r(1 - omega);
  const source = r(1 - r(0.5 * omega));
  for (let i = 0; i < Q; i++) {
    const cx = CX[i];
    const cy = CY[i];
    const w = r(W[i]);
    const cu = r(r(cx * ux) + r(cy * uy));
    const eq = r(
      w * r(dr + r(rho * r(r(r(3 * cu) + r(r(4.5 * cu) * cu)) - usq)))
    );
    const cf = r(r(cx * fx) + r(cy * fy));
    const s = r(
      w *
        r(r(3 * r(r(r(cx - ux) * fx) + r(r(cy - uy) * fy))) + r(r(9 * cu) * cf))
    );
    g[i] = r(r(r(keep * g[i]) + r(omega * eq)) + r(source * s));
  }
  out[0] = dr;
  out[1] = ux;
  out[2] = uy;
  return out;
}

const identity = (value: number) => value;

/**
 * The shifted equilibrium `g_eq,i = w_i [δρ + ρ(3c·u + 4.5(c·u)² − 1.5u²)]`,
 * for initializing a lattice at a given density and velocity.
 */
export function shiftedEquilibrium(
  deltaRho: number,
  ux: number,
  uy: number,
  out: number[] = new Array<number>(Q)
): number[] {
  const rho = 1 + deltaRho;
  const usq = 1.5 * (ux * ux + uy * uy);
  for (let i = 0; i < Q; i++) {
    const cu = CX[i] * ux + CY[i] * uy;
    out[i] = W[i] * (deltaRho + rho * (3 * cu + 4.5 * cu * cu - usq));
  }
  return out;
}

export interface LatticeOptions {
  nx: number;
  ny: number;
  tau: number;
  /** A uniform body force density, lattice units. */
  force?: readonly [number, number];
  arithmetic?: Arithmetic;
}

/**
 * A fully periodic lattice. Walls and open boundaries come in the next gates;
 * a periodic box is where the bulk scheme is verified on its own.
 */
export class CpuD2Q9 {
  readonly nx: number;
  readonly ny: number;
  readonly cells: number;
  /** Post-collision shifted populations, structure of arrays: `i·N + k`. */
  populations: Float64Array | Float32Array;
  private next: Float64Array | Float32Array;
  /** δρ, ux and uy at the last collision, `k`. */
  readonly deltaRho: Float64Array;
  readonly ux: Float64Array;
  readonly uy: Float64Array;
  readonly arithmetic: Arithmetic;
  tau: number;
  force: readonly [number, number];
  steps = 0;

  constructor(options: LatticeOptions) {
    this.nx = options.nx;
    this.ny = options.ny;
    this.cells = this.nx * this.ny;
    this.tau = options.tau;
    this.force = options.force ?? [0, 0];
    this.arithmetic = options.arithmetic ?? "float64";
    const Storage = this.arithmetic === "float32" ? Float32Array : Float64Array;
    this.populations = new Storage(Q * this.cells);
    this.next = new Storage(Q * this.cells);
    this.deltaRho = new Float64Array(this.cells);
    this.ux = new Float64Array(this.cells);
    this.uy = new Float64Array(this.cells);
  }

  /** Sets every cell to equilibrium at the density and velocity given. */
  initialize(
    at: (x: number, y: number) => { deltaRho?: number; ux: number; uy: number }
  ) {
    const eq = new Array<number>(Q);
    for (let y = 0; y < this.ny; y++) {
      for (let x = 0; x < this.nx; x++) {
        const k = y * this.nx + x;
        const { deltaRho = 0, ux, uy } = at(x, y);
        shiftedEquilibrium(deltaRho, ux, uy, eq);
        for (let i = 0; i < Q; i++)
          this.populations[i * this.cells + k] = eq[i];
        this.deltaRho[k] = deltaRho;
        this.ux[k] = ux;
        this.uy[k] = uy;
      }
    }
    this.steps = 0;
  }

  step(count = 1) {
    const { nx, ny, cells } = this;
    const g = new Float64Array(Q);
    const macro: [number, number, number] = [0, 0, 0];
    const parameters = {
      omega: 1 / this.tau,
      fx: this.force[0],
      fy: this.force[1],
    };
    if (this.arithmetic === "float32") {
      parameters.omega = Math.fround(parameters.omega);
      parameters.fx = Math.fround(parameters.fx);
      parameters.fy = Math.fround(parameters.fy);
    }
    for (let n = 0; n < count; n++) {
      const from = this.populations;
      const to = this.next;
      for (let y = 0; y < ny; y++) {
        for (let x = 0; x < nx; x++) {
          const k = y * nx + x;
          for (let i = 0; i < Q; i++) {
            const sx = (x - CX[i] + nx) % nx;
            const sy = (y - CY[i] + ny) % ny;
            g[i] = from[i * cells + sy * nx + sx];
          }
          collideCell(g, parameters, this.arithmetic, macro);
          for (let i = 0; i < Q; i++) to[i * cells + k] = g[i];
          [this.deltaRho[k], this.ux[k], this.uy[k]] = macro;
        }
      }
      this.populations = to;
      this.next = from;
      this.steps++;
    }
  }

  /** Total δρ, summed in float64 whatever the storage. */
  massIncrement(): number {
    let sum = 0;
    for (let k = 0; k < Q * this.cells; k++) sum += this.populations[k];
    return sum;
  }

  /** Total momentum of the stored populations, without the half force. */
  momentum(): [number, number] {
    let jx = 0;
    let jy = 0;
    for (let i = 0; i < Q; i++) {
      let s = 0;
      for (let k = 0; k < this.cells; k++)
        s += this.populations[i * this.cells + k];
      jx += CX[i] * s;
      jy += CY[i] * s;
    }
    return [jx, jy];
  }
}
