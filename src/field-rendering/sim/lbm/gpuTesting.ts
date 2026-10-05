/**
 * Drives the shipped GPU lattice from an integration test: the page creates
 * it through the Vector Tools fluid session, runs it, and hands back plain
 * arrays for the test to compare with the CPU reference.
 */

import type { Driver } from "#tests";
import type { Boundaries, InletLayer } from "./boundaries";

declare let DSM: Window["DSM"];

export interface GpuRun {
  populations: number[];
  deltaRho: number[];
  ux: number[];
  uy: number[];
  cellForce: number[];
  cellBody: number[];
}

/** Boundaries, solids, inlet and sponge, as plain data the page can take. */
export interface GpuSetup {
  boundaries?: Boundaries;
  solid?: number[];
  inlet?: { ux: number[]; uy: number[] };
  sponge?: { width: number; max: number; reference: [number, number] };
  /** Link fractions, `i·N + k`, from `computeLinks`. */
  links?: number[];
  /** The Smagorinsky constant; 0 or absent for plain BGK. */
  smagorinsky?: number;
  /** A force density per cell, `2k` and `2k + 1`. */
  forceField?: number[];
  /** What the force field is multiplied by; 1 if absent. */
  forceScale?: number;
  /** Partially saturated cells: coverage, velocity (`2k`), body. */
  psm?: { coverage: number[]; velocity: number[]; body: number[] };
  /** `CpuD2Q9.inletLayer`. */
  inletLayer?: InletLayer;
  /** A change of lattice speed, made once the populations are set. */
  rescale?: { scale: number; tau: number };
}

export async function runOnGpu(
  driver: Driver,
  options: { nx: number; ny: number; tau: number; force?: [number, number] },
  populations: Float32Array | Float64Array,
  checkpoints: number[],
  setup: GpuSetup = {}
): Promise<GpuRun[]> {
  return await driver.evaluate(
    (
      options,
      populations: number[],
      checkpoints: number[],
      setup: GpuSetup
    ) => {
      const plugin = DSM.enabledPlugins["vector-tools"] as any;
      const { lattice, release } = plugin.fluid.createLattice(options);
      try {
        if (setup.boundaries) lattice.setBoundaries(setup.boundaries);
        if (setup.solid) lattice.setSolid(Uint8Array.from(setup.solid));
        if (setup.inlet) lattice.setInlet(setup.inlet.ux, setup.inlet.uy);
        if (setup.sponge) lattice.setSponge(setup.sponge);
        if (setup.links) lattice.setLinks(Float32Array.from(setup.links));
        lattice.smagorinsky = setup.smagorinsky ?? 0;
        if (setup.forceField) lattice.setForceField(setup.forceField);
        lattice.forceScale = setup.forceScale ?? 1;
        if (setup.psm) lattice.setPartialSolids(setup.psm);
        lattice.inletLayer = setup.inletLayer;
        lattice.setPopulations(new Float32Array(populations));
        if (setup.rescale)
          lattice.rescale(setup.rescale.scale, setup.rescale.tau);
        const out = [];
        for (const at of checkpoints) {
          lattice.step(at - lattice.steps);
          const read = lattice.read();
          const forces = lattice.readForces();
          out.push({
            populations: Array.from(read.populations as Float32Array),
            deltaRho: Array.from(read.deltaRho as Float32Array),
            ux: Array.from(read.ux as Float32Array),
            uy: Array.from(read.uy as Float32Array),
            cellForce: Array.from(forces.cellForce as Float32Array),
            cellBody: Array.from(forces.cellBody as Uint8Array),
          });
        }
        return out;
      } finally {
        release();
      }
    },
    options,
    Array.from(populations),
    checkpoints,
    setup
  );
}

export interface SteadyRun {
  /** Each body's exchanged momentum summed per sample, without the rest share. */
  samples: { step: number; forces: Record<number, [number, number]> }[];
  final: { deltaRho: number[]; ux: number[]; uy: number[] };
}

/**
 * Runs a lattice from rest toward steady state, easing the inlet in over
 * `rampSteps` with a smooth cubic, and sums each body's exchanged momentum
 * every `sampleEvery` steps. Stops after `maxSteps`, or once the first body's
 * x force has changed by less than `tolerance` (relative) over `window`
 * samples.
 */
export async function runToSteady(
  driver: Driver,
  options: { nx: number; ny: number; tau: number },
  populations: Float32Array,
  setup: GpuSetup,
  plan: {
    rampSteps: number;
    sampleEvery: number;
    maxSteps: number;
    tolerance: number;
    window: number;
  }
): Promise<SteadyRun> {
  return await driver.evaluate(
    (options, populations: number[], setup: GpuSetup, plan) => {
      const plugin = DSM.enabledPlugins["vector-tools"] as any;
      const { lattice, release } = plugin.fluid.createLattice(options);
      try {
        if (setup.boundaries) lattice.setBoundaries(setup.boundaries);
        if (setup.solid) lattice.setSolid(Uint8Array.from(setup.solid));
        if (setup.inlet) lattice.setInlet(setup.inlet.ux, setup.inlet.uy);
        if (setup.links) lattice.setLinks(Float32Array.from(setup.links));
        lattice.setPopulations(new Float32Array(populations));
        const samples: {
          step: number;
          forces: Record<number, [number, number]>;
        }[] = [];
        while (lattice.steps < plan.maxSteps) {
          for (let n = 0; n < plan.sampleEvery; n++) {
            const t = Math.min(1, lattice.steps / plan.rampSteps);
            lattice.inletScale = t * t * (3 - 2 * t);
            lattice.step(1);
          }
          const { cellForce, cellBody } = lattice.readForces();
          const forces: Record<number, [number, number]> = {};
          for (let k = 0; k < cellBody.length; k++) {
            const body = cellBody[k];
            if (!body) continue;
            forces[body] ??= [0, 0];
            forces[body][0] += cellForce[2 * k];
            forces[body][1] += cellForce[2 * k + 1];
          }
          samples.push({ step: lattice.steps, forces });
          if (lattice.steps > plan.rampSteps && samples.length > plan.window) {
            const first = Number(Object.keys(forces)[0]);
            const [now] = forces[first];
            const [then] =
              samples[samples.length - 1 - plan.window].forces[first];
            if (Math.abs(now - then) <= plan.tolerance * Math.abs(now)) break;
          }
        }
        const read = lattice.read();
        return {
          samples,
          final: {
            deltaRho: Array.from(read.deltaRho as Float32Array),
            ux: Array.from(read.ux as Float32Array),
            uy: Array.from(read.uy as Float32Array),
          },
        };
      } finally {
        release();
      }
    },
    options,
    Array.from(populations),
    setup,
    plan
  );
}

export interface SeriesRun {
  /** One body's exchanged momentum, sampled; rest share not included. */
  samples: { step: number; fx: number; fy: number }[];
  final: { deltaRho: number[]; ux: number[]; uy: number[] };
}

/**
 * Runs a lattice from rest for `steps`, easing the inlet in over `rampSteps`,
 * and samples `body`'s force every `sampleEvery` steps from the cells inside
 * `region`.
 */
export async function runSeries(
  driver: Driver,
  options: { nx: number; ny: number; tau: number },
  populations: Float32Array,
  setup: GpuSetup,
  plan: {
    steps: number;
    rampSteps: number;
    sampleEvery: number;
    body: number;
    region: [number, number, number, number];
  }
): Promise<SeriesRun> {
  return await driver.evaluate(
    (options, populations: number[], setup, plan) => {
      const plugin = DSM.enabledPlugins["vector-tools"] as any;
      const { lattice, release } = plugin.fluid.createLattice(options);
      try {
        if (setup.boundaries) lattice.setBoundaries(setup.boundaries);
        if (setup.solid) lattice.setSolid(Uint8Array.from(setup.solid));
        if (setup.inlet) lattice.setInlet(setup.inlet.ux, setup.inlet.uy);
        if (setup.links) lattice.setLinks(Float32Array.from(setup.links));
        if (setup.sponge) lattice.setSponge(setup.sponge);
        lattice.smagorinsky = setup.smagorinsky ?? 0;
        lattice.setPopulations(new Float32Array(populations));
        const samples: { step: number; fx: number; fy: number }[] = [];
        while (lattice.steps < plan.steps) {
          for (let n = 0; n < plan.sampleEvery; n++) {
            const t = Math.min(1, lattice.steps / plan.rampSteps);
            lattice.inletScale = t * t * (3 - 2 * t);
            lattice.step(1);
          }
          const sums = lattice.sumForces(...plan.region);
          const force = sums.get(plan.body) ?? [0, 0];
          samples.push({ step: lattice.steps, fx: force[0], fy: force[1] });
        }
        const read = lattice.read();
        return {
          samples,
          final: {
            deltaRho: Array.from(read.deltaRho as Float32Array),
            ux: Array.from(read.ux as Float32Array),
            uy: Array.from(read.uy as Float32Array),
          },
        };
      } finally {
        release();
      }
    },
    options,
    Array.from(populations),
    setup,
    plan
  );
}
