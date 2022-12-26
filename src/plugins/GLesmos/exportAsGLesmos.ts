import { getDefinition, getDependencies } from "./builtins";
import emitChunkGL from "./emitChunkGL";
import { colorVec4, getGLType } from "./outputHelpers";
import { desmosRequire } from "globals/workerSelf";
import { IRExpression, ParsenodeError } from "parsing/parsenode";
import { GLesmosShaderPackage } from "./glesmosCanvas";

const PError = desmosRequire("core/math/parsenode/error") as (
  msg: string
) => ParsenodeError;

export function accDeps(depsAcc: string[], dep: string) {
  if (depsAcc.includes(dep)) return;
  getDependencies(dep).forEach((d) => accDeps(depsAcc, d));
  depsAcc.push(dep);
}

export function compileGLesmos(
  concreteTree: IRExpression,
  color: string,
  fillOpacity: number,
  ): GLesmosShaderPackage {
  try {
    if (isNaN(fillOpacity)) fillOpacity = 0.4;
    else if (fillOpacity > 1) fillOpacity = 1;
    else if (fillOpacity < 0) fillOpacity = 0;

    const { source, deps } = emitChunkGL(concreteTree._chunk);
    const type = getGLType(concreteTree.valueType);

    const functionDeps: string[] = [];
    deps.forEach((d) => accDeps(functionDeps, d));

    return {
      deps:   functionDeps.map(getDefinition),
      defs:   [`${type} _f0(float x, float y) {\n    ${source}\n}`],
      colors: [`${colorVec4(color, fillOpacity)}`],
    };

  } catch (msg) {
    throw PError(`[GLesmos Error] ${msg}`);
  }
}
