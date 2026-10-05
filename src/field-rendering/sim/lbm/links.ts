/**
 * Where walls cut lattice links, and the force a body feels.
 *
 * **Link fractions.** A solid's wall rarely passes exactly halfway between two
 * cells. Interpolated bounce-back puts it where it is, given q, the fraction
 * of the link from the fluid cell to its solid neighbour at which the wall
 * crosses. q comes from the obstacle's signed function (`obstacles.ts`):
 * positive in the fluid, zero on the wall. The search follows GPT's oracle:
 * sixteen samples along the link find the first sign change, and 24
 * bisections pin it down to about 10⁻⁷ of a cell. A link whose ends cannot
 * both be evaluated falls back to halfway and is counted, never guessed; it
 * mirrors the strict compiler's rule that undefined is never solid.
 *
 * **Forces.** Each fluid cell reports the momentum it exchanged with walls at
 * its last step, as `−c_i (out + incoming)` summed over its wall links, in
 * shifted populations. A shifted population leaves out its rest weight w_i, so
 * the full exchange adds `−2 w_i c_i` per link. That is the constant pressure
 * of the rest state, and for a closed body it sums to exactly zero, but it is
 * added anyway so the force stays right for a body that meets the tank's
 * edge. Totals are summed in float64 with compensation, because a drag is a
 * small difference of many leaves (GPT's third round, §C2).
 */

import { CX, CY, Q, W } from "./lattice";

export interface LinkGrid {
  nx: number;
  ny: number;
  /**
   * Cell (i, j)'s centre in graph coordinates. It is also asked for cells
   * just outside the grid, as the far end of a link across a periodic side.
   */
  centre: (i: number, j: number) => readonly [number, number];
  /**
   * Whether a link leaving one side comes back at the other, as the lattice's
   * own streaming does across periodic sides. A link that wraps is searched
   * along its true direction, from the fluid cell outward.
   */
  periodicX?: boolean;
  periodicY?: boolean;
}

export interface LinkResult {
  /** `i·N + k`: the wall's fraction along link i of fluid cell k, or ½. */
  q: Float32Array;
  /** Links into a solid that found their wall. */
  placed: number;
  /** Links into a solid whose wall could not be found, left at ½. */
  fallbacks: number;
}

const SAMPLES = 16;
const BISECTIONS = 24;

/**
 * Finds q for every link from a fluid cell into a solid one. `solid` holds
 * body numbers; `signed(body)` is that body's signed function, negative
 * inside.
 */
export function computeLinks(
  grid: LinkGrid,
  solid: Uint8Array,
  signed: (body: number) => (x: number, y: number) => number
): LinkResult {
  const { nx, ny } = grid;
  const cells = nx * ny;
  const q = new Float32Array(Q * cells).fill(0.5);
  let placed = 0;
  let fallbacks = 0;
  const functions = new Map<number, (x: number, y: number) => number>();
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      if (solid[k]) continue;
      // The centre only once a solid neighbour is found: most cells have
      // none, and this runs whenever the solids change.
      let x0 = NaN;
      let y0 = NaN;
      for (let d = 1; d < Q; d++) {
        const si = i - CX[d];
        const sj = j - CY[d];
        const wi = wrapIndex(si, nx, grid.periodicX === true);
        const wj = wrapIndex(sj, ny, grid.periodicY === true);
        if (wi === undefined || wj === undefined) continue;
        const body = solid[wj * nx + wi];
        if (!body) continue;
        // The unwrapped neighbour: the link runs one lattice vector from the
        // fluid cell, even where streaming carries it across a seam.
        if (Number.isNaN(x0)) [x0, y0] = grid.centre(i, j);
        const [x1, y1] = grid.centre(si, sj);
        let f = functions.get(body);
        if (f === undefined) {
          f = signed(body);
          functions.set(body, f);
        }
        const at = (t: number) => f(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
        const found = crossing(at);
        if (found === undefined) {
          fallbacks++;
        } else {
          q[d * cells + k] = found;
          placed++;
        }
      }
    }
  }
  return { q, placed, fallbacks };
}

/** An index inside [0, n), wrapped if periodic, or undefined if it leaves. */
function wrapIndex(index: number, n: number, periodic: boolean) {
  if (index >= 0 && index < n) return index;
  return periodic ? (index + n) % n : undefined;
}

/**
 * A root of `at` in [0, 1], given at(0) = `start` > 0 and at(1) = `end` ≤ 0,
 * by false position with the Illinois rule (the end that keeps its place has
 * its value halved, so neither end sticks). Undefined if a value is NaN.
 */
function falsePosition(
  at: (t: number) => number,
  start: number,
  end: number
): number | undefined {
  let lo = 0;
  let hi = 1;
  let fLo = start;
  let fHi = end;
  let side = 0;
  let t = 0;
  for (let n = 0; n < 60; n++) {
    t = (lo * fHi - hi * fLo) / (fHi - fLo);
    const value = at(t);
    if (Number.isNaN(value)) return undefined;
    if (value > 0) {
      lo = t;
      fLo = value;
      if (side === -1) fHi /= 2;
      side = -1;
    } else {
      hi = t;
      fHi = value;
      if (side === 1) fLo /= 2;
      side = 1;
    }
    if (value === 0 || hi - lo < 1e-9) return t;
  }
  return t;
}

/** The first t in [0, 1] where `at` goes from positive to at most zero. */
function crossing(at: (t: number) => number): number | undefined {
  let previousT = 0;
  let previous = at(0);
  if (Number.isNaN(previous)) return undefined;
  if (previous <= 0) return 0;
  // The usual link: one crossing, the fluid end out and the solid end in.
  // Where the function is close to straight along the link, as it is for
  // any wall smooth on the scale of a cell, the straight line through the
  // ends finds the root. If that and a point a millionth beyond it bracket
  // the wall, with no sign change before it on a coarse scan, it is the
  // crossing; this costs a few evaluations where the scan and bisection below
  // cost forty, which made parking a dragged solid a visible hitch.
  const end = at(1);
  if (end <= 0) {
    const root = falsePosition(at, previous, end);
    if (root !== undefined) {
      let earlier = false;
      for (let s = 1; s / SAMPLES < root; s++) {
        const value = at(s / SAMPLES);
        if (!(value > 0)) {
          earlier = true;
          break;
        }
      }
      if (!earlier) return root;
    }
  }
  for (let s = 1; s <= SAMPLES; s++) {
    const t = s / SAMPLES;
    const value = at(t);
    if (Number.isNaN(value)) return undefined;
    if (value <= 0) {
      let lo = previousT;
      let hi = t;
      for (let b = 0; b < BISECTIONS; b++) {
        const mid = (lo + hi) / 2;
        const v = at(mid);
        if (Number.isNaN(v)) return undefined;
        if (v > 0) lo = mid;
        else hi = mid;
      }
      return (lo + hi) / 2;
    }
    previousT = t;
    previous = value;
  }
  return undefined;
}

/**
 * The force on one body, in lattice units, from each fluid cell's exchanged
 * momentum (`cellForce` as `2k`, `2k + 1`) and the body it touched.
 */
export function bodyForce(
  body: number,
  cellForce: ArrayLike<number>,
  cellBody: ArrayLike<number>,
  solid: Uint8Array,
  grid: Pick<LinkGrid, "nx" | "ny" | "periodicX" | "periodicY">
): [number, number] {
  const sum = [new Compensated(), new Compensated()];
  for (let k = 0; k < cellBody.length; k++) {
    if (cellBody[k] !== body) continue;
    sum[0].add(cellForce[2 * k]);
    sum[1].add(cellForce[2 * k + 1]);
  }
  const [rx, ry] = restShare(body, solid, grid);
  sum[0].add(rx);
  sum[1].add(ry);
  return [sum[0].value, sum[1].value];
}

/**
 * The rest state's share of a body's force, which shifted populations leave
 * out of `cellForce`: −2 w c over every link from fluid into the body.
 *
 * `box` (`[x0, y0, x1, y1]`, the body's cells) limits the search to the
 * fluid cells around it; without one, or on a periodic grid, every cell is
 * looked at. The tab asks this of each body whenever its solids change, and
 * over the whole grid it was a third of what parking a solid cost.
 */
export function restShare(
  body: number,
  solid: Uint8Array,
  grid: Pick<LinkGrid, "nx" | "ny" | "periodicX" | "periodicY">,
  box?: readonly number[]
): [number, number] {
  const { nx, ny } = grid;
  const periodic = grid.periodicX === true || grid.periodicY === true;
  const limit = box !== undefined && !periodic;
  const i0 = limit ? Math.max(0, box[0] - 1) : 0;
  const j0 = limit ? Math.max(0, box[1] - 1) : 0;
  const i1 = limit ? Math.min(nx - 1, box[2] + 1) : nx - 1;
  const j1 = limit ? Math.min(ny - 1, box[3] + 1) : ny - 1;
  const sum = [new Compensated(), new Compensated()];
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      if (solid[j * nx + i]) continue;
      for (let d = 1; d < Q; d++) {
        const si = wrapIndex(i - CX[d], nx, grid.periodicX === true);
        const sj = wrapIndex(j - CY[d], ny, grid.periodicY === true);
        if (si === undefined || sj === undefined) continue;
        if (solid[sj * nx + si] !== body) continue;
        sum[0].add(-2 * W[d] * CX[d]);
        sum[1].add(-2 * W[d] * CY[d]);
      }
    }
  }
  return [sum[0].value, sum[1].value];
}

/** Kahan–Babuška summation. */
class Compensated {
  private sum = 0;
  private error = 0;
  add(value: number) {
    const t = this.sum + value;
    this.error +=
      Math.abs(this.sum) >= Math.abs(value)
        ? this.sum - t + value
        : value - t + this.sum;
    this.sum = t;
  }
  get value() {
    return this.sum + this.error;
  }
}
