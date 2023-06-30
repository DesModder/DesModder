import Node from "../parsing/parsenode";
import { Calc, Fragile, Private } from "globals/window";

const evaluateLatex = Fragile.evaluateLatex;

export const keys = Fragile.Keys;
export const parseDesmosLatexRaw = Private.Parser.parse as (
  s: string,
  config?: {
    allowDt?: boolean;
    allowIndex?: boolean;
    disallowFrac?: boolean;
    trailingComma?: boolean;
    seedPrefix?: string;
  }
) => Node;

export function parseDesmosLatex(s: string) {
  return parseDesmosLatexRaw(s, { allowDt: true, allowIndex: true });
}

export function EvaluateSingleExpression(s: string): number {
  // may also return NaN (which is a number)
  return evaluateLatex(s, Calc.controller.isDegreeMode());
}

export const getQueryParams = Fragile.getQueryParams;

export const autoCommandNames: string =
  Private.MathquillConfig?.getAutoCommands?.();
export const autoOperatorNames: string =
  Private.MathquillConfig?.getAutoOperators?.();

export function getCurrentGraphTitle(): string | undefined {
  return Calc._calc.globalHotkeys?.headerController?.graphsController?.getCurrentGraphTitle?.();
}

export const List = Fragile.List;
