/**
 * The DFG flow-around-a-cylinder benchmarks (Schäfer and Turek 1996), set up
 * on the lattice exactly as Desmos users would write them.
 *
 * A cylinder of diameter 0.1 centred at (0.2, 0.2) sits in a 2.2 × 0.41
 * channel with a parabolic inflow. 2D-1 runs at Re 20 with mean speed 0.2 and
 * is steady. 2D-2 runs at Re 100 with mean speed 1 and sheds vortices. The
 * cylinder and the channel's two walls are Desmos inequalities, compiled by
 * the strict compiler, rasterized, and given interpolated links, so a
 * benchmark run tests the whole path from the expression list to the wall.
 *
 * Lattice mean speed is 0.04, as in GPT's oracle runs, so their results
 * compare directly. The reference values are the official ones published by
 * the FEATFLOW group, as pinned in GPT's second reply.
 */

import { EMPTY_ENVIRONMENT } from "../../latexToGLSL";
import { compileObstacle, type CompiledObstacle } from "../obstacles";
import type { Boundaries } from "./boundaries";
import { computeLinks, type LinkGrid } from "./links";

export const DFG_REFERENCE = {
  /** 2D-1, steady. */
  steady: { CD: 5.57953523384, CL: 0.010618948146, dp: 0.11752016697 },
  /**
   * 2D-2, the official finest series' last cycle (GPT's extraction): drag
   * extremes, lift peak-to-peak and Strouhal number.
   */
  shedding: {
    CDmin: 3.164263,
    CDmax: 3.227393,
    CLpeakToPeak: 2.007871,
    St: 0.301841,
  },
} as const;

export interface DfgSetup {
  D: number;
  dx: number;
  nx: number;
  ny: number;
  uMean: number;
  reynolds: number;
  tau: number;
  grid: LinkGrid;
  /** Body 1 is the cylinder; 2 and 3 are the channel's walls. */
  solid: Uint8Array;
  links: Float32Array;
  fallbacks: number;
  inletUx: number[];
  boundaries: Boundaries;
  /** Cells around the cylinder, `[x, y, width, height]`, for force sums. */
  cylinderRegion: [number, number, number, number];
  /** The pair of rows straddling y = 0.2, and the columns at x = 0.15, 0.25. */
  pressureProbe: { rows: [number, number]; front: number; back: number };
  /** Physical pressure per unit of δρ: c_s² (U_physical / U_lattice)². */
  pressureScale: number;
}

const LATEX = [
  String.raw`\left(x-0.2\right)^{2}+\left(y-0.2\right)^{2}\le0.0025`,
  String.raw`y\le0`,
  String.raw`y\ge0.41`,
];

function compile(latex: string): CompiledObstacle {
  const result = compileObstacle(latex, EMPTY_ENVIRONMENT, {
    degreeMode: false,
  });
  if (!result.ok) throw new Error(`${latex}: ${result.error}`);
  return result.obstacle;
}

/**
 * The channel at `D` cells across the cylinder, for Re 20 (2D-1) or Re 100
 * (2D-2). Cell centres sit at x = i·dx and y = (j − ½)·dx, so none lies on a
 * wall: the walls at y = 0 and 0.41 are solids with interpolated links, like
 * the cylinder, rather than the grid's edge.
 */
export function dfgChannel(D: number, reynolds: 20 | 100): DfgSetup {
  const dx = 0.1 / D;
  const nx = Math.round(2.2 / dx) + 1;
  const ny = Math.ceil(0.41 / dx) + 2;
  const uMean = 0.04;
  const grid: LinkGrid = { nx, ny, centre: (i, j) => [i * dx, (j - 0.5) * dx] };
  const obstacles = LATEX.map(compile);
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
  const H = 0.41;
  const inletUx = Array.from({ length: ny }, (_, j) => {
    const y = (j - 0.5) * dx;
    return y <= 0 || y >= H ? 0 : (4 * 1.5 * uMean * y * (H - y)) / (H * H);
  });
  const margin = Math.ceil(D / 2) + 3;
  const centreI = Math.round(0.2 / dx);
  const centreJ = Math.round(0.2 / dx + 0.5);
  const row = Math.floor(0.2 / dx + 0.5);
  const physicalMean = reynolds === 20 ? 0.2 : 1;
  return {
    D,
    dx,
    nx,
    ny,
    uMean,
    reynolds,
    tau: 0.5 + (3 * uMean * D) / reynolds,
    grid,
    solid,
    links: links.q,
    fallbacks: links.fallbacks,
    inletUx,
    boundaries: {
      left: { kind: "velocity", regularize: true },
      right: { kind: "pressure", deltaRho: 0, regularize: true },
      bottom: { kind: "noSlip" },
      top: { kind: "noSlip" },
    },
    cylinderRegion: [
      centreI - margin,
      centreJ - margin,
      2 * margin,
      2 * margin,
    ],
    pressureProbe: {
      rows: [row, row + 1],
      front: Math.round(0.15 / dx),
      back: Math.round(0.25 / dx),
    },
    pressureScale: (1 / 3) * (physicalMean / uMean) ** 2,
  };
}
