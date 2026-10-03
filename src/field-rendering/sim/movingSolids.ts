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
  previous?: { signed: Float32Array[]; elapsedSteps: number }
): PartialSolids {
  const { nx, ny, tank } = grid;
  const cells = nx * ny;
  const dx = (tank.xMax - tank.xMin) / nx;
  const dy = (tank.yMax - tank.yMin) / ny;
  const h = 0.5 * Math.min(dx, dy);
  const coverage = new Float32Array(cells);
  const velocity = new Float32Array(2 * cells);
  const body = new Uint8Array(cells);
  const area = new Map<number, number>();
  const boxes = new Map<number, [number, number, number, number]>();
  const signed = rows.map(() => new Float32Array(cells));
  // Per cell, for the velocity pass: the wall's normal (unit, in cells) and
  // its normal speed in cells per step, or NaN where the level set says
  // nothing.
  const normal = new Float32Array(2 * cells);
  const normalSpeed = new Float32Array(cells).fill(NaN);
  const steps = previous?.elapsedSteps ?? 0;
  const point = { ...scope, x: 0, y: 0 };

  rows.forEach((row, r) => {
    const F = (x: number, y: number) => {
      point.x = x;
      point.y = y;
      return row.obstacle.signed(point);
    };
    const before = previous?.signed[r];
    for (let j = 0; j < ny; j++) {
      const y = tank.yMin + (j + 0.5) * dy;
      for (let i = 0; i < nx; i++) {
        const x = tank.xMin + (i + 0.5) * dx;
        const k = j * nx + i;
        const f = F(x, y);
        signed[r][k] = f;
        if (!Number.isFinite(f)) continue;
        const gx = (F(x + h, y) - F(x - h, y)) / (2 * h);
        const gy = (F(x, y + h) - F(x, y - h)) / (2 * h);
        const g2 = gx * gx + gy * gy;
        const gradient = g2 > 0 && Number.isFinite(g2);
        // A cell whose gradient vanishes is classified by its sign alone.
        const eps = gradient
          ? Math.max(0, Math.min(1, 0.5 - f / Math.sqrt(g2) / dx))
          : f <= 0
            ? 1
            : 0;
        if (eps <= 0 || eps < coverage[k]) continue;
        coverage[k] = eps;
        body[k] = row.body;
        area.set(row.body, (area.get(row.body) ?? 0) + eps);
        const box = boxes.get(row.body);
        if (box === undefined) boxes.set(row.body, [i, j, i, j]);
        else {
          box[0] = Math.min(box[0], i);
          box[1] = Math.min(box[1], j);
          box[2] = Math.max(box[2], i);
          box[3] = Math.max(box[3], j);
        }
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
  let teleported = false;
  for (const [b, [a, c, d, p, q]] of fits) {
    const det = a * d - c * c;
    // A wall with too few directions (a sliver) pins down no translation.
    if (!(det > 1e-9 * (a + d) ** 2)) continue;
    const ux = (d * p - c * q) / det;
    const uy = (a * q - c * p) / det;
    if (Math.hypot(ux, uy) * steps > TELEPORT_CELLS) {
      teleported = true;
      continue;
    }
    translation.set(b, [ux, uy]);
  }

  let fastest = 0;
  for (let k = 0; k < cells; k++) {
    const b = body[k];
    if (b === 0) continue;
    const [ux, uy] = translation.get(b) ?? [0, 0];
    let vx = ux;
    let vy = uy;
    const vn = normalSpeed[k];
    if (Number.isFinite(vn)) {
      // A wall cell: the translation's normal part replaced by the level
      // set's, which also sees a solid grow or shrink.
      const ex = normal[2 * k];
      const ey = normal[2 * k + 1];
      if (Math.abs(vn) * steps > TELEPORT_CELLS) {
        teleported = true;
        velocity[2 * k] = 0;
        velocity[2 * k + 1] = 0;
        continue;
      }
      const along = vn - (ux * ex + uy * ey);
      vx += along * ex;
      vy += along * ey;
    }
    const speed = Math.hypot(vx, vy);
    fastest = Math.max(fastest, speed);
    if (speed > WALL_SPEED_LIMIT) {
      vx *= WALL_SPEED_LIMIT / speed;
      vy *= WALL_SPEED_LIMIT / speed;
    }
    velocity[2 * k] = vx;
    velocity[2 * k + 1] = vy;
  }
  // A jump moves every cell at once: none of it swept, so none of it moves.
  if (teleported) velocity.fill(0);
  return {
    coverage,
    velocity,
    body,
    signed,
    area,
    boxes,
    fastest,
    teleported,
  };
}
