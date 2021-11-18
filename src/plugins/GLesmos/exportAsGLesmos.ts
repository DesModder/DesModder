import { IRExpression } from "parsing/parsenode";
import { getDefinition, getDependencies } from "./builtins";
import emitChunkGL from "./emitChunkGL";
import { colorVec4, getGLType } from "./outputHelpers";
import { Error as ParsenodeError } from "parsing/parsenode";
import { desmosRequire } from "globals/workerSelf";
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
    if (isNaN(fillOpacity)) {
      fillOpacity = 0.4;
    }
    const { source, deps } = emitChunkGL(concreteTree._chunk);
    let type = getGLType(concreteTree.valueType);
    let functionDeps: string[] = [];
    deps.forEach((d) => accDeps(functionDeps, d));
    const f = "_f" + id;
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
