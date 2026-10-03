import { CpuD2Q9, CX, CY, Q, W, collideCell } from "./d2q9";

/** A Taylor–Green vortex: the exact decaying solution on a periodic square. */
function taylorGreen(n: number, u0: number) {
  const k = (2 * Math.PI) / n;
  return (x: number, y: number) => ({
    // The pressure field that goes with the vortex, as density: p = c_s² δρ.
    deltaRho:
      -3 * ((u0 * u0) / 4) * (Math.cos(2 * k * x) + Math.cos(2 * k * y)),
    ux: -u0 * Math.cos(k * x) * Math.sin(k * y),
    uy: u0 * Math.sin(k * x) * Math.cos(k * y),
  });
}

/** The vortex's amplitude, projected out of the measured field. */
function amplitude(lattice: CpuD2Q9) {
  const { nx } = lattice;
  const k = (2 * Math.PI) / nx;
  let dot = 0;
  let norm = 0;
  for (let y = 0; y < lattice.ny; y++) {
    for (let x = 0; x < nx; x++) {
      const shape = -Math.cos(k * x) * Math.sin(k * y);
      dot += lattice.ux[y * nx + x] * shape;
      norm += shape * shape;
    }
  }
  return dot / norm;
}

describe("the D2Q9 reference", () => {
  test("the lattice is the standard one", () => {
    expect(W.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 15);
    let sxx = 0;
    let sxy = 0;
    for (let i = 0; i < Q; i++) {
      sxx += W[i] * CX[i] * CX[i];
      sxy += W[i] * CX[i] * CY[i];
    }
    // Second moment c_s² = 1/3, isotropic.
    expect(sxx).toBeCloseTo(1 / 3, 15);
    expect(sxy).toBe(0);
  });

  test("collision conserves mass, and momentum less the force it adds", () => {
    const g = [
      0.01, -0.002, 0.003, 0.001, -0.004, 0.0005, 0.0002, -0.001, 0.002,
    ];
    const before = [...g];
    const fx = 1e-4;
    const fy = -2e-4;
    collideCell(g, { omega: 1 / 0.6, fx, fy }, "float64");
    const sum = (p: number[], c: readonly number[] | null) =>
      p.reduce((s, v, i) => s + v * (c ? c[i] : 1), 0);
    expect(sum(g, null)).toBeCloseTo(sum(before, null), 15);
    expect(sum(g, CX) - sum(before, CX)).toBeCloseTo(fx, 15);
    expect(sum(g, CY) - sum(before, CY)).toBeCloseTo(fy, 15);
  });

  test("a uniform force adds exactly F of momentum per cell per step", () => {
    const lattice = new CpuD2Q9({
      nx: 8,
      ny: 6,
      tau: 0.8,
      force: [2e-5, -1e-5],
    });
    lattice.initialize(() => ({ ux: 0, uy: 0 }));
    lattice.step(50);
    const [jx, jy] = lattice.momentum();
    expect(jx).toBeCloseTo(50 * 2e-5 * 48, 12);
    expect(jy).toBeCloseTo(50 * -1e-5 * 48, 12);
    // The velocity at the last collision: 49 steps of momentum, plus half the
    // force that step adds, which is the Guo convention.
    expect(lattice.ux[0]).toBeCloseTo(49.5 * 2e-5, 12);
    expect(lattice.massIncrement()).toBeCloseTo(0, 13);
  });

  test("a Taylor–Green vortex decays at the rate ν sets", () => {
    const n = 64;
    const tau = 0.56;
    const nu = (tau - 0.5) / 3;
    const u0 = 0.01;
    const lattice = new CpuD2Q9({ nx: n, ny: n, tau });
    lattice.initialize(taylorGreen(n, u0));
    lattice.step(1);
    const a1 = amplitude(lattice);
    const steps = 1500;
    lattice.step(steps);
    const a2 = amplitude(lattice);
    const k = (2 * Math.PI) / n;
    const measured = -Math.log(a2 / a1) / steps;
    const exact = 2 * nu * k * k;
    // Second-order accurate: at 64 cells per wavelength the rate is within a
    // fraction of a percent.
    expect(Math.abs(measured - exact) / exact).toBeLessThan(0.005);
    expect(Math.abs(lattice.massIncrement())).toBeLessThan(1e-12);
  });

  test("shifted float32 keeps a weak vortex that float32 would otherwise lose", () => {
    // GPT's third round, §C1: 16 × 16, U₀ = 10⁻⁴, τ = 0.5006, where unshifted
    // float32 arithmetic lost most of the amplitude. Shorter here, for speed.
    const n = 16;
    const run = (arithmetic: "float64" | "float32") => {
      const lattice = new CpuD2Q9({ nx: n, ny: n, tau: 0.5006, arithmetic });
      lattice.initialize(taylorGreen(n, 1e-4));
      lattice.step(8000);
      return amplitude(lattice);
    };
    const double = run("float64");
    const single = run("float32");
    expect(Math.abs(single - double) / double).toBeLessThan(0.005);
  });
});
