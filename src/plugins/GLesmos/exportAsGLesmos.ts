import { Calc, ItemModel, parseDesmosLatex } from "desmodder";
import Expression, { ChildExprNode, MaybeRational } from "parsing/parsenode";

type GLesmosExprCategory = "function" | "expression" | "unimplemented";

function glslFloatify(x: number) {
  return Number.isInteger(x) ? x.toString() + ".0" : x.toString();
}

export default function exportAsGLesmos() {
  const state = Calc.getState();
  const glSnippets = state.expressions.list.map(exprToGL);
  return (
    glSnippets
      .filter((s) => s[1] == "function")
      .map((s) => s[0])
      .join("\n\n") +
    `\n\nvec4 outColor = vec4(1.0);\n\n` +
    `void glesmosMain(vec2 coords) { float x = coords.x; float y = coords.y;\n\n    ` +
    glSnippets
      .filter((s) => s[1] == "expression")
      .map((s) => s[0])
      .join("\n    ") +
    "\n\n}\n\n" +
    glSnippets
      .filter((s) => s[1] == "unimplemented")
      .map((s) => s[0])
      .join("\n\n")
  );
}

function exprToGL(expr: ItemModel): [string, GLesmosExprCategory] {
  switch (expr.type) {
    case "expression":
      const latex = expr.latex;
      if (latex === undefined) return ["", "unimplemented"];
      const parsed = parseDesmosLatex(latex);
      switch (parsed.type) {
        case "FunctionDefinition":
          return [
            `float ${parsed._symbol}(${parsed._argSymbols
              .map((s) => "float " + s)
              .join(", ")}) {\n` +
              `  return ${childExprToGL(parsed._expression)};\n` +
              `}`,
            "function",
          ];
        case "Assignment":
          return [
            `float ${parsed._symbol} = ${childExprToGL(parsed._expression)};`,
            "expression",
          ];
        case "Comparator['<']":
        case "Comparator['>']":
        case "Comparator['>=']":
        case "Comparator['<=']":
          let col = expr.color ? expr.color : "#00FF00";
          let r = glslFloatify(parseInt(col.slice(1, 3), 16) / 256);
          let g = glslFloatify(parseInt(col.slice(3, 5), 16) / 256);
          let b = glslFloatify(parseInt(col.slice(5, 7), 16) / 256);
          let a = expr.fillOpacity === undefined ? 0.4 : expr.fillOpacity;
          return [
            `if (${childExprToGL(parsed._difference)} > 0.0) {\n` +
              `    outColor.rgb = mix(outColor.rgb, vec3(${r}, ${g}, ${b}), ${a});\n` +
              `}`,
            "expression",
          ];
        default:
          return [
            `// Unimplemented root level type: ${parsed.type}`,
            "unimplemented",
          ];
      }
    default:
      return [
        `// Unimplemented item model type: ${expr.type}`,
        "unimplemented",
      ];
  }
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
      return `${expr._symbol}(${expr.args.map(childExprToGL).join(", ")})`;
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
    case "OrderedPair":
      a = childExprToGL(expr.args[0]);
      b = childExprToGL(expr.args[1]);
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
