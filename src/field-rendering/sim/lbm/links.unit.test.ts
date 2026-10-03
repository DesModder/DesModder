import { CpuD2Q9 } from "./d2q9";
import { bodyForce, computeLinks } from "./links";
import { Q } from "./lattice";

/** Cell centres at integer coordinates, as the lattice counts them. */
const integerGrid = (nx: number, ny: number, periodic = false) => ({
  nx,
  ny,
  centre: (i: number, j: number) => [i, j] as const,
  periodicX: periodic,
  periodicY: periodic,
});

describe("link fractions", () => {
  test("a straight wall is found where it is, along every link", () => {
    const nx = 8;
    const ny = 4;
    const solid = new Uint8Array(nx * ny);
    // Solid for x < 3.3: cells 0..3 are solid, cell 4 is the first fluid one.
    for (let j = 0; j < ny; j++)
      for (let i = 0; i <= 3; i++) solid[j * nx + i] = 1;
    const { q, placed, fallbacks } = computeLinks(
      integerGrid(nx, ny),
      solid,
      () => (x) => x - 3.3
    );
    expect(fallbacks).toBe(0);
    const cells = nx * ny;
    const k = 1 * nx + 4;
    // From x = 4 back toward x = 3 the wall is 0.7 of the way, whether the
    // link is straight (direction 1, east) or diagonal (5 and 8).
    for (const d of [1, 5, 8]) expect(q[d * cells + k]).toBeCloseTo(0.7, 6);
    // Links that do not point into the solid keep the halfway default.
    expect(q[3 * cells + k]).toBe(0.5);
    expect(placed).toBe(ny * 3 - 2);
  });

  test("an undefined wall falls back to halfway and is counted", () => {
    const solid = new Uint8Array(16);
    solid[5] = 1;
    const { fallbacks, placed } = computeLinks(
      integerGrid(4, 4),
      solid,
      () => () => NaN
    );
    expect(placed).toBe(0);
    expect(fallbacks).toBe(8);
  });
});

describe("interpolated bounce-back", () => {
  /**
   * A body-force channel whose walls are not where halfway bounce-back would
   * put them: at y = 1.3 and y = 18.6 on a grid of 0..19. Interpolated walls
   * should recover the parabola between the true walls.
   */
  function channel(interpolate: boolean) {
    const nx = 4;
    const ny = 20;
    const low = 1.3;
    const high = 18.6;
    const force = 1e-6;
    const tau = 0.8;
    const lattice = new CpuD2Q9({ nx, ny, tau, force: [force, 0] });
    const solid = new Uint8Array(nx * ny);
    for (let j = 0; j < ny; j++) {
      if (j < low || j > high)
        for (let i = 0; i < nx; i++) solid[j * nx + i] = 1;
    }
    lattice.solid = solid;
    if (interpolate) {
      lattice.links = computeLinks(
        integerGrid(nx, ny, true),
        solid,
        () => (_, y) => Math.min(y - low, high - y)
      ).q;
    }
    lattice.initialize(() => ({ ux: 0, uy: 0 }));
    lattice.step(40000);
    const nu = (tau - 0.5) / 3;
    let worst = 0;
    let peak = 0;
    for (let j = 2; j <= 18; j++) {
      const exact = (force / (2 * nu)) * (j - low) * (high - j);
      peak = Math.max(peak, exact);
      worst = Math.max(worst, Math.abs(lattice.ux[j * nx + 1] - exact));
    }
    return worst / peak;
  }

  test("puts an off-grid wall where it is, as halfway bounce-back cannot", () => {
    const interpolated = channel(true);
    const halfway = channel(false);
    expect(interpolated).toBeLessThan(0.005);
    // Halfway puts the walls at 1.5 and 18.5, a tenth to a fifth of a cell
    // off: 4.7% out here, against 0.3% for the interpolated walls.
    expect(halfway).toBeGreaterThan(5 * interpolated);
  });
});

describe("momentum-exchange force", () => {
  test("at steady state, the drag on a body balances the force on the fluid", () => {
    // A periodic box pushed along x, with one cylinder: nothing else can take
    // the momentum the force puts in, so the body must, exactly.
    const nx = 48;
    const ny = 32;
    const force = 2e-7;
    const lattice = new CpuD2Q9({ nx, ny, tau: 0.8, force: [force, 0] });
    const solid = new Uint8Array(nx * ny);
    const signed = (x: number, y: number) =>
      Math.hypot(x - 20.3, y - 15.6) - 5.2;
    let fluid = 0;
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        if (signed(i, j) <= 0) solid[j * nx + i] = 1;
        else fluid++;
      }
    }
    lattice.solid = solid;
    const links = computeLinks(integerGrid(nx, ny, true), solid, () => signed);
    expect(links.fallbacks).toBe(0);
    lattice.links = links.q;
    lattice.initialize(() => ({ ux: 0, uy: 0 }));
    lattice.step(30000);
    const [fx, fy] = bodyForce(
      1,
      lattice.cellForce,
      lattice.cellBody,
      solid,
      integerGrid(nx, ny, true)
    );
    expect(fx / (force * fluid)).toBeCloseTo(1, 4);
    // Off-centre in y by 0.1 cell, so a lift exists but is small.
    expect(Math.abs(fy)).toBeLessThan(0.01 * fx);
  });

  test("the rest state's share cancels round a closed body", () => {
    const nx = 10;
    const ny = 10;
    const solid = new Uint8Array(nx * ny);
    for (let j = 3; j < 7; j++)
      for (let i = 2; i < 5; i++) solid[j * nx + i] = 1;
    const zero = new Float64Array(2 * nx * ny);
    const touching = new Uint8Array(nx * ny);
    const [fx, fy] = bodyForce(1, zero, touching, solid, integerGrid(nx, ny));
    expect(fx).toBeCloseTo(0, 15);
    expect(fy).toBeCloseTo(0, 15);
    expect(Q).toBe(9);
  });
});
