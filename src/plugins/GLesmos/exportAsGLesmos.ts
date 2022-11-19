import { getDefinition, getDependencies } from "./builtins";
import emitChunkGL from "./emitChunkGL";
import { colorVec4, getGLType } from "./outputHelpers";
import { desmosRequire } from "globals/workerSelf";
import { IRExpression, ParsenodeError } from "parsing/parsenode";

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
  id: number
) {
  try {
    if (isNaN(fillOpacity)) fillOpacity = 0.4;
    else if (fillOpacity > 1) fillOpacity = 1;
    else if (fillOpacity < 0) fillOpacity = 0;
    const { source, deps } = emitChunkGL(concreteTree._chunk);
    const type = getGLType(concreteTree.valueType);
    const functionDeps: string[] = [];
    deps.forEach((d) => accDeps(functionDeps, d));
    const f = "_f" + id.toString();
    return {
      deps: functionDeps.map(getDefinition),
      defs: [`${type} ${f}(float x, float y) {\n${source}\n}`],
      bodies: [
        `if (${f}(x,y) > 0.0) {` +
          `  outColor = mixColor(outColor, ${colorVec4(color, fillOpacity)});` +
          `}`,
      ],
    };
  } catch (msg) {
    throw PError(`[GLesmos Error] ${msg}`);
  }
}
