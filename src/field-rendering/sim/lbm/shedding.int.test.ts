import { testWithPage } from "#tests";
import { lastCycle, sheddingPeriod, type Sample } from "../measure";
import { CpuD2Q9 } from "./d2q9";
import { DFG_REFERENCE, dfgChannel } from "./dfg";
import { runOnGpu, runSeries } from "./gpuTesting";
import { bodyForce, computeLinks } from "./links";

/**
 * Gate 4: an unsteady wake, its period and its forces, and the turbulence
 * closure the Auto setting switches on above Re 200.
 */

testWithPage(
  "Fluid gate 4: the Smagorinsky closure steps on the GPU as on the CPU",
  async (driver) => {
    await driver.enablePlugin("vector-tools");
    const nx = 48;
    const ny = 32;
    const grid = {
      nx,
      ny,
      centre: (i: number, j: number) => [i, j] as const,
      periodicX: true,
      periodicY: true,
    };
    const signed = (x: number, y: number) =>
      Math.hypot(x - 20.3, y - 15.6) - 5.2;
    const solid = new Uint8Array(nx * ny);
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) if (signed(i, j) <= 0) solid[j * nx + i] = 1;
    const links = computeLinks(grid, solid, () => signed);
    // Near τ = ½ and fast, where the closure matters.
    const options = {
      nx,
      ny,
      tau: 0.505,
      force: [2e-6, 0] as [number, number],
    };
    const cpu = new CpuD2Q9({ ...options, arithmetic: "float32" });
    cpu.solid = solid;
    cpu.links = links.q;
    cpu.smagorinsky = 0.17;
    cpu.initialize((x, y) => ({
      ux: 0.08,
      uy: 0.01 * Math.sin((2 * Math.PI * x) / nx) * Math.cos(y),
    }));
    const [one, hundred] = await runOnGpu(
      driver,
      options,
      Float32Array.from(cpu.populations),
      [1, 100],
      {
        solid: Array.from(solid),
        links: Array.from(links.q),
        smagorinsky: 0.17,
      }
    );
    const worst = (a: ArrayLike<number>, b: ArrayLike<number>) => {
      let w = 0;
      for (let k = 0; k < b.length; k++) w = Math.max(w, Math.abs(a[k] - b[k]));
      return w;
    };
    cpu.step(1);
    // Wider than plain BGK's 1e-8: the closure takes two square roots per
    // cell, and GLSL leaves their accuracy to the driver. 2.2e-8 on
    // the Intel GPU, a few roundings of populations near 0.03.
    expect(worst(one.populations, cpu.populations)).toBeLessThan(5e-8);
    cpu.step(99);
    expect(worst(hundred.populations, cpu.populations)).toBeLessThan(2e-7);
    await driver.disablePlugin("vector-tools");
  },
  120000
);

/**
 * GPT's oracle, BGK with BFL, regularized open sides and a 32-cell sponge,
 * on the same channel: its last-cycle statistics at each resolution.
 */
const ORACLE = {
  16: {
    CDmin: 3.240288,
    CDmax: 3.305425,
    CLpeakToPeak: 1.968573,
    St: 0.300841,
  },
  32: {
    CDmin: 3.191282,
    CDmax: 3.257686,
    CLpeakToPeak: 2.005968,
    St: 0.302128,
  },
} as const;

testWithPage(
  "Fluid gate 4: the DFG 2D-2 cylinder sheds at the benchmark's Strouhal number",
  async (driver) => {
    await driver.enablePlugin("vector-tools");
    const reference = DFG_REFERENCE.shedding;
    const results: Record<
      number,
      { CDmin: number; CDmax: number; CLpeakToPeak: number; St: number }
    > = {};
    for (const D of [16, 32] as const) {
      const setup = dfgChannel(D, 100);
      expect(setup.fallbacks).toBe(0);
      const { nx, ny, tau, uMean } = setup;
      const start = new CpuD2Q9({ nx, ny, tau });
      start.initialize(() => ({ ux: 0, uy: 0 }));
      // 80 D/U, as in GPT's runs; statistics from the last 20.
      const steps = Math.round((80 * D) / uMean);
      const run = await runSeries(
        driver,
        { nx, ny, tau },
        Float32Array.from(start.populations),
        {
          boundaries: setup.boundaries,
          solid: Array.from(setup.solid),
          links: Array.from(setup.links),
          inlet: { ux: setup.inletUx, uy: new Array<number>(ny).fill(0) },
          sponge: { width: 32, max: 0.12, reference: [uMean, 0] },
        },
        {
          steps,
          rampSteps: Math.round((5 * D) / uMean),
          sampleEvery: (D / 16) * 10,
          body: 1,
          region: setup.cylinderRegion,
        }
      );
      const rest = bodyForce(
        1,
        new Float64Array(2 * nx * ny),
        new Uint8Array(nx * ny),
        setup.solid,
        setup.grid
      );
      const norm = 0.5 * uMean * uMean * D;
      const window = run.samples.filter(
        (s) => s.step > steps - (20 * D) / uMean
      );
      const drag: Sample[] = window.map((s) => ({
        step: s.step,
        value: (s.fx + rest[0]) / norm,
      }));
      const lift: Sample[] = window.map((s) => ({
        step: s.step,
        value: (s.fy + rest[1]) / norm,
      }));
      const shedding = sheddingPeriod(lift);
      if (!("period" in shedding)) throw new Error(`D${D}: ${shedding.reason}`);
      const cd = lastCycle(drag, shedding.crossings);
      const cl = lastCycle(lift, shedding.crossings);
      const St = D / (uMean * shedding.period);
      results[D] = {
        CDmin: cd.min,
        CDmax: cd.max,
        CLpeakToPeak: cl.peakToPeak,
        St,
      };

      // The same scheme as GPT's oracle: the same statistics, to within the
      // difference in start-up and sampling between the two runs.
      expect(Math.abs(cd.max / ORACLE[D].CDmax - 1)).toBeLessThan(0.01);
      expect(Math.abs(cl.peakToPeak / ORACLE[D].CLpeakToPeak - 1)).toBeLessThan(
        0.03
      );
      expect(Math.abs(St / ORACLE[D].St - 1)).toBeLessThan(0.01);

      if (D === 32) {
        await driver.evaluate(
          (
            ux: number[],
            uy: number[],
            solid: number[],
            nx: number,
            ny: number,
            lift: number[],
            drag: number[],
            lines: string[]
          ) => {
            const figure = document.createElement("div");
            figure.id = "lattice-evidence";
            figure.style.cssText =
              "position:fixed;left:0;top:0;z-index:99999;background:#fff;padding:12px;font:13px sans-serif";
            const field = document.createElement("canvas");
            field.width = nx;
            field.height = ny;
            const ctx = field.getContext("2d")!;
            const image = ctx.createImageData(nx, ny);
            const at = (i: number, j: number) =>
              Math.min(ny - 1, Math.max(0, j)) * nx +
              Math.min(nx - 1, Math.max(0, i));
            const vorticity: number[] = [];
            let peak = 0;
            for (let j = 0; j < ny; j++) {
              for (let i = 0; i < nx; i++) {
                const w =
                  (uy[at(i + 1, j)] - uy[at(i - 1, j)]) / 2 -
                  (ux[at(i, j + 1)] - ux[at(i, j - 1)]) / 2;
                vorticity.push(w);
                if (!solid[j * nx + i]) peak = Math.max(peak, Math.abs(w));
              }
            }
            const scale = peak / 4;
            for (let j = 0; j < ny; j++) {
              for (let i = 0; i < nx; i++) {
                const k = j * nx + i;
                const p = ((ny - 1 - j) * nx + i) * 4;
                if (solid[k]) {
                  image.data.set([45, 58, 74, 255], p);
                  continue;
                }
                const v = Math.max(-1, Math.min(1, vorticity[k] / scale));
                image.data.set(
                  [
                    255 * (v > 0 ? 1 : 1 + v),
                    255 * (1 - Math.abs(v)),
                    255 * (v < 0 ? 1 : 1 - v),
                    255,
                  ],
                  p
                );
              }
            }
            ctx.putImageData(image, 0, 0);
            const plot = document.createElement("canvas");
            plot.width = nx;
            plot.height = 120;
            const pc = plot.getContext("2d")!;
            const line = (
              values: number[],
              lo: number,
              hi: number,
              colour: string
            ) => {
              pc.strokeStyle = colour;
              pc.lineWidth = 1.5;
              pc.beginPath();
              values.forEach((v, n) => {
                const x = (n / (values.length - 1)) * (nx - 1);
                const y = 115 - ((v - lo) / (hi - lo)) * 110;
                if (n === 0) pc.moveTo(x, y);
                else pc.lineTo(x, y);
              });
              pc.stroke();
            };
            line(lift, -1.2, 1.2, "#2d70b3");
            line(drag, 3.0, 3.4, "#c74440");
            const caption = document.createElement("pre");
            caption.textContent = lines.join("\n");
            caption.style.margin = "8px 0 0";
            figure.append(field, plot, caption);
            document.body.append(figure);
          },
          run.final.ux,
          run.final.uy,
          Array.from(setup.solid),
          nx,
          ny,
          lift.map((s) => s.value),
          drag.map((s) => s.value),
          [
            `DFG 2D-2, Re 100, 32 cells across the cylinder (${nx} × ${ny}), GPU. Vorticity at the end (red counter-clockwise, blue clockwise); below, the last 20 D/U of lift (blue) and drag (red).`,
            `                       this solver   benchmark      error   GPT's CPU oracle`,
            `drag, maximum C_D     ${cd.max.toFixed(4)}        ${reference.CDmax.toFixed(4)}      ${((cd.max / reference.CDmax - 1) * 100).toFixed(2)}%     ${ORACLE[32].CDmax.toFixed(4)}`,
            `lift, peak to peak    ${cl.peakToPeak.toFixed(4)}        ${reference.CLpeakToPeak.toFixed(4)}      ${((cl.peakToPeak / reference.CLpeakToPeak - 1) * 100).toFixed(2)}%     ${ORACLE[32].CLpeakToPeak.toFixed(4)}`,
            `Strouhal number       ${St.toFixed(4)}        ${reference.St.toFixed(4)}      ${((St / reference.St - 1) * 100).toFixed(2)}%     ${ORACLE[32].St.toFixed(4)}`,
          ]
        );
        const figure = await driver.page.$("#lattice-evidence");
        await figure!.screenshot({
          path: "docs/assets/fluid-gate4-shedding.png",
        });
        await driver.evaluate(() =>
          document.getElementById("lattice-evidence")?.remove()
        );
      }
    }
    // Refinement toward the benchmark.
    for (const key of ["CDmax", "CLpeakToPeak", "St"] as const) {
      expect(Math.abs(results[32][key] - reference[key])).toBeLessThan(
        Math.abs(results[16][key] - reference[key]) + 1e-12
      );
    }
    expect(Math.abs(results[32].St / reference.St - 1)).toBeLessThan(0.005);
    await driver.disablePlugin("vector-tools");
  },
  900000
);
