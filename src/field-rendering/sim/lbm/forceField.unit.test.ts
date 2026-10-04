import { CpuD2Q9 } from "./d2q9";
import type { Boundaries } from "./boundaries";

const box: Boundaries = {
  left: { kind: "noSlip" },
  right: { kind: "noSlip" },
  bottom: { kind: "noSlip" },
  top: { kind: "noSlip" },
};

/** A closed box pushed by `force(x, y)` per cell, run to steady state. */
function stir(force: (x: number, y: number) => [number, number]) {
  const n = 24;
  const lattice = new CpuD2Q9({ nx: n, ny: n, tau: 0.8 });
  lattice.setBoundaries(box);
  lattice.forceField = new Float64Array(2 * n * n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const [fx, fy] = force(x - (n - 1) / 2, y - (n - 1) / 2);
      lattice.forceField[2 * (y * n + x)] = fx;
      lattice.forceField[2 * (y * n + x) + 1] = fy;
    }
  }
  lattice.initialize(() => ({ ux: 0, uy: 0 }));
  lattice.step(5000);
  let peak = 0;
  for (let k = 0; k < n * n; k++)
    peak = Math.max(peak, Math.hypot(lattice.ux[k], lattice.uy[k]));
  return { peak, mass: lattice.massIncrement() };
}

describe("a force field", () => {
  test("a uniform field is the uniform force, bit for bit", () => {
    const run = (field: boolean) => {
      const lattice = new CpuD2Q9({
        nx: 12,
        ny: 8,
        tau: 0.7,
        force: field ? [0, 0] : [3e-6, -1e-6],
        arithmetic: "float32",
      });
      if (field) {
        lattice.forceField = new Float64Array(2 * 96);
        for (let k = 0; k < 96; k++) {
          lattice.forceField[2 * k] = 3e-6;
          lattice.forceField[2 * k + 1] = -1e-6;
        }
      }
      lattice.initialize(() => ({ ux: 0.01, uy: 0 }));
      lattice.step(50);
      return Array.from(lattice.populations);
    };
    expect(run(true)).toEqual(run(false));
  });

  test("forceScale multiplies the field, as rewriting it would", () => {
    const run = (value: number, scale: number) => {
      const lattice = new CpuD2Q9({
        nx: 12,
        ny: 8,
        tau: 0.7,
        arithmetic: "float32",
      });
      lattice.forceField = new Float64Array(2 * 96);
      for (let k = 0; k < 96; k++) {
        lattice.forceField[2 * k] = value * Math.sin(k);
        lattice.forceField[2 * k + 1] = -value * Math.cos(k);
      }
      lattice.forceScale = scale;
      lattice.initialize(() => ({ ux: 0.01, uy: 0 }));
      lattice.step(50);
      return Array.from(lattice.populations);
    };
    // Halving is exact in floating point, so the two must agree bit for bit.
    expect(run(6e-6, 0.5)).toEqual(run(3e-6, 1));
  });

  test("in a closed box, pressure holds a gradient force and a curl stirs the fluid", () => {
    // The same strength each way: ∇(½ s r²) = s (x, y), and s (−y, x).
    const s = 2e-7;
    const gradient = stir((x, y) => [s * x, s * y]);
    const curl = stir((x, y) => [-s * y, s * x]);
    // The curl drives a real vortex. The gradient drives only the small
    // residual of a compressible scheme, far below it.
    expect(curl.peak).toBeGreaterThan(1e-4);
    expect(gradient.peak).toBeLessThan(0.01 * curl.peak);
    // No-slip walls keep the mass in the box.
    expect(Math.abs(curl.mass)).toBeLessThan(1e-10);
  });
});
