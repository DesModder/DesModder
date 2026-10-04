/**
 * Solids that move, as the partially saturated cells the lattice needs: how
 * much of each cell a solid covers, and how fast its wall moves there.
 *
 * **Coverage.** A cell is partly solid where the wall crosses it:
 * `ε = clamp(½ − d, 0, 1)`, with d the signed distance from the cell centre to
 * the wall in cells. GPT's oracle took d from an exact distance. A Desmos
 * inequality has no exact distance, so d is the signed function over its
 * gradient's length, F/|∇F|, with the gradient by central differences, which
 * is exact for a plane and close near any smooth wall.
 *
 * **Velocity.** A slider or `t` moves a region, not a rigid body, so the graph
 * says only so much about how each point of it moves. Two things it does say:
 *
 * - The wall's normal velocity, the level set's own: `v_n = −F_t / |∇F|`, with
 *   F_t the change in F at the cell since the last update. That holds for any
 *   motion, a solid growing included, and it is the part that pushes fluid
 *   aside.
 * - The region's translation: the one velocity U whose normal part best fits
 *   every wall cell's normal speed, by least squares. (Its centroid would do
 *   too, but a pixelated disc's centroid follows a sub-cell slide only to
 *   about 5%.)
 *
 * A wall cell takes the translation, with its normal part replaced by the
 * level set's; a cell inside the solid takes the translation alone. For a
 * solid that slides, which is what a slider in `(x − a)² + y² ≤ 1` does, that
 * is exact everywhere; for one growing evenly, U is zero. What it cannot see is a spin about the centroid: a
 * rotating ellipse's walls get their normal velocity, its inside none.
 * The level set's own velocity, `−F_t ∇F / |∇F|²`, is not used inside: deep in
 * a solid ∇F can vanish (at a disc's centre it does), and the quotient with it.
 *
 * **A speed limit.** GPT's third round measured that bounding the wall's
 * displacement to a quarter cell a step still let the flow reach Mach 0.85,
 * and that 0.05 cells a step kept it below 0.14. A wall faster than that is
 * slowed to it, and the caller is told how fast it wanted to go. A solid that
 * jumped more than two cells in one update (a slider dragged fast, or typed
 * into) did not sweep the cells between, and gets no velocity at all.
 */

import type { CompiledObstacle } from "./obstacles";

export interface MovingSolidRow {
  obstacle: CompiledObstacle;
  /** The body number its force is reported under. */
  body: number;
}

export interface MovingSolidsGrid {
  nx: number;
  ny: number;
  tank: { xMin: number; xMax: number; yMin: number; yMax: number };
}

export interface PartialSolids {
  coverage: Float32Array;
  /** Wall velocity, lattice units (cells per step), `2k` and `2k + 1`. */
  velocity: Float32Array;
  body: Uint8Array;
  /** Each row's signed function at every cell centre, for the next update. */
  signed: Float32Array[];
  /** Each body's covered cells, ε summed: its area in cells. */
  area: Map<number, number>;
  /** Each body's cells with any coverage: `[x0, y0, x1, y1]`. */
  boxes: Map<number, [number, number, number, number]>;
  /** The fastest wall speed asked for, before the limit, in cells per step. */
  fastest: number;
  /** Whether some solid jumped too far to have swept the cells between. */
  teleported: boolean;
  /** The bodies that moved or jumped since the last update. */
  moved: Set<number>;
  /** Whether any wall was given a velocity, which a later update must clear. */
  moving: boolean;
}

/**
 * One row's signed function at every cell centre, NaN where undefined, and
 * its gradient by central differences over half a cell, in graph units, at
 * least wherever a wall is near (`nearWall`); NaN where it was not taken or
 * a neighbour is undefined. The CPU takes the gradient only where it is
 * needed; the GPU sampler takes it everywhere, which costs it nothing.
 */
export interface ObstacleSamples {
  signed: Float32Array;
  gradient: Float32Array;
}

/** Cells per step a moving wall may go. */
export const WALL_SPEED_LIMIT = 0.05;

/** Cells a solid may move in one update and still count as having swept them. */
export const TELEPORT_CELLS = 2;

/**
 * Coverage and wall velocity for every moving row. `previous` is the last
 * update's result, and `elapsedSteps` the lattice steps since it; without
 * them, every wall is at rest.
 */
export function partialSolids(
  rows: readonly MovingSolidRow[],
  grid: MovingSolidsGrid,
  scope: { time: number; params: ReadonlyMap<string, number> },
  /** A row with no previous signed function starts at rest. */
  previous?: {
    signed: readonly (Float32Array | undefined)[];
    elapsedSteps: number;
  },
  /**
   * Turns a body's translation over this update (cells per step, over
   * `steps` steps) into the one its cells move with: a caller that sees
   * updates at uneven moments can average them here.
   */
  smooth?: (
    body: number,
    raw: readonly [number, number],
    steps: number
  ) => readonly [number, number]
): PartialSolids {
  return partialSolidsFromSamples(
    rows.map((row) => ({
      body: row.body,
      samples: sampleObstacle(row.obstacle, grid, scope),
    })),
    grid,
    previous,
    smooth
  );
}

/** The distance either side of a centre the gradient is taken over. */
export const gradientStep = (grid: MovingSolidsGrid) =>
  0.5 *
  Math.min(
    (grid.tank.xMax - grid.tank.xMin) / grid.nx,
    (grid.tank.yMax - grid.tank.yMin) / grid.ny
  );

/**
 * A wall within half a cell of a centre puts the neighbour across it on the
 * other side (a planar wall's nearest axis neighbour is at least 1/√2 of a
 * cell further along its normal), so only cells beside a change of sign, or
 * of definedness, need the gradient. The rest are wholly in or out. Cells on
 * the tank's edge are always checked, since their neighbour across the wall
 * may lie outside the grid.
 */
function nearWall(values: Float32Array, nx: number, ny: number, k: number) {
  const i = k % nx;
  const j = (k - i) / nx;
  if (i === 0 || j === 0 || i === nx - 1 || j === ny - 1) return true;
  // Unrolled rather than looped over a list of the four: this runs for every
  // cell of every moving solid on every update, and the list was an
  // allocation each time.
  const here = values[k] <= 0;
  const differs = (n: number) =>
    !Number.isFinite(values[n]) || values[n] <= 0 !== here;
  return differs(k - 1) || differs(k + 1) || differs(k - nx) || differs(k + nx);
}

/** {@link ObstacleSamples} on the CPU, the reference the GPU's are held to. */
export function sampleObstacle(
  obstacle: CompiledObstacle,
  grid: MovingSolidsGrid,
  scope: { time: number; params: ReadonlyMap<string, number> }
): ObstacleSamples {
  const { nx, ny, tank } = grid;
  const cells = nx * ny;
  const dx = (tank.xMax - tank.xMin) / nx;
  const dy = (tank.yMax - tank.yMin) / ny;
  const h = gradientStep(grid);
  const point = { ...scope, x: 0, y: 0 };
  const F = (x: number, y: number) => {
    point.x = x;
    point.y = y;
    return obstacle.signed(point);
  };
  const signed = new Float32Array(cells);
  const gradient = new Float32Array(2 * cells).fill(NaN);
  // The signed function at every centre first: one evaluation a cell.
  for (let j = 0; j < ny; j++) {
    const y = tank.yMin + (j + 0.5) * dy;
    for (let i = 0; i < nx; i++)
      signed[j * nx + i] = F(tank.xMin + (i + 0.5) * dx, y);
  }
  for (let k = 0; k < cells; k++) {
    if (!Number.isFinite(signed[k]) || !nearWall(signed, nx, ny, k)) continue;
    const x = tank.xMin + ((k % nx) + 0.5) * dx;
    const y = tank.yMin + (Math.floor(k / nx) + 0.5) * dy;
    gradient[2 * k] = (F(x + h, y) - F(x - h, y)) / (2 * h);
    gradient[2 * k + 1] = (F(x, y + h) - F(x, y - h)) / (2 * h);
  }
  return { signed, gradient };
}

/** {@link partialSolids}, from each row's samples however they were taken. */
export function partialSolidsFromSamples(
  rows: readonly { body: number; samples: ObstacleSamples }[],
  grid: MovingSolidsGrid,
  previous?: {
    signed: readonly (Float32Array | undefined)[];
    elapsedSteps: number;
  },
  smooth?: (
    body: number,
    raw: readonly [number, number],
    steps: number
  ) => readonly [number, number]
): PartialSolids {
  const { nx, ny, tank } = grid;
  const cells = nx * ny;
  const dx = (tank.xMax - tank.xMin) / nx;
  const dy = (tank.yMax - tank.yMin) / ny;
  const coverage = new Float32Array(cells);
  const velocity = new Float32Array(2 * cells);
  const body = new Uint8Array(cells);
  const area = new Map<number, number>();
  const boxes = new Map<number, [number, number, number, number]>();
  const signed = rows.map((row) => row.samples.signed);
  // Per cell, for the velocity pass: the wall's normal (unit, in cells) and
  // its normal speed in cells per step, or NaN where the level set says
  // nothing.
  const normal = new Float32Array(2 * cells);
  const normalSpeed = new Float32Array(cells).fill(NaN);
  const steps = previous?.elapsedSteps ?? 0;

  rows.forEach((row, r) => {
    const before = previous?.signed[r];
    const values = row.samples.signed;
    const slopes = row.samples.gradient;
    // This row's area and box, gathered here and stored once: a lookup per
    // covered cell was most of this loop's time.
    let rowArea = 0;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        const f = values[k];
        if (!Number.isFinite(f)) continue;
        const near = nearWall(values, nx, ny, k);
        if (f > 0 && !near) continue;
        let gx = 0;
        let gy = 0;
        let g2 = 0;
        if (near) {
          gx = slopes[2 * k];
          gy = slopes[2 * k + 1];
          g2 = gx * gx + gy * gy;
        }
        const gradient = g2 > 0 && Number.isFinite(g2);
        // A cell whose gradient vanishes, or that no wall comes near, is
        // classified by its sign alone.
        const eps = gradient
          ? Math.max(0, Math.min(1, 0.5 - f / Math.sqrt(g2) / dx))
          : f <= 0
            ? 1
            : 0;
        if (eps <= 0 || eps < coverage[k]) continue;
        coverage[k] = eps;
        body[k] = row.body;
        rowArea += eps;
        if (i < x0) x0 = i;
        if (j < y0) y0 = j;
        if (i > x1) x1 = i;
        if (j > y1) y1 = j;
        normalSpeed[k] = NaN;
        // Only a wall cell has a normal speed: inside, ∇F can vanish.
        if (eps >= 1 || !gradient || before === undefined || steps <= 0)
          continue;
        const previousF = before[k];
        if (!Number.isFinite(previousF)) continue;
        // The outward normal in cell units, and −F_t/|∇F| along it.
        const nxc = gx * dx;
        const nyc = gy * dy;
        const length = Math.hypot(nxc, nyc);
        const g = Math.sqrt(g2);
        normal[2 * k] = nxc / length;
        normal[2 * k + 1] = nyc / length;
        normalSpeed[k] = -(f - previousF) / steps / g / dx;
      }
    }
    if (x0 > x1) return;
    area.set(row.body, (area.get(row.body) ?? 0) + rowArea);
    const box = boxes.get(row.body);
    if (box === undefined) boxes.set(row.body, [x0, y0, x1, y1]);
    else {
      box[0] = Math.min(box[0], x0);
      box[1] = Math.min(box[1], y0);
      box[2] = Math.max(box[2], x1);
      box[3] = Math.max(box[3], y1);
    }
  });

  // Each body's translation: the U whose normal part best matches every wall
  // cell's normal speed, Σ (n·U − v_n)² least. A slide fits it exactly; a
  // solid growing evenly fits U = 0.
  const fits = new Map<number, number[]>();
  for (let k = 0; k < cells; k++) {
    const vn = normalSpeed[k];
    if (!Number.isFinite(vn)) continue;
    const ex = normal[2 * k];
    const ey = normal[2 * k + 1];
    const fit = fits.get(body[k]) ?? [0, 0, 0, 0, 0];
    fit[0] += ex * ex;
    fit[1] += ex * ey;
    fit[2] += ey * ey;
    fit[3] += ex * vn;
    fit[4] += ey * vn;
    fits.set(body[k], fit);
  }
  const translation = new Map<number, [number, number]>();
  // Bodies that jumped further than they could have swept.
  const jumped = new Set<number>();
  for (const [b, [a, c, d, p, q]] of fits) {
    const det = a * d - c * c;
    // A wall with too few directions (a sliver) pins down no translation.
    if (!(det > 1e-9 * (a + d) ** 2)) continue;
    const ux = (d * p - c * q) / det;
    const uy = (a * q - c * p) / det;
    if (Math.hypot(ux, uy) * steps > TELEPORT_CELLS) jumped.add(b);
    else translation.set(b, [ux, uy]);
  }
  for (let k = 0; k < cells; k++) {
    if (Math.abs(normalSpeed[k]) * steps > TELEPORT_CELLS) jumped.add(body[k]);
  }
  // The translation each body moves with, which the caller may smooth over
  // several updates (`smooth`); the raw one stays the reference for the
  // walls' own normal speed.
  const applied = new Map<number, readonly [number, number]>();
  for (const [b, raw] of translation)
    applied.set(b, smooth ? smooth(b, raw, steps) : raw);

  // Per body number, which is a byte: arrays rather than maps, since this
  // loop visits every covered cell.
  const appliedX = new Float64Array(256);
  const appliedY = new Float64Array(256);
  const rawX = new Float64Array(256);
  const rawY = new Float64Array(256);
  const still = new Uint8Array(256);
  const movedBody = new Uint8Array(256);
  for (const b of jumped) still[b] = 1;
  for (const [b, [x, y]] of applied) {
    appliedX[b] = x;
    appliedY[b] = y;
  }
  for (const [b, [x, y]] of translation) {
    rawX[b] = x;
    rawY[b] = y;
  }
  let fastest = 0;
  for (let k = 0; k < cells; k++) {
    const b = body[k];
    // A jump moves every cell of the body at once: none of it swept, so none
    // of it moves.
    if (b === 0 || still[b] === 1) continue;
    let vx = appliedX[b];
    let vy = appliedY[b];
    const vn = normalSpeed[k];
    if (Number.isFinite(vn)) {
      // A wall cell: what the level set says beyond this update's own
      // translation (a solid growing or shrinking) is added along the
      // normal. For a slide that is nothing, and the wall moves with the
      // applied translation.
      const ex = normal[2 * k];
      const ey = normal[2 * k + 1];
      const along = vn - (rawX[b] * ex + rawY[b] * ey);
      vx += along * ex;
      vy += along * ey;
    }
    const speed = Math.sqrt(vx * vx + vy * vy);
    if (speed > 0) movedBody[b] = 1;
    if (speed > fastest) fastest = speed;
    if (speed > WALL_SPEED_LIMIT) {
      vx *= WALL_SPEED_LIMIT / speed;
      vy *= WALL_SPEED_LIMIT / speed;
    }
    velocity[2 * k] = vx;
    velocity[2 * k + 1] = vy;
  }
  const moved = new Set<number>(jumped);
  for (let b = 1; b < 256; b++) if (movedBody[b] === 1) moved.add(b);
  return {
    coverage,
    velocity,
    body,
    signed,
    area,
    boxes,
    fastest,
    teleported: jumped.size > 0,
    moved,
    moving: fastest > 0,
  };
}
