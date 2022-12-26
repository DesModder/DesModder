import Node from "../parsing/parsenode";
import { ItemModel } from "globals/models";
import { desmosRequire, Calc } from "globals/window";

const _EvaluateSingleExpression = desmosRequire(
  "core/math/evaluate-single-expression"
).default;

export const jquery = desmosRequire("jquery");
export const keys = desmosRequire("keys") as {
  lookup: (e: KeyboardEvent) => string;
  lookupChar: (e: KeyboardEvent) => string;
  isUndo: (e: KeyboardEvent) => boolean;
  isRedo: (e: KeyboardEvent) => boolean;
  isHelp: (e: KeyboardEvent) => boolean;
};
export const parseDesmosLatexRaw = desmosRequire("core/math/parser").parse as (
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
  return _EvaluateSingleExpression(s, Calc.controller.isDegreeMode());
}

export const getQueryParams: () => { [key: string]: string | true } =
  desmosRequire("lib/parse-query-params").getQueryParams;

const mqOperators = desmosRequire("main/mathquill-operators");
export const autoCommandNames: string = mqOperators.getAutoCommands();
export const autoOperatorNames: string = mqOperators.getAutoOperators();

const getSectionsProto = desmosRequire(
  "expressions/expression-menus/expression-options-menu-view"
).ExpressionOptionsMenuView.prototype.getSections;

const grep = desmosRequire(
  "core/math/expression-types"
).getReconciledExpressionProps;

export function getReconciledExpressionProps(id: string): {
  points: boolean;
  lines: boolean;
  fill: boolean;
} {
  const model = Calc.controller.getItemModel(id);
  return grep((model as any).formula.expression_type, model);
}

export function getSections(
  model: ItemModel
): ("colors-only" | "lines" | "points" | "fill" | "label" | "drag")[] {
  return getSectionsProto.apply({ model });
}

// TODO: this might return "Untitled Graph" if called too soon, please fix!
export function getCurrentGraphTitle(): string {
  return Calc._calc.globalHotkeys?.graphsController?.getCurrentGraphTitle() || "Untitled Graph";
};
