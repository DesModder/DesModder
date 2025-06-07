import { Concrete, Synthetic } from "../TextAST";
import { TextAST } from "..";
import { error } from "./diagnostics";
import type { Diagnostic } from "@codemirror/lint";

export type ComptimeValueScalar = number | string | boolean;
export type ComptimeValue = ComptimeValueScalar | number[];

export function evalExpr(
  diagnostics: Diagnostic[],
  expr: TextAST.Expression<Concrete | Synthetic>
): ComptimeValue | null {
  switch (expr.type) {
    case "Number":
      return expr.value;
    case "String":
      return expr.value;
    case "PrefixExpression": {
      const value = evalExpr(diagnostics, expr.expr);
      return value !== null ? -value : null;
    }
    case "ListExpression": {
      let someNotNumber = false;
      const res = expr.values.map((e) => {
        const r = evalExpr(diagnostics, e);
        if (typeof r === "number") return r;
        diagnostics.push(
          error(
            "Static-evaluated lists may only contain numbers",
            "pos" in expr ? expr.pos : undefined
          )
        );
        someNotNumber = true;
        return 0;
      });
      if (someNotNumber) return null;
      return res;
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

const builtinMap: Record<string, ComptimeValue> = {
  false: false,
  true: true,
  pi: Math.PI,
  tau: 2 * Math.PI,
  e: Math.E,
  infty: Infinity,
};
