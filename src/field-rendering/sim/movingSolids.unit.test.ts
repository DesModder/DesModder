import { EMPTY_ENVIRONMENT, type FieldEnvironment } from "../latexToGLSL";
import { compileObstacle } from "./obstacles";
import { WALL_SPEED_LIMIT, partialSolids } from "./movingSolids";

const env: FieldEnvironment = {
  functions: new Map(),
  scalars: new Set(["a"]),
};

function disc() {
  const result = compileObstacle(
    String.raw`\left(x-a\right)^{2}+y^{2}\le1`,
    env,
    { degreeMode: false }
  );
  if (!result.ok) throw new Error(result.error);
  return [{ obstacle: result.obstacle, body: 1 }];
}

// 0.1-unit cells over [−4, 4] × [−2, 2].
const grid = { nx: 80, ny: 40, tank: { xMin: -4, xMax: 4, yMin: -2, yMax: 2 } };
const at = (a: number) => ({ time: 0, params: new Map([["a", a]]) });

describe("moving solids as partially saturated cells", () => {
  test("coverage adds up to the region's area", () => {
    const solids = partialSolids(disc(), grid, at(0));
    // π · 1² in units of 0.1² cells: 314.16.
    expect(solids.area.get(1)! / 314.159).toBeCloseTo(1, 2);
    expect(solids.fastest).toBe(0);
  });

  test("a translated region gives its walls the speed it moved at, along the normal", () => {
    const first = partialSolids(disc(), grid, at(0));
    // 0.02 graph units over 10 steps: 0.2 cells in 10 steps, 0.02 per step.
    const second = partialSolids(disc(), grid, at(0.02), {
      signed: first.signed,
      elapsedSteps: 10,
    });
    // The leading edge, on the x axis at x ≈ 1: moving at +0.02 cells/step.
    const i = 50; // centre x = 1.05
    const j = 20; // centre y = 0.05
    const k = j * grid.nx + i;
    expect(second.coverage[k]).toBeGreaterThan(0);
    expect(second.velocity[2 * k]).toBeCloseTo(0.02, 3);
    // At the top of the disc the normal is vertical, so the normal velocity
    // of a sideways move is about zero.
    const top = 29 * grid.nx + 40; // centre (0.05, 0.95)
    expect(second.coverage[top]).toBeGreaterThan(0);
    expect(Math.abs(second.velocity[2 * top + 1])).toBeLessThan(0.003);
    // A slide is a translation, so the top's wall slides along with it, and
    // so does the inside, where the level set alone would divide by a
    // vanishing gradient at the centre.
    expect(second.velocity[2 * top]).toBeCloseTo(0.02, 3);
    const centre = 20 * grid.nx + 40; // centre (0.05, 0.05)
    expect(second.coverage[centre]).toBe(1);
    expect(second.velocity[2 * centre]).toBeCloseTo(0.02, 4);
    expect(second.velocity[2 * centre + 1]).toBeCloseTo(0, 4);
  });

  test("a smoothed translation moves the whole solid, walls included", () => {
    const first = partialSolids(disc(), grid, at(0));
    // The raw slide is 0.02 cells a step; the caller's average says 0.015.
    const seen: number[] = [];
    const second = partialSolids(
      disc(),
      grid,
      at(0.02),
      { signed: first.signed, elapsedSteps: 10 },
      (_body, raw) => {
        seen.push(raw[0]);
        return [0.015, 0];
      }
    );
    expect(seen[0]).toBeCloseTo(0.02, 3);
    const centre = 20 * grid.nx + 40;
    const leading = 20 * grid.nx + 50;
    expect(second.velocity[2 * centre]).toBeCloseTo(0.015, 6);
    // The wall's level-set speed matched the raw slide, so it adds nothing.
    expect(second.velocity[2 * leading]).toBeCloseTo(0.015, 3);
  });

  test("a growing region pushes its walls outward without moving its inside", () => {
    const radius = (r: number) => {
      const result = compileObstacle(String.raw`x^{2}+y^{2}\le${r}^{2}`, env, {
        degreeMode: false,
      });
      if (!result.ok) throw new Error(result.error);
      return [{ obstacle: result.obstacle, body: 1 }];
    };
    const first = partialSolids(radius(1), grid, at(0));
    // 0.01 units in 10 steps: 0.01 cells a step outward.
    const second = partialSolids(radius(1.01), grid, at(0), {
      signed: first.signed,
      elapsedSteps: 10,
    });
    const right = 20 * grid.nx + 50; // centre (1.05, 0.05)
    const left = 20 * grid.nx + 29; // centre (−1.05, 0.05)
    expect(second.velocity[2 * right]).toBeCloseTo(0.01, 3);
    expect(second.velocity[2 * left]).toBeCloseTo(-0.01, 3);
    const centre = 20 * grid.nx + 40;
    expect(second.velocity[2 * centre]).toBeCloseTo(0, 10);
  });

  test("a wall faster than the limit is slowed to it, and says how fast it wanted", () => {
    const first = partialSolids(disc(), grid, at(0));
    // 1.5 cells in 5 steps: 0.3 cells a step.
    const jump = partialSolids(disc(), grid, at(0.15), {
      signed: first.signed,
      elapsedSteps: 5,
    });
    expect(jump.fastest).toBeGreaterThan(WALL_SPEED_LIMIT);
    expect(jump.teleported).toBe(false);
    let fastestApplied = 0;
    for (let k = 0; k < grid.nx * grid.ny; k++) {
      fastestApplied = Math.max(
        fastestApplied,
        Math.hypot(jump.velocity[2 * k], jump.velocity[2 * k + 1])
      );
    }
    expect(fastestApplied).toBeLessThanOrEqual(WALL_SPEED_LIMIT + 1e-7);
  });

  test("a wall that jumped several cells gets no velocity", () => {
    const first = partialSolids(disc(), grid, at(0));
    // 5 cells in one update: it did not sweep the cells between.
    const jump = partialSolids(disc(), grid, at(0.5), {
      signed: first.signed,
      elapsedSteps: 5,
    });
    expect(jump.teleported).toBe(true);
    // The leading edge, now near x = 1.5, is covered and at rest.
    const k = 20 * grid.nx + 55;
    expect(jump.coverage[k]).toBeGreaterThan(0);
    expect(jump.velocity[2 * k]).toBe(0);
  });

  test("an undefined region covers nothing", () => {
    const result = compileObstacle(String.raw`y<\sqrt{x}`, EMPTY_ENVIRONMENT, {
      degreeMode: false,
    });
    if (!result.ok) throw new Error(result.error);
    const solids = partialSolids(
      [{ obstacle: result.obstacle, body: 1 }],
      grid,
      at(0)
    );
    // Left half (x < 0) undefined: no coverage there at all.
    for (let j = 0; j < grid.ny; j++)
      for (let i = 0; i < 40; i++)
        expect(solids.coverage[j * grid.nx + i]).toBe(0);
  });
});
