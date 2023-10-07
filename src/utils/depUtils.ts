import Node from "#parsing/parsenode.ts";
import { type Calc, Fragile, Private } from "#globals";

const evaluateLatex = Fragile.evaluateLatex;

export const keys = Fragile.Keys;

export type Parse = (
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
  const parseDesmosLatexRaw = Private.Parser.parse as Parse;
  return parseDesmosLatexRaw(s, { allowDt: true, allowIndex: true });
}

export function EvaluateSingleExpression(calc: Calc, s: string): number {
  // may also return NaN (which is a number)
  return evaluateLatex(s, calc.controller.isDegreeMode());
}

export const getQueryParams = Fragile.getQueryParams;

export const autoCommandNames: string =
  Private.MathquillConfig?.getAutoCommands?.();
export const autoOperatorNames: string =
  Private.MathquillConfig?.getAutoOperators?.();

export function truncatedLatexLabel(label: any, labelOptions: any) {
  return Private.Mathtools.Label.truncatedLatexLabel(label, labelOptions);
}

export function getCurrentGraphTitle(calc: Calc): string | undefined {
  return calc._calc.globalHotkeys?.headerController?.graphsController?.getCurrentGraphTitle?.();
}

export const List = Fragile.List;
