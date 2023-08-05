import TextAST, { Concrete, Synthetic } from "../TextAST";
import { error } from "./diagnostics";
import type { Diagnostic } from "@codemirror/lint";

export function evalExpr(
  diagnostics: Diagnostic[],
  expr: TextAST.Expression<Concrete | Synthetic>
): number | string | boolean | null {
  switch (expr.type) {
    case "Number":
      return expr.value;
    case "String":
      return expr.value;
    case "PrefixExpression": {
      const value = evalExpr(diagnostics, expr.expr);
      return value !== null ? -value : null;
    }
    case "Identifier":
      // TODO: create proper builtin map
      // Rudimentary variable inlining
      if (expr.name in builtinMap) {
        return builtinMap[expr.name];
      } else {
        diagnostics.push(
          error(
            `Undefined identifier: ${expr.name.replace("_", "")}`,
            "pos" in expr ? expr.pos : undefined
          )
        );
        return null;
      }
    default:
      diagnostics.push(
        error(
          `Static evaluation of ${expr.type} has not yet been implemented`,
          "pos" in expr ? expr.pos : undefined
        )
      );
      return null;
  }
}

const builtinMap: Record<string, number | string | boolean | null> = {
  false: false,
  true: true,
  pi: Math.PI,
  tau: 2 * Math.PI,
  e: Math.E,
  infty: Infinity,
};
