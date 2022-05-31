import { Diagnostic } from "@codemirror/lint";
import { error } from "./diagnostics";
import * as TextAST from "./TextAST";

export function evalExpr(
  diagnostics: Diagnostic[],
  expr: TextAST.Expression
): number | string | boolean | null {
  switch (expr.type) {
    case "Number":
      return expr.value;
    case "String":
      return expr.value;
    case "PrefixExpression":
      const value = evalExpr(diagnostics, expr.expr);
      return value !== null ? -value : null;
    case "Identifier":
      // TODO: create proper builtin map
      // Rudimentary variable inlining
      if (expr.name in builtinMap) {
        return builtinMap[expr.name];
      } else {
        diagnostics.push(error(`Undefined identifier: ${expr.name}`, expr.pos));
        return null;
      }
    default:
      diagnostics.push(
        error(
          `Static evaluation of ${expr.type} has not yet been implemented`,
          expr.pos
        )
      );
      return null;
  }
}

const builtinMap: { [key: string]: number | string | boolean | null } = {
  false: false,
  true: true,
};
