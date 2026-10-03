import { testWithPage, type Driver } from "#tests";
import { CpuD2Q9, Q } from "./d2q9";

declare let DSM: Window["DSM"];

/**
 * Gate 1: the GPU lattice against the CPU reference, step for step.
 *
 * Both start from the same float32 populations, computed here and uploaded,
 * so any difference is the arithmetic's. The bands are GPT's third-round
 * proposals for a shifted float32 oracle (`VECTOR_TOOLS_FLUID_RESEARCH_FOLLOWUP_2`
 * reply, §C2): exact agreement is possible when the GPU neither reorders nor
 * fuses, and these allow for a driver that does.
 */

interface GpuRun {
  populations: number[];
  deltaRho: number[];
  ux: number[];
  uy: number[];
  error?: string;
}

async function runOnGpu(
  driver: Driver,
  options: { nx: number; ny: number; tau: number; force?: [number, number] },
  populations: Float32Array | Float64Array,
  checkpoints: number[]
): Promise<GpuRun[]> {
  return await driver.evaluate(
    (options, populations: number[], checkpoints: number[]) => {
      const plugin = DSM.enabledPlugins["vector-tools"] as any;
      const { lattice, release } = plugin.fluid.createLattice(options);
      try {
        lattice.setPopulations(new Float32Array(populations));
        const out = [];
        for (const at of checkpoints) {
          lattice.step(at - lattice.steps);
          const read = lattice.read();
          out.push({
            populations: Array.from(read.populations as Float32Array),
            deltaRho: Array.from(read.deltaRho as Float32Array),
            ux: Array.from(read.ux as Float32Array),
            uy: Array.from(read.uy as Float32Array),
          });
        }
        return out;
      } finally {
        release();
      }
    },
    options,
    Array.from(populations),
    checkpoints
  );
}

function taylorGreen(n: number, u0: number) {
  const k = (2 * Math.PI) / n;
  return (x: number, y: number) => ({
    deltaRho:
      -3 * ((u0 * u0) / 4) * (Math.cos(2 * k * x) + Math.cos(2 * k * y)),
    ux: -u0 * Math.cos(k * x) * Math.sin(k * y),
    uy: u0 * Math.sin(k * x) * Math.cos(k * y),
  });
}

function amplitude(ux: ArrayLike<number>, n: number) {
  const k = (2 * Math.PI) / n;
  let dot = 0;
  let norm = 0;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const shape = -Math.cos(k * x) * Math.sin(k * y);
      dot += ux[y * n + x] * shape;
      norm += shape * shape;
    }
  }
  return dot / norm;
}

function maxDifference(a: ArrayLike<number>, b: ArrayLike<number>) {
  let worst = 0;
  for (let i = 0; i < a.length; i++)
    worst = Math.max(worst, Math.abs(a[i] - b[i]));
  return worst;
}

testWithPage(
  "Fluid gate 1: the GPU lattice steps as the CPU reference does",
  async (driver) => {
    await driver.enablePlugin("vector-tools");
    const n = 32;
    const options = {
      nx: n,
      ny: n,
      tau: 0.6,
      force: [1e-6, -2e-6] as [number, number],
    };
    const cpu = new CpuD2Q9({ ...options, arithmetic: "float32" });
    cpu.initialize(taylorGreen(n, 0.02));
    const start = Float32Array.from(cpu.populations);
    const [one, hundred] = await runOnGpu(driver, options, start, [1, 100]);

    cpu.step(1);
    // One step: each population within 1e-9 absolute plus 1e-6 relative.
    let worst = 0;
    for (let k = 0; k < one.populations.length; k++) {
      const expected = cpu.populations[k];
      const excess =
        Math.abs(one.populations[k] - expected) -
        (1e-9 + 1e-6 * Math.abs(expected));
      worst = Math.max(worst, excess);
    }
    expect(worst).toBeLessThanOrEqual(0);
    expect(maxDifference(one.ux, cpu.ux)).toBeLessThan(2e-7);
    expect(maxDifference(one.deltaRho, cpu.deltaRho)).toBeLessThan(8e-7);

    cpu.step(99);
    expect(maxDifference(hundred.populations, cpu.populations)).toBeLessThan(
      2e-7
    );
    expect(maxDifference(hundred.ux, cpu.ux)).toBeLessThan(2e-6);
    expect(maxDifference(hundred.deltaRho, cpu.deltaRho)).toBeLessThan(2e-6);

    await driver.disablePlugin("vector-tools");
  },
  90000
);

testWithPage(
  "Fluid gate 1: the GPU's Taylor–Green vortex decays at the rate ν sets",
  async (driver) => {
    await driver.enablePlugin("vector-tools");
    const n = 64;
    const tau = 0.56;
    const cpu = new CpuD2Q9({ nx: n, ny: n, tau, arithmetic: "float32" });
    cpu.initialize(taylorGreen(n, 0.01));
    const [first, last] = await runOnGpu(
      driver,
      { nx: n, ny: n, tau },
      Float32Array.from(cpu.populations),
      [1, 1501]
    );
    const k = (2 * Math.PI) / n;
    const nu = (tau - 0.5) / 3;
    const measured =
      -Math.log(amplitude(last.ux, n) / amplitude(first.ux, n)) / 1500;
    const exact = 2 * nu * k * k;
    expect(Math.abs(measured - exact) / exact).toBeLessThan(0.005);

    // Against the float64 reference, the same lattice's own answer.
    const reference = new CpuD2Q9({ nx: n, ny: n, tau });
    reference.initialize(taylorGreen(n, 0.01));
    reference.step(1501);
    const relative =
      Math.abs(amplitude(last.ux, n) - amplitude(reference.ux, n)) /
      amplitude(reference.ux, n);
    expect(relative).toBeLessThan(1e-4);

    // Evidence: the GPU's own vorticity, ∂v/∂x − ∂u/∂y by central differences,
    // at the start and after 1,500 steps, on one diverging scale.
    const vorticity = (ux: ArrayLike<number>, uy: ArrayLike<number>) => {
      const out: number[] = [];
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          const at = (i: number, j: number) =>
            ((j + n) % n) * n + ((i + n) % n);
          out.push(
            (uy[at(x + 1, y)] - uy[at(x - 1, y)]) / 2 -
              (ux[at(x, y + 1)] - ux[at(x, y - 1)]) / 2
          );
        }
      }
      return out;
    };
    await driver.evaluate(
      (fields: number[][], n: number) => {
        const scale = Math.max(...fields[0].map(Math.abs));
        const figure = document.createElement("div");
        figure.id = "lattice-evidence";
        figure.style.cssText =
          "position:fixed;left:0;top:0;z-index:99999;background:#fff;padding:12px;font:14px sans-serif;display:flex;gap:16px";
        for (const [index, field] of fields.entries()) {
          const box = document.createElement("div");
          const canvas = document.createElement("canvas");
          canvas.width = n;
          canvas.height = n;
          canvas.style.cssText =
            "width:256px;height:256px;image-rendering:pixelated";
          const context = canvas.getContext("2d")!;
          const image = context.createImageData(n, n);
          for (let y = 0; y < n; y++) {
            for (let x = 0; x < n; x++) {
              const v = field[y * n + x] / scale;
              const k = ((n - 1 - y) * n + x) * 4;
              // Red for counter-clockwise, blue for clockwise, white for none.
              image.data[k] = 255 * (v > 0 ? 1 : 1 + v);
              image.data[k + 1] = 255 * (1 - Math.abs(v));
              image.data[k + 2] = 255 * (v < 0 ? 1 : 1 - v);
              image.data[k + 3] = 255;
            }
          }
          context.putImageData(image, 0, 0);
          const caption = document.createElement("div");
          caption.textContent =
            index === 0
              ? "GPU lattice, step 1"
              : "Step 1,501: same scale, decayed as exp(−2νk²t)";
          box.append(canvas, caption);
          figure.append(box);
        }
        document.body.append(figure);
      },
      [vorticity(first.ux, first.uy), vorticity(last.ux, last.uy)],
      n
    );
    const figure = await driver.page.$("#lattice-evidence");
    await figure!.screenshot({
      path: "docs/assets/fluid-gate1-taylor-green.png",
    });
    await driver.evaluate(() =>
      document.getElementById("lattice-evidence")?.remove()
    );

    // Mass: the perturbation stays put, summed in float64 here.
    const mass = (p: Iterable<number>) => {
      let sum = 0;
      for (const value of p) sum += value;
      return sum;
    };
    expect(
      Math.abs(mass(last.populations) - mass(cpu.populations))
    ).toBeLessThan(1e-6);

    await driver.disablePlugin("vector-tools");
  },
  90000
);

testWithPage(
  "Fluid gate 1: a uniform force adds momentum F per cell per step, with its sign",
  async (driver) => {
    await driver.enablePlugin("vector-tools");
    const options = {
      nx: 16,
      ny: 8,
      tau: 0.8,
      force: [3e-6, -5e-6] as [number, number],
    };
    const cpu = new CpuD2Q9(options);
    cpu.initialize(() => ({ ux: 0, uy: 0 }));
    const [after] = await runOnGpu(
      driver,
      options,
      Float32Array.from(cpu.populations),
      [200]
    );
    const cells = 16 * 8;
    let jx = 0;
    let jy = 0;
    const CX = [0, 1, 0, -1, 0, 1, -1, -1, 1];
    const CY = [0, 0, 1, 0, -1, 1, 1, -1, -1];
    for (let i = 0; i < Q; i++) {
      for (let k = 0; k < cells; k++) {
        jx += CX[i] * after.populations[i * cells + k];
        jy += CY[i] * after.populations[i * cells + k];
      }
    }
    expect(jx / (200 * cells * 3e-6)).toBeCloseTo(1, 4);
    expect(jy / (200 * cells * -5e-6)).toBeCloseTo(1, 4);
    expect(after.ux[0]).toBeGreaterThan(0);
    expect(after.uy[0]).toBeLessThan(0);

    await driver.disablePlugin("vector-tools");
  },
  90000
);
