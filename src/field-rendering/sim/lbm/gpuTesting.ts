/**
 * Drives the shipped GPU lattice from an integration test: the page creates
 * it through the Vector Tools fluid session, runs it, and hands back plain
 * arrays for the test to compare with the CPU reference.
 */

import type { Driver } from "#tests";
import type { Boundaries } from "./boundaries";

declare let DSM: Window["DSM"];

export interface GpuRun {
  populations: number[];
  deltaRho: number[];
  ux: number[];
  uy: number[];
  error?: string;
}

/** Boundaries, solids, inlet and sponge, as plain data the page can take. */
export interface GpuSetup {
  boundaries?: Boundaries;
  solid?: number[];
  inlet?: { ux: number[]; uy: number[] };
  sponge?: { width: number; max: number; reference: [number, number] };
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
    checkpoints,
    setup
  );
}
