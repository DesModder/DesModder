import { getDefinition, getDependencies } from "./builtins";
import emitChunkGL from "./emitChunkGL";
import { colorVec4, getGLType } from "./outputHelpers";
import { desmosRequire } from "globals/workerSelf";
import { IRExpression, ParsenodeError } from "parsing/parsenode";
import { GLesmosShaderPackage } from "./glesmosCanvas";

const PError = desmosRequire("core/math/parsenode/error") as (
  msg: string
) => ParsenodeError;

function preprocParam(input: number, min: number, max: number, def: number){
  if ( isNaN(input) ) return def;
  return Math.min( Math.max( input, min ), max );
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
  lineWidth: number
  ): GLesmosShaderPackage {
  try {

    fillOpacity = preprocParam(fillOpacity, 0, 1, 0.4);
    lineOpacity = preprocParam(fillOpacity, 0, 1, 0.9);
    lineWidth   = preprocParam(fillOpacity, 0, Infinity, 2.5);

    const { source, deps } = emitChunkGL(concreteTree._chunk);
    const type = getGLType(concreteTree.valueType);

    const functionDeps: string[] = [];
    deps.forEach((d) => accDeps(functionDeps, d));

    return {
      deps:   functionDeps.map(getDefinition),
      defs:   [`${type} _f0(float x, float y) {\n    ${source}\n}`],
      colors: [`${colorVec4(color, fillOpacity)}`],
      line_colors: [`${colorVec4(color, lineOpacity)}`],
      line_widths: [`${lineWidth}`]
    };

  } catch (msg) {
    throw PError(`[GLesmos Error] ${msg}`);
  }
}
