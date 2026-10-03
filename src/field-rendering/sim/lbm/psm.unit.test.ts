import {
  CpuD2Q9,
  CX,
  CY,
  Q,
  partiallySaturated,
  shiftedEquilibrium,
} from "./d2q9";

/** A disc of partial coverage, moving at (wu, wv), on a periodic lattice. */
function lattice(wu: number, wv: number, start: [number, number]) {
  const nx = 32;
  const ny = 24;
  const l = new CpuD2Q9({ nx, ny, tau: 0.65 });
  const coverage = new Float32Array(nx * ny);
  const velocity = new Float32Array(2 * nx * ny);
  const body = new Uint8Array(nx * ny);
  for (let y = 0; y < ny; y++) {
    for (let x = 0; x < nx; x++) {
      const k = y * nx + x;
      const eps = Math.max(
        0,
        Math.min(1, 0.5 - (Math.hypot(x - 12.3, y - 11.7) - 4.6))
      );
      coverage[k] = eps;
      body[k] = eps > 0 ? 1 : 0;
      velocity[2 * k] = wu;
      velocity[2 * k + 1] = wv;
    }
  }
  l.psm = { coverage, velocity, body };
  l.initialize(() => ({ ux: start[0], uy: start[1] }));
  return l;
}

describe("partially saturated cells", () => {
  test("a solid moving with a uniform stream leaves it exactly uniform", () => {
    // Velocities float32 holds exactly, since the solid's is stored in one.
    const [u, v] = [5 / 128, -1 / 128];
    const l = lattice(u, v, [u, v]);
    l.step(200);
    for (let k = 0; k < l.cells; k++) {
      expect(l.ux[k]).toBeCloseTo(u, 14);
      expect(l.uy[k]).toBeCloseTo(v, 14);
    }
  });

  test("mass is kept, and the solid takes exactly the momentum the fluid loses", () => {
    const l = lattice(0, 0, [0.03, 0]);
    const mass = l.massIncrement();
    const [jx0, jy0] = l.momentum();
    let fx = 0;
    let fy = 0;
    for (let n = 0; n < 300; n++) {
      l.step(1);
      for (let k = 0; k < l.cells; k++) {
        if (l.cellBody[k] !== 1) continue;
        fx += l.cellForce[2 * k];
        fy += l.cellForce[2 * k + 1];
      }
    }
    const [jx, jy] = l.momentum();
    expect(l.massIncrement() - mass).toBeCloseTo(0, 12);
    expect(jx0 - jx).toBeCloseTo(fx, 12);
    expect(jy0 - jy).toBeCloseTo(fy, 12);
    // A held solid in a stream is pushed downstream.
    expect(fx).toBeGreaterThan(0);
  });

  test("a fully covered cell at rest relaxes to the solid's velocity", () => {
    // ε = 1: B = 1, and the cell becomes f_eq at the solid velocity plus the
    // (1 − 1/τ) share of its own non-equilibrium.
    const g = shiftedEquilibrium(0.002, 0.05, 0);
    const pre = [...g];
    const after = [...g];
    const [fx] = partiallySaturated(
      after,
      pre,
      [0.002, 0.05, 0],
      1,
      0,
      0,
      0.8,
      1 / 0.8
    );
    let jx = 0;
    for (let i = 0; i < Q; i++) jx += CX[i] * after[i] + 0 * CY[i];
    expect(jx).toBeCloseTo(0, 14);
    expect(fx).toBeCloseTo(1.002 * 0.05, 12);
  });
});
