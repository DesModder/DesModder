import * as TextAST from "./TextAST";

export function evalExpr(expr: TextAST.Expression): number | string | boolean {
  switch (expr.type) {
    case "Number":
      return expr.value;
    case "String":
      return expr.value;
    case "PrefixExpression":
      return -evalExpr(expr.expr);
    case "Identifier":
      // TODO: create proper builtin map
      // Rudimentary variable inlining
      if (expr.name === "false") return false;
      else if (expr.name === "true") return true;
      else {
        throw `Undefined identifier: ${expr.name}`;
      }
    default:
      // TODO: handle more?
      throw `Unhandled expr type: ${expr.type}`;
  }
}
