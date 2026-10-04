import { testWithPage } from "#tests";
import { CpuD2Q9 } from "./d2q9";
import { runOnGpu } from "./gpuTesting";

declare let DSM: Window["DSM"];

/**
 * Gate 6 on the GPU: partially saturated cells, the method for solids that
 * move, against the CPU reference and against GPT's measured Galilean pair.
 */

function disc(
  nx: number,
  ny: number,
  cx: number,
  cy: number,
  r: number,
  u: [number, number]
) {
  const coverage: number[] = [];
  const velocity: number[] = [];
  const body: number[] = [];
  for (let y = 0; y < ny; y++) {
    for (let x = 0; x < nx; x++) {
      const eps = Math.max(
        0,
        Math.min(1, 0.5 - (Math.hypot(x - cx, y - cy) - r))
      );
      coverage.push(eps);
      body.push(eps > 0 ? 1 : 0);
      velocity.push(u[0], u[1]);
    }
  }
  return { coverage, velocity, body };
}

testWithPage(
  "Fluid gate 6: partially saturated cells step on the GPU as on the CPU",
  async (driver) => {
    await driver.enablePlugin("vector-tools");
    const nx = 40;
    const ny = 28;
    const options = { nx, ny, tau: 0.62, force: [1e-6, 0] as [number, number] };
    const psm = disc(nx, ny, 14.3, 13.6, 5.2, [-0.02, 0.01]);
    const cpu = new CpuD2Q9({ ...options, arithmetic: "float32" });
    cpu.psm = {
      coverage: Float32Array.from(psm.coverage),
      velocity: Float32Array.from(psm.velocity),
      body: Uint8Array.from(psm.body),
    };
    cpu.initialize((x) => ({ ux: 0.03, uy: 0.005 * Math.sin(x) }));
    const [one, hundred] = await runOnGpu(
      driver,
      options,
      Float32Array.from(cpu.populations),
      [1, 100],
      { psm }
    );
    const worst = (a: ArrayLike<number>, b: ArrayLike<number>) => {
      let w = 0;
      for (let k = 0; k < b.length; k++) w = Math.max(w, Math.abs(a[k] - b[k]));
      return w;
    };
    cpu.step(1);
    expect(worst(one.populations, cpu.populations)).toBeLessThan(1e-8);
    expect(worst(one.cellForce, cpu.cellForce)).toBeLessThan(1e-7);
    cpu.step(99);
    expect(worst(hundred.populations, cpu.populations)).toBeLessThan(2e-7);
    await driver.disablePlugin("vector-tools");
  },
  120000
);

/**
 * A moving solid over the inlet: the inlet prescribes the inflow in the fluid
 * part of a cell and the solid's velocity in the rest (`openPrescribed`), on
 * both solvers alike.
 */
testWithPage(
  "Fluid gate 6: an inlet blows only into the fluid part of a moving solid",
  async (driver) => {
    await driver.enablePlugin("vector-tools");
    const nx = 40;
    const ny = 28;
    const options = { nx, ny, tau: 0.62 };
    const boundaries = {
      left: { kind: "velocity", regularize: true },
      right: { kind: "pressure", deltaRho: 0, regularize: true },
      bottom: { kind: "slip" },
      top: { kind: "slip" },
    } as const;
    // A disc whose centre is outside the tank, so it covers the inlet's middle.
    const psm = disc(nx, ny, -2.3, 13.6, 7.2, [0.01, -0.004]);
    const inlet = {
      ux: Array.from({ length: ny }, () => 0.04),
      uy: Array.from({ length: ny }, () => 0),
    };
    const cpu = new CpuD2Q9({ ...options, arithmetic: "float32" });
    cpu.setBoundaries(boundaries);
    cpu.inlet = { ux: Float64Array.from(inlet.ux), uy: new Float64Array(ny) };
    cpu.psm = {
      coverage: Float32Array.from(psm.coverage),
      velocity: Float32Array.from(psm.velocity),
      body: Uint8Array.from(psm.body),
    };
    cpu.initialize(() => ({ ux: 0.04, uy: 0 }));
    const [one, hundred] = await runOnGpu(
      driver,
      options,
      Float32Array.from(cpu.populations),
      [1, 100],
      { boundaries, inlet, psm }
    );
    const worst = (a: ArrayLike<number>, b: ArrayLike<number>) => {
      let w = 0;
      for (let k = 0; k < b.length; k++) w = Math.max(w, Math.abs(a[k] - b[k]));
      return w;
    };
    cpu.step(1);
    expect(worst(one.populations, cpu.populations)).toBeLessThan(1e-8);
    cpu.step(99);
    expect(worst(hundred.populations, cpu.populations)).toBeLessThan(2e-7);
    // The inlet cell at the disc's middle is fully covered: it moves with the
    // solid, not the inflow.
    const k = 14 * nx;
    expect(psm.coverage[k]).toBe(1);
    expect(cpu.ux[k]).toBeCloseTo(0.01, 3);
    await driver.disablePlugin("vector-tools");
  },
  120000
);

/**
 * GPT's third round,§B1: a cylinder held in a uniform stream, and the same
 * cylinder moving through still fluid at the stream's speed, in a periodic
 * 192 × 96 box. With the same scheme the two drags should agree, and GPT
 * measured 2.013008 and 2.016551. The CPU reference reproduces both to six
 * decimals in float64; this runs the shipped float32 GPU solver.
 */
const GPT = { fixed: 2.013008, translating: 2.016551 } as const;

testWithPage(
  "Fluid gate 6: a moving cylinder feels the drag a held one does, as GPT measured",
  async (driver) => {
    await driver.enablePlugin("vector-tools");
    const results = await driver.evaluate(async () => {
      const plugin = DSM.enabledPlugins["vector-tools"] as any;
      const nx = 192;
      const ny = 96;
      const D = 16;
      const U = 0.03;
      const tau = 0.5 + (3 * U * D) / 20;
      const cy = 47.5;
      const out: Record<string, number> = {};
      for (const mode of ["fixed", "translating"]) {
        const { lattice, release } = plugin.fluid.createLattice({
          nx,
          ny,
          tau,
        });
        try {
          const coverage = new Float32Array(nx * ny);
          const velocity = new Float32Array(2 * nx * ny);
          const body = new Uint8Array(nx * ny);
          const dist = (x: number, cx: number) =>
            ((x - cx + nx * 1.5) % nx) - nx / 2;
          const update = (t: number) => {
            const cx = nx / 2 - (mode === "translating" ? U * t : 0);
            for (let y = 0; y < ny; y++) {
              for (let x = 0; x < nx; x++) {
                const k = y * nx + x;
                const eps = Math.max(
                  0,
                  Math.min(1, 0.5 - (Math.hypot(dist(x, cx), y - cy) - D / 2))
                );
                coverage[k] = eps;
                body[k] = eps > 0 ? 1 : 0;
                velocity[2 * k] = mode === "translating" ? -U : 0;
              }
            }
            lattice.setPartialSolids({ coverage, velocity, body });
          };
          update(0);
          lattice.initialize(() => ({ ux: mode === "fixed" ? U : 0, uy: 0 }));
          let sum = 0;
          let samples = 0;
          for (let t = 0; t < 5000; t++) {
            if (mode === "translating") update(t);
            lattice.step(1);
            if (lattice.steps >= 3000) {
              sum += lattice.sumForces(0, 0, nx, ny).get(1)?.[0] ?? 0;
              samples++;
            }
          }
          out[mode] = sum / samples / (0.5 * U * U * D);
        } finally {
          release();
        }
      }
      return out;
    });
    // Float32 on the GPU against GPT's float64: to a part in a thousand.
    expect(Math.abs(results.fixed / GPT.fixed - 1)).toBeLessThan(1e-3);
    expect(Math.abs(results.translating / GPT.translating - 1)).toBeLessThan(
      1e-3
    );
    // And the point of the method: moving and held agree to GPT's 0.18%.
    expect(Math.abs(results.translating / results.fixed - 1)).toBeLessThan(
      0.003
    );
    await driver.disablePlugin("vector-tools");
  },
  300000
);
