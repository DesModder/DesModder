import { testWithPage } from "#tests";
import { EMPTY_ENVIRONMENT } from "../../latexToGLSL";
import { compileObstacle, type CompiledObstacle } from "../obstacles";
import type { Boundaries } from "./boundaries";
import { CpuD2Q9 } from "./d2q9";
import { runOnGpu, runToSteady } from "./gpuTesting";
import { bodyForce, computeLinks, type LinkGrid } from "./links";

/**
 * Gate 3 on the GPU: solids from the graph as interpolated walls, and the
 * force on them.
 *
 * The obstacles here are written as Desmos LaTeX and go through the strict
 * compiler, the rasterizer and the link search, exactly the path an
 * inequality in somebody's graph will take. Only the lattice runs in the page.
 */

function compile(latex: string): CompiledObstacle {
  const result = compileObstacle(latex, EMPTY_ENVIRONMENT, {
    degreeMode: false,
  });
  if (!result.ok) throw new Error(`${latex}: ${result.error}`);
  return result.obstacle;
}

/** Body numbers per cell, and the link fractions, from compiled obstacles. */
function geometry(grid: LinkGrid, obstacles: CompiledObstacle[]) {
  const { nx, ny } = grid;
  const solid = new Uint8Array(nx * ny);
  const scope = { time: 0, params: new Map<string, number>() };
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const [x, y] = grid.centre(i, j);
      const index = obstacles.findIndex((o) => o.contains({ ...scope, x, y }));
      if (index >= 0) solid[j * nx + i] = index + 1;
    }
  }
  const links = computeLinks(
    grid,
    solid,
    (body) => (x, y) => obstacles[body - 1].signed({ ...scope, x, y })
  );
  return { solid, links };
}

testWithPage(
  "Fluid gate 3: interpolated walls and their forces step as on the CPU",
  async (driver) => {
    await driver.enablePlugin("vector-tools");
    const nx = 48;
    const ny = 32;
    const grid: LinkGrid = {
      nx,
      ny,
      centre: (i, j) => [i, j],
      periodicX: true,
      periodicY: true,
    };
    const { solid, links } = geometry(grid, [
      compile(
        String.raw`\left(x-20.3\right)^{2}+\left(y-15.6\right)^{2}\le27.04`
      ),
    ]);
    expect(links.fallbacks).toBe(0);
    const options = {
      nx,
      ny,
      tau: 0.6,
      force: [3e-6, 1e-6] as [number, number],
    };
    const cpu = new CpuD2Q9({ ...options, arithmetic: "float32" });
    cpu.solid = solid;
    cpu.links = links.q;
    cpu.initialize(() => ({ ux: 0.02, uy: 0 }));
    const [one, hundred] = await runOnGpu(
      driver,
      options,
      Float32Array.from(cpu.populations),
      [1, 100],
      { solid: Array.from(solid), links: Array.from(links.q) }
    );
    const worst = (a: ArrayLike<number>, b: ArrayLike<number>) => {
      let w = 0;
      for (let k = 0; k < b.length; k++) w = Math.max(w, Math.abs(a[k] - b[k]));
      return w;
    };
    cpu.step(1);
    expect(worst(one.populations, cpu.populations)).toBeLessThan(1e-8);
    expect(worst(one.cellForce, cpu.cellForce)).toBeLessThan(1e-7);
    expect(one.cellBody).toEqual(Array.from(cpu.cellBody));
    cpu.step(99);
    expect(worst(hundred.populations, cpu.populations)).toBeLessThan(2e-7);
    const gpuForce = bodyForce(
      1,
      hundred.cellForce,
      hundred.cellBody,
      solid,
      grid
    );
    const cpuForce = bodyForce(1, cpu.cellForce, cpu.cellBody, solid, grid);
    expect(Math.abs(gpuForce[0] - cpuForce[0])).toBeLessThan(
      1e-6 * Math.abs(cpuForce[0]) + 1e-8
    );
    await driver.disablePlugin("vector-tools");
  },
  120000
);

/**
 * DFG benchmark 2D-1 (Schäfer and Turek 1996): a cylinder of diameter 0.1 at
 * (0.2, 0.2) in a 2.2 × 0.41 channel, parabolic inflow with mean speed 0.2,
 * Re 20, steady. Lattice mean speed 0.04 at 16 and 32 cells across the
 * cylinder: GPT's oracle configurations, whose BFL results are pinned here.
 */
const OFFICIAL = { CD: 5.57953523384, CL: 0.010618948146, dp: 0.11752016697 };
const ORACLE = {
  16: {
    CD: 5.701083435784361,
    CL: 0.011741835787454394,
    dp: 0.11962948677440438,
  },
  32: {
    CD: 5.660734810225773,
    CL: 0.010824557311282849,
    dp: 0.11882750938336101,
  },
} as const;

testWithPage(
  "Fluid gate 3: the DFG 2D-1 cylinder's drag, lift and pressure drop, refined",
  async (driver) => {
    await driver.enablePlugin("vector-tools");
    const results: Record<number, { CD: number; CL: number; dp: number }> = {};
    for (const D of [16, 32] as const) {
      const dx = 0.1 / D;
      const nx = Math.round(2.2 / dx) + 1;
      const ny = Math.ceil(0.41 / dx) + 2;
      const uMean = 0.04;
      // Centres on x = i·dx from the inlet, and y = (j − ½)·dx, so no centre
      // lies on a wall: the channel's walls at y = 0 and 0.41 are solids with
      // interpolated links, like the cylinder, not the grid's edge.
      const grid: LinkGrid = {
        nx,
        ny,
        centre: (i, j) => [i * dx, (j - 0.5) * dx],
      };
      const { solid, links } = geometry(grid, [
        compile(
          String.raw`\left(x-0.2\right)^{2}+\left(y-0.2\right)^{2}\le0.0025`
        ),
        compile(String.raw`y\le0`),
        compile(String.raw`y\ge0.41`),
      ]);
      expect(links.fallbacks).toBe(0);
      const H = 0.41;
      const inletUx = Array.from({ length: ny }, (_, j) => {
        const y = (j - 0.5) * dx;
        return y <= 0 || y >= H ? 0 : (4 * 1.5 * uMean * y * (H - y)) / (H * H);
      });
      const boundaries: Boundaries = {
        left: { kind: "velocity", regularize: true },
        right: { kind: "pressure", deltaRho: 0, regularize: true },
        bottom: { kind: "noSlip" },
        top: { kind: "noSlip" },
      };
      const tau = 0.5 + (3 * uMean * D) / 20;
      const start = new CpuD2Q9({ nx, ny, tau });
      start.initialize(() => ({ ux: 0, uy: 0 }));
      const run = await runToSteady(
        driver,
        { nx, ny, tau },
        Float32Array.from(start.populations),
        {
          boundaries,
          solid: Array.from(solid),
          links: Array.from(links.q),
          inlet: { ux: inletUx, uy: new Array<number>(ny).fill(0) },
        },
        {
          rampSteps: 4000 * (D / 16),
          sampleEvery: 1000 * (D / 16),
          maxSteps: 400000,
          tolerance: 2e-4,
          window: 5,
        }
      );
      const last = run.samples[run.samples.length - 1];
      expect(last.step).toBeLessThan(400000);
      // The shifted populations' rest share, which cancels round the closed
      // cylinder, added all the same.
      const rest = bodyForce(
        1,
        new Float64Array(2 * nx * ny),
        new Uint8Array(nx * ny),
        solid,
        grid
      );
      const norm = 0.5 * uMean * uMean * D;
      const CD = (last.forces[1][0] + rest[0]) / norm;
      const CL = (last.forces[1][1] + rest[1]) / norm;
      // Pressure at the cylinder's front and back points, from the two fluid
      // cells straddling y = 0.2 at x = 0.15 and x = 0.25.
      const { deltaRho } = run.final;
      const row = Math.floor(0.2 / dx + 0.5);
      const at = (x: number) => {
        const i = Math.round(x / dx);
        return (deltaRho[row * nx + i] + deltaRho[(row + 1) * nx + i]) / 2;
      };
      const dp = ((at(0.15) - at(0.25)) / 3) * (0.2 / uMean) ** 2;
      results[D] = { CD, CL, dp };
      if (D === 32) {
        // Evidence: the GPU's steady flow, coloured by speed, with the
        // readout against the benchmark.
        await driver.evaluate(
          (
            ux: number[],
            uy: number[],
            solid: number[],
            nx: number,
            ny: number,
            lines: string[]
          ) => {
            const figure = document.createElement("div");
            figure.id = "lattice-evidence";
            figure.style.cssText =
              "position:fixed;left:0;top:0;z-index:99999;background:#fff;padding:12px;font:13px sans-serif";
            const canvas = document.createElement("canvas");
            canvas.width = nx;
            canvas.height = ny;
            canvas.style.cssText = `width:${nx}px;height:${ny}px`;
            const ctx = canvas.getContext("2d")!;
            const image = ctx.createImageData(nx, ny);
            let peak = 0;
            for (let k = 0; k < ux.length; k++)
              peak = Math.max(peak, Math.hypot(ux[k], uy[k]));
            for (let j = 0; j < ny; j++) {
              for (let i = 0; i < nx; i++) {
                const k = j * nx + i;
                const p = ((ny - 1 - j) * nx + i) * 4;
                if (solid[k]) {
                  image.data.set([45, 58, 74, 255], p);
                  continue;
                }
                const s = Math.hypot(ux[k], uy[k]) / peak;
                // A simple blue-to-yellow ramp.
                image.data.set([255 * s, 80 + 150 * s, 255 * (1 - s), 255], p);
              }
            }
            ctx.putImageData(image, 0, 0);
            const caption = document.createElement("pre");
            caption.textContent = lines.join("\n");
            caption.style.margin = "8px 0 0";
            figure.append(canvas, caption);
            document.body.append(figure);
          },
          run.final.ux,
          run.final.uy,
          Array.from(solid),
          nx,
          ny,
          [
            `DFG 2D-1, Re 20, 32 cells across the cylinder (${nx} × ${ny}), GPU, steady after ${last.step} steps. Speed, blue to yellow.`,
            `                 this solver   benchmark      error   GPT's CPU oracle`,
            `drag  C_D        ${CD.toFixed(4)}        ${OFFICIAL.CD.toFixed(4)}      ${((CD / OFFICIAL.CD - 1) * 100).toFixed(2)}%     ${ORACLE[32].CD.toFixed(4)}`,
            `lift  C_L        ${CL.toFixed(5)}       ${OFFICIAL.CL.toFixed(5)}     ${((CL / OFFICIAL.CL - 1) * 100).toFixed(1)}%      ${ORACLE[32].CL.toFixed(5)}`,
            `pressure drop    ${dp.toFixed(5)}       ${OFFICIAL.dp.toFixed(5)}     ${((dp / OFFICIAL.dp - 1) * 100).toFixed(2)}%     ${ORACLE[32].dp.toFixed(5)}`,
          ]
        );
        const figure = await driver.page.$("#lattice-evidence");
        await figure!.screenshot({ path: "docs/assets/fluid-gate3-dfg.png" });
        await driver.evaluate(() =>
          document.getElementById("lattice-evidence")?.remove()
        );
      }
      // The same scheme as GPT's oracle, so the same answers, to well within
      // the difference between their wall treatments.
      expect(Math.abs(CD / ORACLE[D].CD - 1)).toBeLessThan(0.002);
      expect(Math.abs(dp / ORACLE[D].dp - 1)).toBeLessThan(0.002);
      expect(Math.abs(CL / ORACLE[D].CL - 1)).toBeLessThan(0.02);
    }
    // Refinement moves every quantity toward the benchmark.
    for (const key of ["CD", "dp", "CL"] as const) {
      expect(Math.abs(results[32][key] - OFFICIAL[key])).toBeLessThan(
        Math.abs(results[16][key] - OFFICIAL[key])
      );
    }
    expect(Math.abs(results[32].CD / OFFICIAL.CD - 1)).toBeLessThan(0.016);
    await driver.disablePlugin("vector-tools");
  },
  900000
);
