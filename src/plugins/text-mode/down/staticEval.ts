import { Diagnostic } from "@codemirror/lint";
import { error } from "./diagnostics";
import * as TextAST from "./TextAST";

export function evalExpr(
  expr: TextAST.Expression
): [Diagnostic[], number | string | boolean | null] {
  switch (expr.type) {
    case "Number":
      return [[], expr.value];
    case "String":
      return [[], expr.value];
    case "PrefixExpression":
      const [errors, value] = evalExpr(expr.expr);
      return [errors, value !== null ? -value : null];
    case "Identifier":
      // TODO: create proper builtin map
      // Rudimentary variable inlining
      if (expr.name in builtinMap) {
        return [[], builtinMap[expr.name]];
      } else {
        return [[error(`Undefined identifier: ${expr.name}`, expr.pos)], null];
      }
    default:
      return [
        [
          error(
            `Static evaluation of ${expr.type} has not yet been implemented`,
            expr.pos
          ),
        ],
        null,
      ];
  }
}

const builtinMap: { [key: string]: number | string | boolean | null } = {
  false: false,
  true: true,
};
