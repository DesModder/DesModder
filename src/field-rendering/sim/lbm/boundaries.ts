/**
 * The edges of a tank, and solids inside it, for the D2Q9 lattice.
 *
 * Ported from GPT's verified CPU oracle (MIT, `VECTOR_TOOLS_FLUID_RESEARCH_*`),
 * whose conventions and measurements this inherits:
 *
 * - **Walls sit half a cell outside the grid**, and **solid cells use halfway
 *   bounce-back**: a population that would leave toward a wall comes back
 *   reversed at the same cell one step later. A moving wall adds
 *   `6 w_i ρ c_i·u_wall`, with ρ the cell's density from its last collision.
 * - **A slip wall reflects mirror-wise**: what arrives is the population
 *   heading toward the wall, with its normal component reversed, from the
 *   neighbour along the wall.
 * - **Open sides** (left and right only) are reconstructed by Zou–He. A
 *   velocity side prescribes u and derives ρ from the populations it knows. A
 *   pressure side prescribes ρ and derives the normal velocity. Each can be
 *   regularized: the non-equilibrium part is projected onto its second-order
 *   Hermite moments, which removes the ghost modes that make raw Zou–He
 *   unstable near τ = ½. GPT measured raw Zou–He failing a deterministic
 *   channel start at τ = 0.53, and regularized surviving it.
 * - **A sponge** blends the last cells before the outlet toward the reference
 *   flow, `s(x) = s_max ((x − x₀)/W)²`. A 32-cell sponge cut the outlet's
 *   reflection coefficient from 0.76 to 0.008 in GPT's pulse test.
 *
 * Every formula here is in the shifted form `g = f − w`, which needs no change
 * for bounce-back and Zou–He (opposite directions share a weight, so the
 * shifts cancel) and only uses δρ where ρ − 1 would lose precision.
 */

import { CX, CY, OPPOSITE, Q, W } from "./lattice";

export type BoundaryKind =
  | "periodic"
  | "noSlip"
  | "slip"
  | "velocity"
  | "pressure";

export interface BoundarySpec {
  kind: BoundaryKind;
  /** A no-slip wall's own velocity, for a moving lid or belt. */
  wallVelocity?: readonly [number, number];
  /** A pressure side's density increment. */
  deltaRho?: number;
  /** Regularize an open side's reconstruction. */
  regularize?: boolean;
}

export interface Boundaries {
  left: BoundarySpec;
  right: BoundarySpec;
  bottom: BoundarySpec;
  top: BoundarySpec;
}

export const PERIODIC: Boundaries = {
  left: { kind: "periodic" },
  right: { kind: "periodic" },
  bottom: { kind: "periodic" },
  top: { kind: "periodic" },
};

export const SIDES = ["left", "right", "bottom", "top"] as const;
export type Side = (typeof SIDES)[number];
/** The inward normal of each side. */
export const NORMAL: Record<Side, readonly [number, number]> = {
  left: [1, 0],
  right: [-1, 0],
  bottom: [0, 1],
  top: [0, -1],
};

export const isOpen = (spec: BoundarySpec) =>
  spec.kind === "velocity" || spec.kind === "pressure";
export const isWall = (spec: BoundarySpec) =>
  spec.kind === "noSlip" || spec.kind === "slip";

/** Refuses combinations nothing here can do correctly. */
export function validateBoundaries(b: Boundaries) {
  if ((b.left.kind === "periodic") !== (b.right.kind === "periodic"))
    throw new Error("Periodic sides must come in pairs: left with right.");
  if ((b.bottom.kind === "periodic") !== (b.top.kind === "periodic"))
    throw new Error("Periodic sides must come in pairs: bottom with top.");
  if (isOpen(b.bottom) || isOpen(b.top))
    throw new Error("Only the left and right sides can be open.");
}

/** The direction j with velocity (cx, cy). */
export function directionOf(cx: number, cy: number): number {
  for (let i = 0; i < Q; i++) if (CX[i] === cx && CY[i] === cy) return i;
  throw new Error(`No D2Q9 direction (${cx}, ${cy}).`);
}

/**
 * Where a slip wall sends direction i from: its mirror image across the wall.
 * Indexed `[side][i]`.
 */
export const MIRROR: Record<Side, number[]> = Object.fromEntries(
  SIDES.map((side) => {
    const [nx, ny] = NORMAL[side];
    return [
      side,
      Array.from({ length: Q }, (_, i) => {
        const dot = CX[i] * nx + CY[i] * ny;
        return directionOf(CX[i] - 2 * dot * nx, CY[i] - 2 * dot * ny);
      }),
    ];
  })
) as Record<Side, number[]>;

/** The named directions of a side, in its own frame: n inward, t along. */
export interface SideFrame {
  E: number;
  NE: number;
  SE: number;
  West: number;
  NW: number;
  SW: number;
  North: number;
  South: number;
  n: readonly [number, number];
  t: readonly [number, number];
}

export function sideFrame(side: Side): SideFrame {
  const n = NORMAL[side];
  const t = [-n[1], n[0]] as const;
  const find = (a: number, z: number) =>
    directionOf(a * n[0] + z * t[0], a * n[1] + z * t[1]);
  return {
    E: find(1, 0),
    NE: find(1, 1),
    SE: find(1, -1),
    West: find(-1, 0),
    NW: find(-1, 1),
    SW: find(-1, -1),
    North: find(0, 1),
    South: find(0, -1),
    n,
    t,
  };
}

/**
 * Zou–He reconstruction of an open side's three unknown populations, in
 * place on `g`, in the oracle's order and the GLSL's. `prescribed` is the
 * velocity for a velocity side and is ignored for a pressure side.
 */
export function reconstructOpen(
  g: Float64Array | number[],
  frame: SideFrame,
  spec: BoundarySpec,
  prescribed: readonly [number, number],
  force: readonly [number, number],
  r: (value: number) => number
) {
  const { E, NE, SE, West, NW, SW, North, South, n, t } = frame;
  const knownDelta = r(
    r(r(g[0] + g[North]) + g[South]) + r(2 * r(r(g[West] + g[NW]) + g[SW]))
  );
  const fn = r(r(force[0] * n[0]) + r(force[1] * n[1]));
  const ft = r(r(force[0] * t[0]) + r(force[1] * t[1]));
  let rd: number;
  let rho: number;
  let un: number;
  let ut: number;
  if (spec.kind === "velocity") {
    const normal = r(r(prescribed[0] * n[0]) + r(prescribed[1] * n[1]));
    const tangent = r(r(prescribed[0] * t[0]) + r(prescribed[1] * t[1]));
    rd = r(r(r(knownDelta + normal) - r(fn / 2)) / r(1 - normal));
    rho = r(1 + rd);
    un = r(normal - r(fn / r(2 * rho)));
    ut = r(tangent - r(ft / r(2 * rho)));
  } else {
    rd = r(spec.deltaRho ?? 0);
    rho = r(1 + rd);
    un = r(r(rd - knownDelta) / rho);
    ut = r(-r(ft / r(2 * rho)));
  }
  g[E] = r(g[West] + r(r(r(2 * rho) * un) / 3));
  g[NE] = r(
    r(r(g[SW] + r(r(g[South] - g[North]) / 2)) + r(r(rho * un) / 6)) +
      r(r(rho * ut) / 2)
  );
  g[SE] = r(
    r(r(g[NW] + r(r(g[North] - g[South]) / 2)) + r(r(rho * un) / 6)) -
      r(r(rho * ut) / 2)
  );
  if (spec.regularize === true) {
    const ux = r(r(un * n[0]) + r(ut * t[0]));
    const uy = r(r(un * n[1]) + r(ut * t[1]));
    const usq = r(1.5 * r(r(ux * ux) + r(uy * uy)));
    const eq = new Array<number>(Q);
    let xx = 0;
    let xy = 0;
    let yy = 0;
    for (let i = 0; i < Q; i++) {
      const cu = r(r(CX[i] * ux) + r(CY[i] * uy));
      eq[i] = r(
        r(W[i]) * r(rd + r(rho * r(r(r(3 * cu) + r(r(4.5 * cu) * cu)) - usq)))
      );
      const ne = r(g[i] - eq[i]);
      xx = r(xx + r(CX[i] * CX[i] * ne));
      xy = r(xy + r(CX[i] * CY[i] * ne));
      yy = r(yy + r(CY[i] * CY[i] * ne));
    }
    for (let i = 0; i < Q; i++) {
      const third = 1 / 3;
      g[i] = r(
        eq[i] +
          r(
            r(4.5 * r(W[i])) *
              r(
                r(
                  r(r(CX[i] * CX[i] - third) * xx) +
                    r(r(2 * CX[i] * CY[i]) * xy)
                ) + r(r(CY[i] * CY[i] - third) * yy)
              )
          )
      );
    }
  }
}

/** The sponge's strength at column x: 0 before it, rising to `max`. */
export function spongeStrength(
  x: number,
  nx: number,
  width: number,
  max: number
): number {
  const start = nx - 1 - width;
  if (width <= 0 || x < start) return 0;
  const s = (x - start) / width;
  return max * s * s;
}

export { OPPOSITE };
