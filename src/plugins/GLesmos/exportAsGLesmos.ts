import { satisfiesType } from "parsing/nodeTypes";
import { getDefinition, getDependencies } from "./builtins";
import computeContext, {
  Analysis,
  ComputedContext,
  Statement,
} from "./computeContext";
import emitChunkGL from "./emitChunkGL";
import { colorVec4, getGLType } from "./outputHelpers";

function accDeps(depsAcc: string[], dep: string) {
  if (depsAcc.includes(dep)) return;
  getDependencies(dep).forEach((d) => accDeps(depsAcc, d));
  depsAcc.push(dep);
}

export default function exportAsGLesmos(context: ComputedContext, id: string) {
  let functionDeps: string[] = [];
  const { mainSource, deps } = implicitToGL(
    context.statements[id],
    context.analysis[id]
  );
  deps.forEach((d) => accDeps(functionDeps, d));

  return [functionDeps.map(getDefinition).join("\n"), mainSource].join("\n");
}

function implicitToGL(statement: Statement, analysis: Analysis) {
  // assumes statement is an implicit
  // currently just ignores line/border
  const userData = statement.userData;
  const metaData = statement.metaData;
  if (
    userData.type !== "expression" ||
    !satisfiesType(statement, "BaseComparator")
  ) {
    throw "Expected implicit";
  }
  if (analysis.concreteTree.type !== "IRExpression") {
    throw "Expected IRExpression";
  }
  const color = metaData.colorLatexValue ?? userData.color ?? "#00FF00";
  // metaData.computedFillOpacity could be a number, number[], NaN, or undefined
  let fillOpacity = metaData.computedFillOpacity ?? NaN;
  if (Array.isArray(color) || Array.isArray(fillOpacity)) {
    throw "Lists of implicits not yet implemented";
  }
  fillOpacity = isNaN(fillOpacity) ? 0.4 : fillOpacity;
  const { source, deps } = emitChunkGL(analysis.concreteTree._chunk);
  let type = getGLType(analysis.concreteTree.valueType);
  return {
    mainSource: [
      `${type} f(float x, float y) {\n${source}\n}`,
      "",
      "vec4 outColor = vec4(0.0);",
      "void glesmosMain(vec2 coords) {",
      "  float x = coords.x; float y = coords.y;",
      "  if (f(x,y) > 0.0) {",
      `    outColor = ${colorVec4(color, fillOpacity)};`,
      "  }",
      "}",
    ].join("\n"),
    deps,
  };
}
