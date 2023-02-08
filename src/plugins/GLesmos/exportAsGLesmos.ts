import { getDefinition, getDependencies } from "./builtins";
import emitChunkGL from "./emitChunkGL";
import { colorVec4, getGLType } from "./outputHelpers";
import { GLesmosShaderPackage } from "./shaders";
import { desmosRequire } from "globals/workerSelf";
import { IRExpression, ParsenodeError } from "parsing/parsenode";

const PError = desmosRequire("core/math/parsenode/error") as (
  msg: string
) => ParsenodeError;

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

    let source, dxsource, dysource, deps;
    ({ source, deps } = emitChunkGL(concreteTree._chunk));
    deps.forEach((d) => accDeps(functionDeps, d));
    const type = getGLType(concreteTree.valueType);

    if (lineWidth > 0 && derivativeX && derivativeY) {
      ({ source: dxsource, deps } = emitChunkGL(derivativeX._chunk));
      deps.forEach((d) => accDeps(functionDeps, d));
      ({ source: dysource, deps } = emitChunkGL(derivativeY._chunk));
      deps.forEach((d) => accDeps(functionDeps, d));
    }
  
    return {
      deps: functionDeps.map(getDefinition),
      chunks: [
        {
          main: `${type} glesmos_xy(float x, float y) {\n${source}\n}`,
          dx: `${type} glesmos_dx(float x, float y) {\n${dxsource}\n}`,
          dy: `${type} glesmos_dy(float x, float y) {\n${dysource}\n}`,
          fill: fillOpacity > 0,
          color: `${colorVec4(color, fillOpacity)}`,
          line_color: `${colorVec4(color, lineOpacity)}`,
          line_width: lineWidth,
        },
      ],
    };
  } catch (msg) {
    throw PError(`[GLesmos Error] ${msg}`);
  }
}
