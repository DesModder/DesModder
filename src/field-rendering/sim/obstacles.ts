/**
 * A Desmos inequality as a solid the fluid can see: whether a point is inside
 * it, a signed function that places its wall, and the GLSL for both.
 *
 * Inside means exactly what Desmos shades. That is the whole contract, and it
 * is why this goes through the strict compiler rather than the flow
 * visualizer's: undefined is never inside, so `y < √x` has no wall along the
 * negative x-axis, and `x² + y² ≤ 1 {x > 0}` is the right half of a disc.
 *
 * The signed function is negative inside and positive outside, and its zero is
 * the wall. Interpolated bounce-back needs it to find where a lattice link
 * crosses the wall, and a partially saturated cell needs it to estimate how
 * much of the cell is solid. It is not a distance: `x² + y² − 1` is fine,
 * because only its sign and its zero are used, plus a gradient estimated from
 * its own samples. Where it is undefined it is NaN, and the caller must treat
 * such a point as fluid with no wall to place, never guess one.
 */

import type { FieldEnvironment } from "../latexToGLSL";
import {
  compileChainWith,
  compileExpression,
  type EvaluationScope,
  type StrictOptions,
} from "./strictEvaluate";
import { emitRelationGLSL, type EmittedRelation } from "./strictGLSL";
import {
  parseStrictRelation,
  type Chain,
  type StrictProgram,
} from "./strictParse";

export interface CompiledObstacle {
  /** Whether a point is inside the region, exactly as Desmos shades it. */
  contains: (scope: EvaluationScope) => boolean;
  /** Negative inside, positive outside, NaN where undefined. */
  signed: (scope: EvaluationScope) => number;
  /** Slider names it reads, which the simulation must supply as uniforms. */
  params: readonly string[];
  /** Whether it moves with the clock, and so must be rebuilt as time passes. */
  usesTime: boolean;
  /** GLSL for the same two functions. See `emitRelationGLSL`. */
  glsl: EmittedRelation;
}

export type ObstacleResult =
  | { ok: true; obstacle: CompiledObstacle }
  | { ok: false; error: string };

export function compileObstacle(
  latex: string,
  env: FieldEnvironment,
  options: StrictOptions,
  id = "0"
): ObstacleResult {
  const parsed = parseStrictRelation(latex, env);
  if (!parsed.ok) return parsed;
  const { program } = parsed;
  const build = (expr: Parameters<typeof compileExpression>[0]) =>
    compileExpression(expr, program, options);

  const { chain, restrictions } = program.relation;
  const truths = [
    compileChainWith(chain, build),
    ...restrictions.map((any) => {
      const chains = any.map((c) => compileChainWith(c, build));
      return (s: EvaluationScope, l: readonly number[]) =>
        chains.some((holds) => holds(s, l));
    }),
  ];
  const signedParts = [
    signedChain(chain, program, options),
    ...restrictions.map((any) => signedAny(any, program, options)),
  ];

  return {
    ok: true,
    obstacle: {
      contains: (scope) => truths.every((holds) => holds(scope, NO_LOCALS)),
      signed: (scope) => {
        let result = -Infinity;
        for (const part of signedParts) {
          const value = part(scope);
          if (Number.isNaN(value)) return NaN;
          result = Math.max(result, value);
        }
        return result;
      },
      params: program.params,
      usesTime: program.usesTime,
      glsl: emitRelationGLSL(program, options, id),
    },
  };
}

const NO_LOCALS: readonly number[] = [];

/**
 * One chain's signed function: for `a < b` it is `a − b`, for `a > b` it is
 * `b − a`, so each is negative where its link holds, and the chain's is the
 * largest of its links', negative only where all of them hold. The GLSL in
 * `strictGLSL.ts` builds the same function, and a unit test holds the two to
 * each other.
 */
function signedChain(
  chain: Chain,
  program: StrictProgram,
  options: StrictOptions
): (scope: EvaluationScope) => number {
  const terms = chain.terms.map((term) =>
    compileExpression(term, program, options)
  );
  return (scope) => {
    let result = -Infinity;
    for (let i = 0; i < chain.ops.length; i++) {
      const a = terms[i](scope, NO_LOCALS);
      const b = terms[i + 1](scope, NO_LOCALS);
      const op = chain.ops[i];
      const difference = op === ">" || op === ">=" ? b - a : a - b;
      const link = op === "=" ? Math.abs(difference) : difference;
      if (Number.isNaN(link)) return NaN;
      result = Math.max(result, link);
    }
    return result;
  };
}

/** Where any chain holds: the smallest of the defined ones, NaN if none is. */
function signedAny(
  chains: Chain[],
  program: StrictProgram,
  options: StrictOptions
): (scope: EvaluationScope) => number {
  const parts = chains.map((chain) => signedChain(chain, program, options));
  return (scope) => {
    let result = NaN;
    for (const part of parts) {
      const value = part(scope);
      if (Number.isNaN(value)) continue;
      result = Number.isNaN(result) ? value : Math.min(result, value);
    }
    return result;
  };
}

/** A rectangle in graph coordinates, divided into cells. */
export interface TankGrid {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  nx: number;
  ny: number;
}

export const CellKind = {
  Fluid: 0,
  Solid: 1,
  /**
   * Fluid where some obstacle is undefined, so its wall could not be placed
   * across this cell. Reported so the panel can say so rather than hide it.
   */
  Undefined: 2,
} as const;
export type CellKind = (typeof CellKind)[keyof typeof CellKind];

export interface Rasterized {
  cells: Uint8Array;
  solidCount: number;
  undefinedCount: number;
}

/**
 * Classifies each cell centre against every obstacle. Cell (i, j) is at
 * `y·nx + x` with its centre half a cell in from the tank's corner, y up.
 */
export function rasterizeObstacles(
  obstacles: readonly CompiledObstacle[],
  grid: TankGrid,
  scope: Omit<EvaluationScope, "x" | "y">
): Rasterized {
  const { nx, ny } = grid;
  const cells = new Uint8Array(nx * ny);
  const dx = (grid.xMax - grid.xMin) / nx;
  const dy = (grid.yMax - grid.yMin) / ny;
  let solidCount = 0;
  let undefinedCount = 0;
  const point = { ...scope, x: 0, y: 0 };
  for (let j = 0; j < ny; j++) {
    point.y = grid.yMin + (j + 0.5) * dy;
    for (let i = 0; i < nx; i++) {
      point.x = grid.xMin + (i + 0.5) * dx;
      let kind: CellKind = CellKind.Fluid;
      for (const obstacle of obstacles) {
        if (obstacle.contains(point)) {
          kind = CellKind.Solid;
          break;
        }
        if (Number.isNaN(obstacle.signed(point))) kind = CellKind.Undefined;
      }
      cells[j * nx + i] = kind;
      if (kind === CellKind.Solid) solidCount++;
      else if (kind === CellKind.Undefined) undefinedCount++;
    }
  }
  return { cells, solidCount, undefinedCount };
}
