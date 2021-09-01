import { satisfiesType } from "parsing/nodeTypes";
import {
  Assignment,
  ChildExprNode,
  Comparator,
  Constant,
  FunctionDefinition,
  MaybeRational,
} from "parsing/parsenode";
import { getFunctionName } from "./builtins";
import computeContext, { ComputedContext, Statement } from "./computeContext";
import { orderDeps } from "./depOrder";

function glslFloatify(x: number) {
  return Number.isInteger(x) ? x.toString() + ".0" : x.toString();
}

function getImplicits(context: ComputedContext) {
  const implicits = [];

  for (let id in context.analysis) {
    const analysis = context.analysis[id];
    const statement = context.statements[id];
    const userData = statement.userData;
    if (
      analysis.evaluationState.is_inequality &&
      analysis.evaluationState.is_graphable &&
      analysis.rawTree.type !== "Error" &&
      satisfiesType(analysis.rawTree, "BaseComparator") &&
      userData.type === "expression" &&
      userData.shouldGraph
    ) {
      implicits.push(id);
    }
  }
  return implicits;
}

export default function exportAsGLesmos() {
  const context = computeContext();
  const implicitIDs = getImplicits(context);
  const {
    funcs: orderedFuncs,
    vars: orderedVars,
    builtinConsts,
    builtinFuncs,
  } = orderDeps(context, implicitIDs);
  let body = implicitIDs
    .map((id) => implicitToGL(context.statements[id]))
    .filter((e) => e != "")
    .join("\n\n");

  return [
    builtinConsts.map(constToDefinition),
    builtinFuncs.join("\n"),
    orderedVars.map(assignmentToDeclaration).join("\n"),
    orderedFuncs.map(functionDefinitionToGL).join("\n"),
    "vec4 outColor = vec4(1.0);",
    "void glesmosMain(vec2 coords) {",
    "  float x = coords.x; float y = coords.y;",
    orderedVars.map(assignmentToGL).join("\n"),
    body,
    "}",
  ].join("\n");
}

function constToDefinition(c: { name: string; value: Constant }) {
  const val = c.value.asCompilerValue();
  if (typeof val === "boolean") {
    throw "All consts should be numbers";
  }
  return `float ${c.name} = ${glslFloatify(evalMaybeRational(val))};`;
}

function assignmentToDeclaration(expr: Assignment) {
  return `${(expr._expression?.type == "ParenSeq") ? "vec2" : "float"} ${expr._symbol};`;
  //return `float ${expr._symbol};`;
}

function assignmentToGL(expr: Assignment) {
  const exprString = childExprToGL(expr._expression);
  return `${expr._symbol} = ${exprString};`;
}

function functionDefinitionToGL(expr: FunctionDefinition) {
  return (
    `float ${expr._symbol}(${expr._argSymbols
      .map((s) => "float " + s)
      .join(", ")}) {\n` +
    `  return ${childExprToGL(expr._expression)};\n` +
    `}`
  );
}
function implicitToGL(statement: Statement) {
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
  let stmt = statement as Comparator;
  const color = metaData.colorLatexValue ?? userData.color ?? "#00FF00";
  // metaData.computedFillOpacity could be a number, number[], NaN, or undefined
  let fillOpacity = metaData.computedFillOpacity ?? NaN;
  if (Array.isArray(color) || Array.isArray(fillOpacity)) {
    throw "Lists of implicits not yet implemented";
  }
  fillOpacity = isNaN(fillOpacity) ? 0.4 : fillOpacity;
  const colorStr = colorToVec3(color);
  const opacityStr = glslFloatify(fillOpacity);
  return (
    `  if (${childExprToGL(stmt._difference)} > 0.0) {\n` +
    `    outColor.rgb = mix(outColor.rgb, ${colorStr}, ${opacityStr});\n` +
    `  }`
  );
}

function colorToVec3(color: string) {
  // assumes col is a string of the form "#FF2200"
  let r = glslFloatify(parseInt(color.slice(1, 3), 16) / 256);
  let g = glslFloatify(parseInt(color.slice(3, 5), 16) / 256);
  let b = glslFloatify(parseInt(color.slice(5, 7), 16) / 256);
  return `vec3(${r}, ${g}, ${b})`;
}

function childExprToGL(expr: ChildExprNode): string {
  let a: string;
  let b: string;
  switch (expr.type) {
    case "Identifier":
      return expr._symbol;
    case "Constant":
    case "MixedNumber":
      const num = expr.asCompilerValue();
      if (typeof num === "boolean") {
        return num ? "true" : "false";
      } else {
        return glslFloatify(evalMaybeRational(num));
      }
    case "Add":
    case "Multiply":
    case "Subtract":
    case "Divide":
      a = childExprToGL(expr.args[0]);
      b = childExprToGL(expr.args[1]);
      let op = {
        Add: "+",
        Multiply: "*",
        Subtract: "-",
        Divide: "/",
      }[expr.type];
      return `(${a})${op}(${b})`;
    case "Exponent":
      a = childExprToGL(expr.args[0]);
      b = childExprToGL(expr.args[1]);
      return `pow(${a},${b})`;
    case "Negative":
      return `-(${childExprToGL(expr.args[0])})`;
    case "FunctionCall":
      const name = getFunctionName(expr._symbol);
      return `${name}(${expr.args.map(childExprToGL).join(", ")})`;
    case "Comparator['<']":
    case "Comparator['>']":
    case "Comparator['>=']":
    case "Comparator['<=']":
      return `${childExprToGL(expr._difference)} > 0.0`;
    case "Piecewise":
      // Long piecewises actually just nest into args[2]
      const pred = childExprToGL(expr.args[0]);
      a = childExprToGL(expr.args[1]);
      b = childExprToGL(expr.args[2]);
      return `(${pred}) ? ${a} : ${b}`;
    case "And":
      a = childExprToGL(expr.args[0]);
      b = childExprToGL(expr.args[1]);
      return `(${a}) && (${b})`;
    case "ParenSeq":
      if (expr.args.length === 2) {
        a = childExprToGL(expr.args[0]);
        b = childExprToGL(expr.args[1]);
        return `vec2(${a}, ${b})`;
      } else {
        throw `Unimplemented ParenSeq length: ${expr.args.length}`;
      }
      return `vec2(${a}, ${b})`;
    case "OrderedPairAccess":
      const index = expr.index.asCompilerValue();
      if (typeof index === "boolean") {
        throw "Programming error: expected OrderedPairAccess index to be a number";
      }
      const indexSuffix = "xy"[evalMaybeRational(index) - 1];
      return `(${childExprToGL(expr.point)}).${indexSuffix}`;
    case "DotAccess":
      return `(${childExprToGL(expr.args[0])}).${expr.args[1]._symbol}`;
    default:
      throw `Unimplemented subexpression type: ${expr.type}`;
  }
}

function evalMaybeRational(x: MaybeRational) {
  if (typeof x === "number") {
    return x;
  } else {
    return x.n / x.d;
  }
}
