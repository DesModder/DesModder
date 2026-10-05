import { CpuD2Q9 } from "./d2q9";
import {
  MIRROR,
  sideFrame,
  spongeStrength,
  type Boundaries,
} from "./boundaries";
import { CX, CY } from "./lattice";

const wall = { kind: "noSlip" } as const;
const periodic = { kind: "periodic" } as const;

/** Mean |error| / max |exact| of a column of ux against `exact(y)`. */
function profileError(
  lattice: CpuD2Q9,
  x: number,
  exact: (y: number) => number
) {
  let worst = 0;
  let scale = 0;
  for (let y = 0; y < lattice.ny; y++) {
    const e = exact(y);
    scale = Math.max(scale, Math.abs(e));
    worst = Math.max(worst, Math.abs(lattice.ux[y * lattice.nx + x] - e));
  }
  return worst / scale;
}

describe("walls and open sides", () => {
  test("mirror tables reflect the normal component only", () => {
    // Bottom wall: north-east arrives as south-east, east stays east.
    expect(MIRROR.bottom[5]).toBe(8);
    expect(MIRROR.bottom[1]).toBe(1);
    expect(MIRROR.left[5]).toBe(6);
    const left = sideFrame("left");
    expect([CX[left.E], CY[left.E]]).toEqual([1, 0]);
    expect([CX[left.NE], CY[left.NE]]).toEqual([1, 1]);
    const right = sideFrame("right");
    expect([CX[right.E], CY[right.E]]).toEqual([-1, 0]);
  });

  test("a body-force channel between no-slip walls is Poiseuille's parabola", () => {
    const ny = 32;
    const tau = 0.8;
    const force = 1e-6;
    const lattice = new CpuD2Q9({ nx: 4, ny, tau, force: [force, 0] });
    lattice.setBoundaries({
      left: periodic,
      right: periodic,
      bottom: wall,
      top: wall,
    });
    lattice.initialize(() => ({ ux: 0, uy: 0 }));
    lattice.step(30000);
    const nu = (tau - 0.5) / 3;
    // Walls half a cell outside the grid: at y = −½ and y = ny − ½.
    const exact = (y: number) =>
      (force / (2 * nu)) * (y + 0.5) * (ny - 0.5 - y);
    expect(profileError(lattice, 1, exact)).toBeLessThan(0.002);
    expect(Math.abs(lattice.massIncrement())).toBeLessThan(1e-12);
  });

  test("a moving lid drives Couette's straight line", () => {
    const ny = 24;
    const lid = 0.02;
    const lattice = new CpuD2Q9({ nx: 4, ny, tau: 0.7 });
    lattice.setBoundaries({
      left: periodic,
      right: periodic,
      bottom: wall,
      top: { kind: "noSlip", wallVelocity: [lid, 0] },
    });
    lattice.initialize(() => ({ ux: 0, uy: 0 }));
    lattice.step(20000);
    const exact = (y: number) => (lid * (y + 0.5)) / ny;
    expect(profileError(lattice, 2, exact)).toBeLessThan(1e-4);
  });

  test("slip walls leave a uniform stream uniform", () => {
    const lattice = new CpuD2Q9({ nx: 8, ny: 10, tau: 0.6 });
    lattice.setBoundaries({
      left: periodic,
      right: periodic,
      bottom: { kind: "slip" },
      top: { kind: "slip" },
    });
    lattice.initialize(() => ({ ux: 0.05, uy: 0 }));
    lattice.step(500);
    for (let k = 0; k < 80; k++) {
      expect(lattice.ux[k]).toBeCloseTo(0.05, 12);
      expect(lattice.uy[k]).toBeCloseTo(0, 12);
    }
  });

  test.each([false, true])(
    "a velocity inlet and pressure outlet carry the flux through (regularized: %s)",
    (regularize) => {
      const nx = 96;
      const ny = 24;
      const umax = 0.04;
      const parabola = (y: number) =>
        (4 * umax * (y + 0.5) * (ny - 0.5 - y)) / (ny * ny);
      const lattice = new CpuD2Q9({ nx, ny, tau: 0.8 });
      const boundaries: Boundaries = {
        left: { kind: "velocity", regularize },
        right: { kind: "pressure", deltaRho: 0, regularize },
        bottom: wall,
        top: wall,
      };
      lattice.setBoundaries(boundaries);
      lattice.inlet = {
        ux: Float64Array.from({ length: ny }, (_, y) => parabola(y)),
        uy: new Float64Array(ny),
      };
      lattice.initialize((_, y) => ({ ux: parabola(y), uy: 0 }));
      lattice.step(6000);
      // Flux at the inlet, the middle and the outlet, as ρu summed per column.
      const flux = (x: number) => {
        let sum = 0;
        for (let y = 0; y < ny; y++) {
          const k = y * nx + x;
          sum += (1 + lattice.deltaRho[k]) * lattice.ux[k];
        }
        return sum;
      };
      // Interior sections only. The reconstructed pressure outlet bends the
      // flow in its last two columns, where a cell-centre ρu stops being the
      // flux through the cell: measured from rest at steady state, the column
      // before the outlet reads 0.52% low and the outlet's own column 0.64%
      // high, in float64 and on the GPU alike. GPT's oracle shows the same at
      // its outlet. Everything upstream agrees with the inlet.
      const inlet = flux(0);
      for (const x of [nx / 4, nx / 2, (3 * nx) / 4]) {
        expect(Math.abs(flux(x) - inlet) / inlet).toBeLessThan(1e-3);
      }
      // A parabola in, a parabola everywhere: the channel's steady state.
      expect(profileError(lattice, nx / 2, parabola)).toBeLessThan(0.01);
    }
  );

  test("a solid block in a periodic box conserves mass exactly", () => {
    const nx = 20;
    const ny = 12;
    const lattice = new CpuD2Q9({ nx, ny, tau: 0.7, force: [1e-5, 0] });
    lattice.solid = new Uint8Array(nx * ny);
    for (let y = 4; y < 8; y++)
      for (let x = 8; x < 12; x++) lattice.solid[y * nx + x] = 1;
    lattice.initialize(() => ({ ux: 0, uy: 0 }));
    const before = lattice.massIncrement();
    lattice.step(400);
    expect(Math.abs(lattice.massIncrement() - before)).toBeLessThan(1e-13);
    // The block holds the flow back: no velocity is reported inside it.
    expect(lattice.ux[5 * nx + 9]).toBe(0);
    // Upstream of the block the fluid has started to move.
    expect(lattice.ux[5 * nx + 2]).toBeGreaterThan(0);
  });

  test("the sponge rises quadratically to its maximum at the outlet", () => {
    expect(spongeStrength(10, 100, 32, 0.12)).toBe(0);
    expect(spongeStrength(99 - 32, 100, 32, 0.12)).toBe(0);
    expect(spongeStrength(99 - 16, 100, 32, 0.12)).toBeCloseTo(0.03, 12);
    expect(spongeStrength(99, 100, 32, 0.12)).toBeCloseTo(0.12, 12);
  });
});

/**
 * A sound pulse sent at the inlet: a rigid velocity inlet sends it all back,
 * and an absorbing one (`absorbingInflow`) lets it out. A tunnel whose inlet
 * reflected rang at its round-trip period, and the particles drew the ringing
 * as bands across the stream.
 */
describe("the absorbing inlet", () => {
  const nx = 400;
  const ny = 4;
  const u = 0.05;
  const c = 1 / Math.sqrt(3);
  const boundaries: Boundaries = {
    left: { kind: "velocity", regularize: true },
    right: { kind: "pressure", deltaRho: 0, regularize: true },
    bottom: { kind: "slip" },
    top: { kind: "slip" },
  };

  /** The largest δρ left in the middle once the pulse has been and gone. */
  const echo = (absorbing: number) => {
    const lattice = new CpuD2Q9({ nx, ny, tau: 0.55 });
    lattice.setBoundaries(boundaries);
    lattice.inlet = {
      ux: new Float64Array(ny).fill(u),
      uy: new Float64Array(ny),
    };
    lattice.absorbingInlet = absorbing;
    // A pulse travelling left only: u′ = −c ρ′.
    lattice.initialize((x) => {
      const pulse = 1e-3 * Math.exp(-(((x - 200) / 12) ** 2));
      return { deltaRho: pulse, ux: u - c * pulse, uy: 0 };
    });
    let before = 0;
    for (let k = 0; k < nx * ny; k++)
      before = Math.max(before, Math.abs(lattice.deltaRho[k]));
    // To the inlet and halfway back: 200 cells at c − u, 100 at c + u.
    lattice.step(Math.round(200 / (c - u) + 100 / (c + u)));
    let after = 0;
    for (let y = 0; y < ny; y++)
      for (let x = 40; x < 200; x++)
        after = Math.max(after, Math.abs(lattice.deltaRho[y * nx + x]));
    return after / 1e-3;
  };

  test("lets a pulse out where a rigid inlet sends it back", () => {
    const rigid = echo(0);
    const absorbing = echo(1 / 2000);
    expect(rigid).toBeGreaterThan(0.8);
    expect(absorbing).toBeLessThan(0.1 * rigid);
    // Measured: 0.90 against 0.018.
  });

  test("keeps the steady inflow it is given", () => {
    const lattice = new CpuD2Q9({ nx: 60, ny, tau: 0.55 });
    lattice.setBoundaries(boundaries);
    lattice.inlet = {
      ux: new Float64Array(ny).fill(u),
      uy: new Float64Array(ny),
    };
    lattice.absorbingInlet = 1 / 2000;
    lattice.initialize(() => ({ ux: u, uy: 0 }));
    lattice.step(4000);
    expect(lattice.ux[2 * 60 + 30]).toBeCloseTo(u, 5);
  });
});
