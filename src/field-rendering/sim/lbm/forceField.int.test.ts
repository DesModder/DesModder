import { testWithPage } from "#tests";
import { CpuD2Q9 } from "./d2q9";
import { runOnGpu } from "./gpuTesting";

/** The stirred box's force field steps on the GPU as on the CPU. */
testWithPage(
  "Fluid: a force field per cell steps on the GPU as on the CPU",
  async (driver) => {
    await driver.enablePlugin("vector-tools");
    const n = 32;
    const options = {
      nx: n,
      ny: n,
      tau: 0.7,
      force: [1e-6, 0] as [number, number],
    };
    const boundaries = {
      left: { kind: "noSlip" },
      right: { kind: "noSlip" },
      bottom: { kind: "noSlip" },
      top: { kind: "noSlip" },
    } as const;
    const field = new Float32Array(2 * n * n);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const k = y * n + x;
        field[2 * k] = -3e-6 * (y - n / 2);
        field[2 * k + 1] = 3e-6 * (x - n / 2) + 1e-6 * Math.sin(x);
      }
    }
    const cpu = new CpuD2Q9({ ...options, arithmetic: "float32" });
    cpu.setBoundaries(boundaries);
    cpu.forceField = field;
    // Not a power of two, so a scale applied in a different order would show.
    cpu.forceScale = 0.37;
    cpu.initialize(() => ({ ux: 0, uy: 0 }));
    const [one, hundred] = await runOnGpu(
      driver,
      options,
      Float32Array.from(cpu.populations),
      [1, 100],
      { boundaries, forceField: Array.from(field), forceScale: 0.37 }
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
    expect(worst(hundred.ux, cpu.ux)).toBeLessThan(2e-6);
    await driver.disablePlugin("vector-tools");
  },
  120000
);
