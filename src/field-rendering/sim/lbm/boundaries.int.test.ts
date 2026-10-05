import { testWithPage } from "#tests";
import { CpuD2Q9 } from "./d2q9";
import type { Boundaries } from "./boundaries";
import { runOnGpu } from "./gpuTesting";

/**
 * Gate 2 on the GPU: the tank's edges and solids, against the CPU reference
 * step for step, and against Poiseuille's exact profile at steady state.
 */

/** The worst amount by which any value exceeds `absolute + relative·|expected|`. */
function worstExcess(
  actual: ArrayLike<number>,
  expected: ArrayLike<number>,
  absolute: number,
  relative: number
) {
  let worst = -Infinity;
  for (let k = 0; k < expected.length; k++) {
    worst = Math.max(
      worst,
      Math.abs(actual[k] - expected[k]) -
        (absolute + relative * Math.abs(expected[k]))
    );
  }
  return worst;
}

/**
 * Two scenes that between them use every boundary path: a wind-tunnel
 * channel with a regularized velocity inlet and pressure outlet, a still floor
 * and a moving lid, a solid block, a body force and the sponge; and a
 * slip-walled periodic channel around the same block.
 */
const SCENES: {
  name: string;
  nx: number;
  ny: number;
  tau: number;
  force: [number, number];
  boundaries: Boundaries;
  inlet: boolean;
  sponge: boolean;
}[] = [
  {
    name: "wind tunnel",
    nx: 48,
    ny: 20,
    tau: 0.56,
    force: [0, -1e-6],
    boundaries: {
      left: { kind: "velocity", regularize: true },
      right: { kind: "pressure", deltaRho: 0, regularize: true },
      bottom: { kind: "noSlip" },
      top: { kind: "noSlip", wallVelocity: [0.01, 0] },
    },
    inlet: true,
    sponge: true,
  },
  {
    // The wind tunnel the tab runs: open sides meeting slip walls.
    name: "slip tunnel",
    nx: 48,
    ny: 20,
    tau: 0.56,
    force: [0, 0],
    boundaries: {
      left: { kind: "velocity", regularize: true },
      right: { kind: "pressure", deltaRho: 0, regularize: true },
      bottom: { kind: "slip" },
      top: { kind: "slip" },
    },
    inlet: true,
    sponge: true,
  },
  {
    name: "slip channel",
    nx: 40,
    ny: 16,
    tau: 0.7,
    force: [2e-6, 0],
    boundaries: {
      left: { kind: "periodic" },
      right: { kind: "periodic" },
      bottom: { kind: "slip" },
      top: { kind: "slip" },
    },
    inlet: false,
    sponge: false,
  },
];

testWithPage(
  "Fluid gate 2: walls, open sides, solids and the sponge step as on the CPU",
  async (driver) => {
    await driver.enablePlugin("vector-tools");
    for (const scene of SCENES) {
      const { nx, ny } = scene;
      const solid = new Uint8Array(nx * ny);
      for (let y = 6; y < 11; y++)
        for (let x = 12; x < 16; x++) solid[y * nx + x] = 1;
      const inletUx = Array.from({ length: ny }, (_, y) =>
        scene.inlet ? 0.04 * Math.sin((Math.PI * (y + 0.5)) / ny) : 0
      );
      const sponge = scene.sponge
        ? { width: 12, max: 0.12, reference: [0.03, 0] as [number, number] }
        : undefined;
      const cpu = new CpuD2Q9({ ...scene, arithmetic: "float32" });
      cpu.setBoundaries(scene.boundaries);
      cpu.solid = solid;
      cpu.inlet = { ux: Float64Array.from(inletUx), uy: new Float64Array(ny) };
      cpu.sponge = sponge;
      cpu.initialize((x, y) => ({ ux: solid[y * nx + x] ? 0 : 0.03, uy: 0 }));
      const [one, hundred] = await runOnGpu(
        driver,
        { nx, ny, tau: scene.tau, force: scene.force },
        Float32Array.from(cpu.populations),
        [1, 100],
        {
          boundaries: scene.boundaries,
          solid: Array.from(solid),
          inlet: { ux: inletUx, uy: new Array<number>(ny).fill(0) },
          sponge,
        }
      );
      cpu.step(1);
      // 1e-8 rather than gate 1's 1e-9: a regularized open side does several
      // times the arithmetic of a bulk cell, and on the Intel GPU its results
      // differ from the CPU's by up to 5.6e-9 after one step, one rounding of
      // its intermediates. The hundred-step band below is unchanged.
      const oneStep = worstExcess(one.populations, cpu.populations, 1e-8, 1e-6);
      cpu.step(99);
      const hundredSteps = worstExcess(
        hundred.populations,
        cpu.populations,
        2e-7,
        0
      );
      const velocity = worstExcess(hundred.ux, cpu.ux, 2e-6, 0);
      expect({
        scene: scene.name,
        oneStep: oneStep <= 0,
        hundredSteps: hundredSteps <= 0,
        velocity: velocity <= 0,
      }).toEqual({
        scene: scene.name,
        oneStep: true,
        hundredSteps: true,
        velocity: true,
      });
    }
    await driver.disablePlugin("vector-tools");
  },
  120000
);

testWithPage(
  "Fluid gate 2: the GPU channel develops Poiseuille's parabola and conserves flux",
  async (driver) => {
    await driver.enablePlugin("vector-tools");
    const nx = 96;
    const ny = 24;
    const umax = 0.04;
    const parabola = (y: number) =>
      (4 * umax * (y + 0.5) * (ny - 0.5 - y)) / (ny * ny);
    const boundaries: Boundaries = {
      left: { kind: "velocity", regularize: true },
      right: { kind: "pressure", deltaRho: 0, regularize: true },
      bottom: { kind: "noSlip" },
      top: { kind: "noSlip" },
    };
    // From rest, so the profile has to develop rather than be handed over.
    const start = new CpuD2Q9({ nx, ny, tau: 0.8 });
    start.initialize(() => ({ ux: 0, uy: 0 }));
    const [steady] = await runOnGpu(
      driver,
      { nx, ny, tau: 0.8 },
      Float32Array.from(start.populations),
      [12000],
      {
        boundaries,
        inlet: {
          ux: Array.from({ length: ny }, (_, y) => parabola(y)),
          uy: new Array<number>(ny).fill(0),
        },
      }
    );
    const flux = (x: number) => {
      let sum = 0;
      for (let y = 0; y < ny; y++) {
        const k = y * nx + x;
        sum += (1 + steady.deltaRho[k]) * steady.ux[k];
      }
      return sum;
    };
    // Interior sections: the outlet's last two columns are a boundary layer
    // of its reconstruction, not a flux measurement (see the unit test).
    const inlet = flux(0);
    const fluxError = Math.max(
      ...[nx / 4, nx / 2, (3 * nx) / 4].map(
        (x) => Math.abs(flux(x) - inlet) / inlet
      )
    );
    expect(fluxError).toBeLessThan(1e-3);
    const measured = Array.from(
      { length: ny },
      (_, y) => steady.ux[y * nx + nx / 2]
    );
    const worst = Math.max(
      ...measured.map((u, y) => Math.abs(u - parabola(y)) / umax)
    );
    expect(worst).toBeLessThan(0.01);

    // Evidence: the measured profile against the parabola, with the errors.
    await driver.evaluate(
      (
        measured: number[],
        ny: number,
        umax: number,
        worst: number,
        fluxError: number
      ) => {
        const figure = document.createElement("div");
        figure.id = "lattice-evidence";
        figure.style.cssText =
          "position:fixed;left:0;top:0;z-index:99999;background:#fff;padding:12px;font:14px sans-serif;width:420px";
        const canvas = document.createElement("canvas");
        canvas.width = 420;
        canvas.height = 300;
        const ctx = canvas.getContext("2d")!;
        const px = (u: number) => 40 + (u / umax) * 340;
        const py = (y: number) => 280 - ((y + 0.5) / ny) * 260;
        ctx.strokeStyle = "#999";
        ctx.beginPath();
        ctx.moveTo(40, 20);
        ctx.lineTo(40, 280);
        ctx.lineTo(400, 280);
        ctx.stroke();
        ctx.strokeStyle = "#2d70b3";
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let s = 0; s <= 200; s++) {
          const y = -0.5 + (s / 200) * ny;
          const u = (4 * umax * (y + 0.5) * (ny - 0.5 - y)) / (ny * ny);
          if (s === 0) ctx.moveTo(px(u), py(y));
          else ctx.lineTo(px(u), py(y));
        }
        ctx.stroke();
        ctx.fillStyle = "#c74440";
        measured.forEach((u, y) => {
          ctx.beginPath();
          ctx.arc(px(u), py(y), 3.5, 0, 2 * Math.PI);
          ctx.fill();
        });
        const caption = document.createElement("div");
        caption.textContent = `GPU channel at mid-length (red dots), developed from rest through a velocity inlet and pressure outlet, against the exact parabola (blue). Worst error ${(worst * 100).toFixed(2)}% of the peak speed; flux at interior sections agrees with the inlet within ${(fluxError * 100).toFixed(3)}%.`;
        figure.append(canvas, caption);
        document.body.append(figure);
      },
      measured,
      ny,
      umax,
      worst,
      fluxError
    );
    const figure = await driver.page.$("#lattice-evidence");
    await figure!.screenshot({
      path: "docs/assets/fluid-gate2-poiseuille.png",
    });
    await driver.evaluate(() =>
      document.getElementById("lattice-evidence")?.remove()
    );
    await driver.disablePlugin("vector-tools");
  },
  120000
);

/**
 * The absorbing inlet (`absorbingInflow`) on the GPU as on the CPU: a sound
 * pulse sent at it, stepped past its arrival, with each row's mean carried
 * from step to step in the force target.
 */
testWithPage(
  "Fluid: the GPU's absorbing inlet steps as the CPU's does",
  async (driver) => {
    await driver.enablePlugin("vector-tools");
    const nx = 120;
    const ny = 8;
    const u = 0.05;
    const c = 1 / Math.sqrt(3);
    const options = { nx, ny, tau: 0.55 };
    const boundaries: Boundaries = {
      left: { kind: "velocity", regularize: true },
      right: { kind: "pressure", deltaRho: 0, regularize: true },
      bottom: { kind: "slip" },
      top: { kind: "slip" },
    };
    const inlet = {
      ux: Array.from({ length: ny }, () => u),
      uy: Array.from({ length: ny }, () => 0),
    };
    const cpu = new CpuD2Q9({ ...options, arithmetic: "float32" });
    cpu.setBoundaries(boundaries);
    cpu.inlet = { ux: Float64Array.from(inlet.ux), uy: new Float64Array(ny) };
    cpu.absorbingInlet = 1 / 2000;
    cpu.initialize((x) => {
      const pulse = 1e-3 * Math.exp(-(((x - 40) / 8) ** 2));
      return { deltaRho: pulse, ux: u - c * pulse, uy: 0 };
    });
    const [one, later] = await runOnGpu(
      driver,
      options,
      Float32Array.from(cpu.populations),
      [1, 100],
      { boundaries, inlet, absorbingInlet: 1 / 2000 }
    );
    const worst = (a: ArrayLike<number>, b: ArrayLike<number>) => {
      let w = 0;
      for (let k = 0; k < b.length; k++) w = Math.max(w, Math.abs(a[k] - b[k]));
      return w;
    };
    cpu.step(1);
    expect(worst(one.populations, cpu.populations)).toBeLessThan(1e-8);
    cpu.step(99);
    // Looser than the other boundaries' 2e-7: the inlet feeds each step's
    // density back into its velocity, which carries float32 rounding on
    // while the pulse is leaving (measured 3.5e-7).
    expect(worst(later.populations, cpu.populations)).toBeLessThan(5e-7);
    await driver.disablePlugin("vector-tools");
  },
  90000
);
