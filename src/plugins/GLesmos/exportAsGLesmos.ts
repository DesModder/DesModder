import { Calc, ItemModel, parseDesmosLatex } from "desmodder";
import Expression, { ChildExprNode } from "parsing/parsenode";

export default function exportAsGLesmos() {
  const state = Calc.getState();
  return state.expressions.list.map(exprToGL).join("\n\n");
}

function exprToGL(expr: ItemModel): string {
  switch (expr.type) {
    case "expression":
      const latex = expr.latex;
      if (latex === undefined) return "";
      const parsed = parseDesmosLatex(latex);
      switch (parsed.type) {
        case "FunctionDefinition":
          return (
            `${parsed._symbol}(${parsed._argSymbols.join(", ")}) {\n` +
            `  return ${childExprToGL(parsed._expression)};\n` +
            `}`
          );
        case "Assignment":
          return `${parsed._symbol} = ${childExprToGL(parsed._expression)}`;
        default:
          return `// Unimplemented root level type: ${parsed.type}`;
      }
    default:
      return `// Unimplemented item model type: ${expr.type}`;
  }
}

function childExprToGL(expr: ChildExprNode): string {
  let a: string;
  let b: string;
  switch (expr.type) {
    case "Identifier":
      return expr._symbol;
    case "Constant":
      const num = expr.asCompilerValue();
      if (typeof num === "boolean") {
        return num ? "true" : "false";
      } else if (typeof num === "number") {
        return num.toString();
      } else {
        return (num.n / num.d).toString();
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
    default:
      throw `Unimplemented subexpression type: ${expr.type}`;
  }
}
