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

import {
  MIRROR,
  NORMAL,
  PERIODIC,
  SIDES,
  isOpen,
  isWall,
  absorbingInflow,
  openPrescribed,
  reconstructOpen,
  sideFrame,
  spongeStrength,
  validateBoundaries,
  type Boundaries,
} from "./boundaries";

import { CX, CY, OPPOSITE, Q, W } from "./lattice";

export { CX, CY, OPPOSITE, Q, W };

export type Arithmetic = "float64" | "float32";

/** What one collision needs besides the nine populations. */
export interface CollisionParameters {
  /** 1/τ. */
  omega: number;
  fx: number;
  fy: number;
  /**
   * The Smagorinsky constant C, or 0 for none. With a closure, each cell
   * relaxes at its own τ_eff = ½(τ + √(τ² + 18√2 C² |Π|/ρ)), where Π is the
   * non-equilibrium stress with Guo's force correction: the form GPT's third
   * round measured stable to Re 2000 at C = 0.17.
   */
  smagorinsky?: number;
  /** τ itself, which the closure needs; defaults to 1/omega. */
  tau?: number;
}

const { SQRT2 } = Math;

/**
 * One cell's BGK collision with Guo forcing, in place on `g` (length 9).
 * Returns δρ, ux and uy, the macroscopic fields at collision time, which the
 * GPU stores beside the populations for anything that draws them.
 */
export function collideCell(
  g: Float64Array | number[],
  { omega: baseOmega, fx, fy, smagorinsky = 0, tau }: CollisionParameters,
  arithmetic: Arithmetic,
  out: [number, number, number] = [0, 0, 0]
): [number, number, number] {
  let omega = baseOmega;
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
  const eq = EQ_SCRATCH;
  for (let i = 0; i < Q; i++) {
    const cu = r(r(CX[i] * ux) + r(CY[i] * uy));
    eq[i] = r(
      r(W[i]) * r(dr + r(rho * r(r(r(3 * cu) + r(r(4.5 * cu) * cu)) - usq)))
    );
  }
  if (smagorinsky > 0) {
    const n = (i: number) => r(g[i] - eq[i]);
    const xx = r(
      r(r(r(r(r(n(1) + n(3)) + n(5)) + n(6)) + n(7)) + n(8)) + r(ux * fx)
    );
    const yy = r(
      r(r(r(r(r(n(2) + n(4)) + n(5)) + n(6)) + n(7)) + n(8)) + r(uy * fy)
    );
    const xy = r(
      r(r(r(n(5) - n(6)) + n(7)) - n(8)) + r(0.5 * r(r(ux * fy) + r(uy * fx)))
    );
    const stress = r(
      Math.sqrt(r(r(r(xx * xx) + r(yy * yy)) + r(2 * r(xy * xy))))
    );
    const t = tau ?? 1 / baseOmega;
    const c2 = r(smagorinsky * smagorinsky);
    const tauEff = r(
      0.5 *
        r(
          t +
            r(
              Math.sqrt(
                r(r(t * t) + r(r(r(r(18 * SQRT2) * c2) * stress) / rho))
              )
            )
        )
    );
    omega = r(1 / tauEff);
  }
  const keep = r(1 - omega);
  const source = r(1 - r(0.5 * omega));
  for (let i = 0; i < Q; i++) {
    const cx = CX[i];
    const cy = CY[i];
    const cu = r(r(cx * ux) + r(cy * uy));
    const cf = r(r(cx * fx) + r(cy * fy));
    const s = r(
      r(W[i]) *
        r(r(3 * r(r(r(cx - ux) * fx) + r(r(cy - uy) * fy))) + r(r(9 * cu) * cf))
    );
    g[i] = r(r(r(keep * g[i]) + r(omega * eq[i])) + r(source * s));
  }
  out[0] = dr;
  out[1] = ux;
  out[2] = uy;
  return out;
}

const identity = (value: number) => value;

/**
 * The partially saturated method's solid collision, after the cell's fluid
 * collision, in place on `g` (post-collision) given `pre` (the same cell before
 * it). Returns the momentum the solid took, as the force on it.
 *
 * GPT's third round measured this as the method for solids that move: it kept
 * total mass to roundoff, removed the force chatter that refilling cells
 * causes, and agreed between a translating and a fixed body to 0.18%. The
 * forms are Rettinger and Rüde's (2017) M2 and B2, as GPT pinned them:
 *
 *   B   = ε(τ − ½) / ((1 − ε) + (τ − ½))
 *   Ω_s = f_eq(ρ, u_solid) − f + (1 − 1/τ)(f − f_eq(ρ, u))
 *   f'  = f + (1 − B)(f'_fluid − f) + B Ω_s
 *
 * with f the pre-collision populations and f'_fluid the fluid collision's
 * result. Written in shifted populations, where every difference of two
 * populations or equilibria is unchanged.
 */
export function partiallySaturated(
  g: Float64Array | number[],
  pre: Float64Array | number[],
  [dr, ux, uy]: readonly [number, number, number],
  eps: number,
  wu: number,
  wv: number,
  tau: number,
  omega: number,
  r: (value: number) => number = identity
): [number, number] {
  const rho = r(1 + dr);
  const half = r(tau - 0.5);
  const B = r(r(eps * half) / r(r(1 - eps) + half));
  const keep = r(1 - omega);
  const usqFluid = r(1.5 * r(r(ux * ux) + r(uy * uy)));
  const usqWall = r(1.5 * r(r(wu * wu) + r(wv * wv)));
  let fx = 0;
  let fy = 0;
  for (let i = 0; i < Q; i++) {
    const w = r(W[i]);
    const cuF = r(r(CX[i] * ux) + r(CY[i] * uy));
    const cuW = r(r(CX[i] * wu) + r(CY[i] * wv));
    const eqF = r(
      w * r(dr + r(rho * r(r(r(3 * cuF) + r(r(4.5 * cuF) * cuF)) - usqFluid)))
    );
    const eqW = r(
      w * r(dr + r(rho * r(r(r(3 * cuW) + r(r(4.5 * cuW) * cuW)) - usqWall)))
    );
    const omegaS = r(r(eqW - pre[i]) + r(keep * r(pre[i] - eqF)));
    const delta = r(B * omegaS);
    g[i] = r(r(pre[i] + r(r(1 - B) * r(g[i] - pre[i]))) + delta);
    fx -= CX[i] * delta;
    fy -= CY[i] * delta;
  }
  return [fx, fy];
}
const EQ_SCRATCH = new Array<number>(Q).fill(0);

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

/**
 * How a flow's non-equilibrium part scales when the lattice speed is
 * multiplied by `scale` and the relaxation time goes from `tau` to `tauNew`,
 * at the same grid and Reynolds number.
 *
 * Before collision, f_neq ≈ −τ w ρ Q:∇u / c_s² (Chapman–Enskog), and ∇u per
 * step scales with the speed, so it scales by `scale · τ'/τ`. What is stored
 * is after collision, (1 − 1/τ) times that, so the stored part scales by
 * `scale (τ' − 1)/(τ − 1)`. At τ = 1 the stored part is zero and the factor
 * says nothing; collision rebuilds it within a step, so the pre-collision
 * factor is used there instead.
 */
export function rescaleFactors(tau: number, tauNew: number, scale: number) {
  const neqScale =
    Math.abs(tau - 1) < 1e-6
      ? (scale * tauNew) / tau
      : (scale * (tauNew - 1)) / (tau - 1);
  return { neqScale };
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
    this.cellForce = new Float64Array(2 * this.cells);
    this.cellBody = new Uint8Array(this.cells);
    this.inletMean = new Float64Array(2 * this.ny);
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

  /** The tank's edges. Periodic everywhere until set. */
  boundaries: Boundaries = PERIODIC;
  /** Solid cells, `k`: the body's number, or 0 for fluid. */
  solid: Uint8Array | undefined;
  /**
   * Where each wall cuts each link, `i·N + k`, as a fraction from the fluid
   * cell k toward the solid cell it pulls population i from. Without these,
   * every wall is halfway (q = ½). See `links.ts`.
   */
  links: Float32Array | undefined;
  /**
   * The momentum each fluid cell exchanged with walls at its last step, as
   * shifted populations (`2k`, `2k + 1`), and which body it touched. See
   * `bodyForce` for the full force.
   */
  readonly cellForce: Float64Array;
  readonly cellBody: Uint8Array;
  /** A velocity side's profile, per row, scaled by `inletScale`. */
  inlet: { ux: Float64Array; uy: Float64Array } | undefined;
  inletScale = 1;
  /**
   * Lets sound out through a velocity side instead of reflecting it (0 for
   * the rigid inlet). See `absorbingInflow`: the value is the rate at which
   * each row's mean δρ follows its δρ, per step.
   */
  absorbingInlet = 0;
  /** Each velocity side's rows' slow mean δρ, `side·ny + y`, left then right. */
  readonly inletMean: Float64Array;
  /** The Smagorinsky constant, 0 for plain BGK. See `CollisionParameters`. */
  smagorinsky = 0;
  /**
   * Partially saturated cells, for solids that move (see
   * `partiallySaturated`): how much of each cell is solid, the solid's
   * velocity there (`2k`, `2k + 1`, lattice units), and which body it is.
   * These cells are fluid to the lattice and keep their populations, so a
   * moving solid never has to refill a cell it uncovers.
   */
  psm:
    | { coverage: Float32Array; velocity: Float32Array; body: Uint8Array }
    | undefined;
  /**
   * A force density per cell (`2k`, `2k + 1`), added to the uniform `force`:
   * what the stirred box pushes the fluid with.
   */
  forceField: Float64Array | Float32Array | undefined;
  /**
   * What the force field is multiplied by. The stirred box eases its strength
   * through this, a uniform, rather than rewriting the field.
   */
  forceScale = 1;
  sponge:
    | { width: number; max: number; reference: [number, number] }
    | undefined;

  setBoundaries(boundaries: Boundaries) {
    validateBoundaries(boundaries);
    this.boundaries = boundaries;
  }

  step(count = 1) {
    const { nx, ny, cells, boundaries } = this;
    const r = this.arithmetic === "float32" ? Math.fround : identity;
    const g = new Float64Array(Q);
    const pre = new Float64Array(Q);
    const macro: [number, number, number] = [0, 0, 0];
    const parameters = {
      omega: r(1 / this.tau),
      fx: r(this.force[0]),
      fy: r(this.force[1]),
      smagorinsky: r(this.smagorinsky),
      tau: r(this.tau),
    };
    const forceScale = r(this.forceScale);
    const uniformFx = parameters.fx;
    const uniformFy = parameters.fy;
    const kinds = SIDES.map((side) => boundaries[side]);
    const frames = {
      left: sideFrame("left"),
      right: sideFrame("right"),
    };
    const spongeEq =
      this.sponge === undefined
        ? undefined
        : shiftedEquilibrium(0, ...this.sponge.reference).map(r);
    for (let n = 0; n < count; n++) {
      const from = this.populations;
      const to = this.next;
      const post = (i: number, k: number) => from[i * cells + k];
      for (let y = 0; y < ny; y++) {
        for (let x = 0; x < nx; x++) {
          const k = y * nx + x;
          if (this.solid?.[k]) {
            for (let i = 0; i < Q; i++) to[i * cells + k] = post(i, k);
            [this.deltaRho[k], this.ux[k], this.uy[k]] = [0, 0, 0];
            this.cellForce[2 * k] = 0;
            this.cellForce[2 * k + 1] = 0;
            this.cellBody[k] = 0;
            continue;
          }
          const rho = r(1 + this.deltaRho[k]);
          // The uniform force plus this cell's share of a force field, the
          // sum the shader forms too.
          parameters.fx = this.forceField
            ? r(uniformFx + r(forceScale * r(this.forceField[2 * k])))
            : uniformFx;
          parameters.fy = this.forceField
            ? r(uniformFy + r(forceScale * r(this.forceField[2 * k + 1])))
            : uniformFy;
          let linkFx = 0;
          let linkFy = 0;
          let linkBody = 0;
          for (let i = 0; i < Q; i++) {
            let sx = x - CX[i];
            let sy = y - CY[i];
            let wall = -1;
            let open = false;
            if (sx < 0 || sx >= nx) {
              const side = sx < 0 ? 0 : 1;
              const { kind } = kinds[side];
              if (kind === "periodic") sx = (sx + nx) % nx;
              else if (isWall(kinds[side])) wall = side;
              else open = true;
            }
            if (sy < 0 || sy >= ny) {
              const side = sy < 0 ? 2 : 3;
              const { kind } = kinds[side];
              if (kind === "periodic") sy = (sy + ny) % ny;
              else wall = side;
            }
            if (wall >= 0) {
              const spec = kinds[wall];
              const side = SIDES[wall];
              if (spec.kind === "slip") {
                const [wnx, wny] = NORMAL[side];
                const xx = wnx !== 0 ? x : Math.max(0, Math.min(nx - 1, sx));
                const yy = wny !== 0 ? y : Math.max(0, Math.min(ny - 1, sy));
                g[i] = post(MIRROR[side][i], yy * nx + xx);
              } else {
                const [wu, wv] = spec.wallVelocity ?? [0, 0];
                g[i] = r(
                  post(OPPOSITE[i], k) +
                    r(
                      r(6 * r(W[i])) * r(rho * r(r(CX[i] * wu) + r(CY[i] * wv)))
                    )
                );
              }
            } else if (open) {
              g[i] = post(i, k);
            } else {
              const s = sy * nx + sx;
              const body = this.solid?.[s] ?? 0;
              if (body === 0) {
                g[i] = post(i, s);
                continue;
              }
              // Interpolated bounce-back (Bouzidi, Firdaouss and Lallemand),
              // in the oracle's form. q is where the wall cuts the link,
              // measured from this cell; q = ½ is halfway bounce-back.
              const out = post(OPPOSITE[i], k);
              const q = this.links ? this.links[i * cells + k] : 0.5;
              const twoQ = r(2 * q);
              let incoming: number;
              if (q < 0.5) {
                const xx = x + CX[i];
                const yy = y + CY[i];
                const kk = yy * nx + xx;
                incoming =
                  xx >= 0 && xx < nx && yy >= 0 && yy < ny && !this.solid![kk]
                    ? r(r(twoQ * out) + r(r(1 - twoQ) * post(OPPOSITE[i], kk)))
                    : out;
              } else {
                incoming = r(
                  r(out / twoQ) + r(r(r(twoQ - 1) / twoQ) * post(i, k))
                );
              }
              g[i] = incoming;
              // Momentum exchange: what the wall gave back, plus what it took.
              linkFx -= CX[i] * (out + incoming);
              linkFy -= CY[i] * (out + incoming);
              linkBody = body;
            }
          }
          this.cellForce[2 * k] = linkFx;
          this.cellForce[2 * k + 1] = linkFy;
          this.cellBody[k] = linkBody;
          for (const side of ["left", "right"] as const) {
            if (x !== (side === "left" ? 0 : nx - 1)) continue;
            const spec = boundaries[side];
            if (!isOpen(spec)) continue;
            let inflow: [number, number] = this.inlet
              ? [
                  r(this.inlet.ux[y] * this.inletScale),
                  r(this.inlet.uy[y] * this.inletScale),
                ]
              : [0, 0];
            if (this.absorbingInlet > 0 && spec.kind === "velocity") {
              // This cell's δρ is still the last step's here.
              const m = (side === "left" ? 0 : ny) + y;
              const dr = r(this.deltaRho[k]);
              const mean = r(this.inletMean[m]);
              inflow = absorbingInflow(inflow, frames[side].n, dr, mean, r);
              this.inletMean[m] = r(
                mean + r(r(this.absorbingInlet) * r(dr - mean))
              );
            }
            const prescribed = this.psm
              ? openPrescribed(
                  inflow,
                  this.psm.coverage[k],
                  [this.psm.velocity[2 * k], this.psm.velocity[2 * k + 1]],
                  r
                )
              : inflow;
            reconstructOpen(
              g,
              frames[side],
              spec,
              prescribed,
              [parameters.fx, parameters.fy],
              r
            );
          }
          const eps = this.psm ? this.psm.coverage[k] : 0;
          if (eps > 0) for (let i = 0; i < Q; i++) pre[i] = g[i];
          collideCell(g, parameters, this.arithmetic, macro);
          if (eps > 0) {
            const body = this.psm!.body[k];
            const [fx, fy] = partiallySaturated(
              g,
              pre,
              macro,
              eps,
              this.psm!.velocity[2 * k],
              this.psm!.velocity[2 * k + 1],
              parameters.tau,
              parameters.omega,
              r
            );
            this.cellForce[2 * k] += fx;
            this.cellForce[2 * k + 1] += fy;
            this.cellBody[k] = body;
          }
          if (this.sponge && spongeEq) {
            const s = r(
              spongeStrength(x, nx, this.sponge.width, this.sponge.max)
            );
            if (s > 0) {
              for (let i = 0; i < Q; i++)
                g[i] = r(r(r(1 - s) * g[i]) + r(s * spongeEq[i]));
            }
          }
          for (let i = 0; i < Q; i++) to[i * cells + k] = g[i];
          [this.deltaRho[k], this.ux[k], this.uy[k]] = macro;
        }
      }
      this.populations = to;
      this.next = from;
      this.steps++;
    }
  }

  /**
   * The same flow at `scale` times the lattice speed, relaxing with `tau`
   * from here on: what Auto does when the flow runs too fast, instead of
   * restarting it. See `rescaleFactors`.
   *
   * Each fluid cell keeps its equilibrium at `scale` times the velocity and
   * `scale²` times δρ, which is the same pressure at the new speed, and its
   * non-equilibrium part times `neqScale`. Solid cells are left as they are.
   * The populations stored are post-collision, the force is assumed zero, and
   * a turbulence model's own relaxation time is not followed: this is for the
   * wind tunnel, whose force is zero, and its Mach checks, which fire early.
   */
  rescale(scale: number, tau: number) {
    const { cells } = this;
    const r = this.arithmetic === "float32" ? Math.fround : identity;
    const s = r(scale);
    const neqScale = r(rescaleFactors(this.tau, tau, scale).neqScale);
    const g = new Float64Array(Q);
    const pops = this.populations;
    for (let k = 0; k < cells; k++) {
      if (this.solid?.[k]) continue;
      for (let i = 0; i < Q; i++) g[i] = pops[i * cells + k];
      const dr = r(
        r(
          r(r(r(r(r(r(g[0] + g[1]) + g[2]) + g[3]) + g[4]) + g[5]) + g[6]) +
            g[7]
        ) + g[8]
      );
      const rho = r(1 + dr);
      const jx = r(r(r(r(r(g[1] - g[3]) + g[5]) - g[6]) - g[7]) + g[8]);
      const jy = r(r(r(r(r(g[2] - g[4]) + g[5]) + g[6]) - g[7]) - g[8]);
      const ux = r(jx / rho);
      const uy = r(jy / rho);
      const usq = r(1.5 * r(r(ux * ux) + r(uy * uy)));
      const dr2 = r(r(s * s) * dr);
      const rho2 = r(1 + dr2);
      const ux2 = r(s * ux);
      const uy2 = r(s * uy);
      const usq2 = r(1.5 * r(r(ux2 * ux2) + r(uy2 * uy2)));
      for (let i = 0; i < Q; i++) {
        const cu = r(r(CX[i] * ux) + r(CY[i] * uy));
        const eq = r(
          r(W[i]) * r(dr + r(rho * r(r(r(3 * cu) + r(r(4.5 * cu) * cu)) - usq)))
        );
        const cu2 = r(r(CX[i] * ux2) + r(CY[i] * uy2));
        const eq2 = r(
          r(W[i]) *
            r(dr2 + r(rho2 * r(r(r(3 * cu2) + r(r(4.5 * cu2) * cu2)) - usq2)))
        );
        pops[i * cells + k] = r(eq2 + r(neqScale * r(g[i] - eq)));
      }
      this.deltaRho[k] = dr2;
      this.ux[k] = ux2;
      this.uy[k] = uy2;
    }
    // The absorbing inlet's mean pressure, like any other: times s².
    for (let m = 0; m < this.inletMean.length; m++)
      this.inletMean[m] = r(r(s * s) * this.inletMean[m]);
    this.tau = tau;
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
