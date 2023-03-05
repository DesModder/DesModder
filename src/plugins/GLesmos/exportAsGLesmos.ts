import { getDefinition, getDependencies } from "./builtins";
import emitChunkGL from "./emitChunkGL";
import { colorVec4 } from "./outputHelpers";
import { GLesmosShaderPackage } from "./shaders";
import { ParsenodeError } from "./workerDeps";
import { IRExpression } from "parsing/parsenode";

function clampParam(input: number, min: number, max: number, def: number) {
  if (isNaN(input)) return def;
  return Math.min(Math.max(input, min), max);
}

export function accDeps(depsAcc: string[], dep: string) {
  if (depsAcc.includes(dep)) return;
  getDependencies(dep).forEach((d) => accDeps(depsAcc, d));
  depsAcc.push(dep);
}

export function compileGLesmos(
  concreteTree: IRExpression,
  color: string,
  fillOpacity: number,
  lineOpacity: number,
  lineWidth: number,
  derivativeX: undefined | IRExpression,
  derivativeY: undefined | IRExpression
): GLesmosShaderPackage {
  try {
    fillOpacity = clampParam(fillOpacity, 0, 1, 0.4);
    lineOpacity = clampParam(lineOpacity, 0, 1, 0.9);
    lineWidth = clampParam(lineWidth, 0, Infinity, 2.5);

    const functionDeps: string[] = [];

    let { source, deps } = emitChunkGL(concreteTree._chunk);
    deps.forEach((d) => accDeps(functionDeps, d));

    // default values for if there should be no dx, dy
    let dxsource = "return 0.0;";
    let dysource = "return 0.0;";
    let hasOutlines = false;
    if (lineWidth > 0 && lineOpacity > 0 && derivativeX && derivativeY) {
      ({ source: dxsource, deps } = emitChunkGL(derivativeX._chunk));
      deps.forEach((d) => accDeps(functionDeps, d));
      ({ source: dysource, deps } = emitChunkGL(derivativeY._chunk));
      deps.forEach((d) => accDeps(functionDeps, d));
      hasOutlines = true;
    }
    return {
      hasOutlines,
      deps: functionDeps.map(getDefinition),
      chunks: [
        {
          main: source,
          dx: dxsource,
          dy: dysource,
          fill: fillOpacity > 0,
          color: `${colorVec4(color, fillOpacity)}`,
          line_color: `${colorVec4(color, lineOpacity)}`,
          line_width: lineWidth,
        },
      ],
    };
  } catch (msg) {
    throw new ParsenodeError(`[GLesmos Error] ${msg}`);
  }
}
