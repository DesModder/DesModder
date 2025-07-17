import { type Calc, Fragile, Private } from "#globals";

const { evaluateLatex } = Fragile;

export const keys = Fragile.Keys;

export function parseDesmosLatex(s: string) {
  const parseDesmosLatexRaw = Private.Parser.parse;
  return parseDesmosLatexRaw(s, {
    allowDt: true,
    allowIndex: true,
    allowIntervalComprehensions: true,
  });
}

export function EvaluateSingleExpression(calc: Calc, s: string): number {
  // may also return NaN (which is a number)
  return evaluateLatex(s, calc.controller.getDegreeMode());
}

export const autoCommands = Private?.MathquillConfig?.getAutoCommands?.();
export const autoOperatorNames = Private?.MathquillConfig?.getAutoOperators?.();

export function getCurrentGraphTitle(calc: Calc): string | undefined {
  return calc._calc.globalHotkeys?.mygraphsController?.graphsController?.getCurrentGraphTitle?.();
}

export const { List } = Fragile;
