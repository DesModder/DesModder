import { IRExpression } from "parsing/parsenode";
import { getDefinition, getDependencies } from "./builtins";
import emitChunkGL from "./emitChunkGL";
import { colorVec4, getGLType } from "./outputHelpers";

function accDeps(depsAcc: string[], dep: string) {
  if (depsAcc.includes(dep)) return;
  getDependencies(dep).forEach((d) => accDeps(depsAcc, d));
  depsAcc.push(dep);
}

export function compileGLesmos(
  concreteTree: IRExpression,
  color: string,
  fillOpacity: number
) {
  const { source, deps } = emitChunkGL(concreteTree._chunk);
  let type = getGLType(concreteTree.valueType);
  let functionDeps: string[] = [];
  deps.forEach((d) => accDeps(functionDeps, d));
  return [
    functionDeps.map(getDefinition).join("\n"),
    `${type} f(float x, float y) {\n${source}\n}`,
    "",
    "vec4 outColor = vec4(0.0);",
    "void glesmosMain(vec2 coords) {",
    "  float x = coords.x; float y = coords.y;",
    "  if (f(x,y) > 0.0) {",
    `    outColor = ${colorVec4(color, fillOpacity)};`,
    "  }",
    "}",
  ].join("\n");
}
