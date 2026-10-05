import { testWithPage } from "#tests";
import { CpuD2Q9 } from "./d2q9";
import { dfgChannel } from "./dfg";
import { bodyForce } from "./links";
import { lastCycle, sheddingPeriod, type Sample } from "../measure";
import { runSeries, runToSteady } from "./gpuTesting";

/**
 * Half-precision storage (FP16S, GPT's round 4 §A) against float32, on the
 * DFG cylinders at 32 cells across. GPT's acceptance gate for a storage
 * change: within 0.5% of the same grid in float32, where float32 itself has
 * converged. Its CPU oracle had FP16S's peak drag 0.82% off at D16.
 */
testWithPage(
  "Fluid: FP16S storage against float32 on the DFG cylinders, D32",
  async (driver) => {
    await driver.enablePlugin("vector-tools");
    const D = 32;
    const change = (a: number, b: number) => b / a - 1;

    // 2D-1, steady: drag and pressure drop.
    const steady: Record<string, { CD: number; dp: number }> = {};
    for (const storage of ["fp32", "fp16s"] as const) {
      const s = dfgChannel(D, 20);
      const start = new CpuD2Q9({ nx: s.nx, ny: s.ny, tau: s.tau });
      start.initialize(() => ({ ux: 0, uy: 0 }));
      const run = await runToSteady(
        driver,
        { nx: s.nx, ny: s.ny, tau: s.tau, storage },
        Float32Array.from(start.populations),
        {
          boundaries: s.boundaries,
          solid: Array.from(s.solid),
          links: Array.from(s.links),
          inlet: { ux: s.inletUx, uy: new Array<number>(s.ny).fill(0) },
        },
        {
          rampSteps: 8000,
          sampleEvery: 2000,
          maxSteps: 400000,
          tolerance: 2e-4,
          window: 5,
        }
      );
      const last = run.samples[run.samples.length - 1];
      const rest = bodyForce(
        1,
        new Float64Array(2 * s.nx * s.ny),
        new Uint8Array(s.nx * s.ny),
        s.solid,
        s.grid
      );
      const norm = 0.5 * s.uMean * s.uMean * D;
      const { rows, front, back } = s.pressureProbe;
      const p = (i: number) =>
        (run.final.deltaRho[rows[0] * s.nx + i] +
          run.final.deltaRho[rows[1] * s.nx + i]) /
        2;
      steady[storage] = {
        CD: (last.forces[1][0] + rest[0]) / norm,
        dp: (p(front) - p(back)) * s.pressureScale,
      };
    }

    // 2D-2, shedding: peak drag, lift swing and Strouhal number.
    const shedding: Record<
      string,
      { CDmax: number; CLpp: number; St: number }
    > = {};
    for (const storage of ["fp32", "fp16s"] as const) {
      const s = dfgChannel(D, 100);
      const start = new CpuD2Q9({ nx: s.nx, ny: s.ny, tau: s.tau });
      start.initialize(() => ({ ux: 0, uy: 0 }));
      const steps = Math.round((80 * D) / s.uMean);
      const run = await runSeries(
        driver,
        { nx: s.nx, ny: s.ny, tau: s.tau, storage },
        Float32Array.from(start.populations),
        {
          boundaries: s.boundaries,
          solid: Array.from(s.solid),
          links: Array.from(s.links),
          inlet: { ux: s.inletUx, uy: new Array<number>(s.ny).fill(0) },
          sponge: { width: 32, max: 0.12, reference: [s.uMean, 0] },
        },
        {
          steps,
          rampSteps: Math.round((5 * D) / s.uMean),
          sampleEvery: 20,
          body: 1,
          region: s.cylinderRegion,
        }
      );
      const rest = bodyForce(
        1,
        new Float64Array(2 * s.nx * s.ny),
        new Uint8Array(s.nx * s.ny),
        s.solid,
        s.grid
      );
      const norm = 0.5 * s.uMean * s.uMean * D;
      const window = run.samples.filter(
        (x) => x.step > steps - (20 * D) / s.uMean
      );
      const drag: Sample[] = window.map((x) => ({
        step: x.step,
        value: (x.fx + rest[0]) / norm,
      }));
      const lift: Sample[] = window.map((x) => ({
        step: x.step,
        value: (x.fy + rest[1]) / norm,
      }));
      const period = sheddingPeriod(lift);
      if (!("period" in period))
        throw new Error(`${storage}: ${period.reason}`);
      shedding[storage] = {
        CDmax: lastCycle(drag, period.crossings).max,
        CLpp: lastCycle(lift, period.crossings).peakToPeak,
        St: D / (s.uMean * period.period),
      };
    }

    const deltas = {
      CD: change(steady.fp32.CD, steady.fp16s.CD),
      dp: change(steady.fp32.dp, steady.fp16s.dp),
      CDmax: change(shedding.fp32.CDmax, shedding.fp16s.CDmax),
      CLpp: change(shedding.fp32.CLpp, shedding.fp16s.CLpp),
      St: change(shedding.fp32.St, shedding.fp16s.St),
    };
    // Measured: steady drag 0.03%, pressure drop 0.03%, peak drag 0.48%,
    // lift swing 0.21%, Strouhal number 0.003%.
    // GPT's gate for a storage change.
    for (const value of Object.values(deltas))
      expect(Math.abs(value)).toBeLessThan(0.005);
    await driver.disablePlugin("vector-tools");
  },
  1800000
);
