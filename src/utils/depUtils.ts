import { type Calc, Fragile, Private, Toast } from "#globals";
import { Formattable, fromFormattable } from "#i18n";

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

export function tick(calc: Calc): void {
  calc.controller.dispatch({ type: "tick" });
}

export type ToastFormattable = Omit<Toast, "message"> & {
  message: Formattable;
};

function isPlainToast(toast: Toast | ToastFormattable): toast is Toast {
  return typeof toast.message === "string";
}

export function showToast(calc: Calc, toast: Toast | ToastFormattable): void {
  calc.controller.showToast(
    isPlainToast(toast)
      ? toast
      : // Toasts are ephemeral enough that they don't really need
        // to update on language change:
        // eslint-disable-next-line @desmodder/eslint-rules/no-format-in-ts
        { ...toast, message: fromFormattable(toast.message) }
  );
  tick(calc);
}

type CalcUtilFunction<
  P extends readonly unknown[] = readonly never[],
  R = unknown,
> = (calc: Calc, ...args: P) => R;
type CalcUtilSig<F extends CalcUtilFunction> =
  F extends CalcUtilFunction<infer P, infer R> ? [P, R] : never;
type CalcUtilParams<F extends CalcUtilFunction> = CalcUtilSig<F>[0];
type CalcUtilReturn<F extends CalcUtilFunction> = CalcUtilSig<F>[1];

type CalcUtils = Record<string, CalcUtilFunction>;

type BindCalc<U extends CalcUtils> = {
  [K in keyof U]: (...args: CalcUtilParams<U[K]>) => CalcUtilReturn<U[K]>;
};

const bindCalc =
  <const U extends CalcUtils>(calcUtils: U) =>
  (calc: Calc) =>
    Object.entries(calcUtils).reduce<BindCalc<CalcUtils>>(
      (utils, [name, func]) => {
        utils[name] = (...args) => func(calc, ...args);
        return utils;
      },
      {}
    ) as BindCalc<U>;

export const createCalcUtils = bindCalc({
  EvaluateSingleExpression,
  getCurrentGraphTitle,
  tick,
  showToast,
} satisfies CalcUtils);

export const { List } = Fragile;
