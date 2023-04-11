import Node from "../parsing/parsenode";
import { ItemModel } from "globals/models";
import { Calc, Fragile, Private } from "globals/window";

const evaluateLatex = Fragile.evaluateLatex;

export const jquery = Fragile.jQuery;
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

const grep = Fragile.getReconciledExpressionProps;

export function getReconciledExpressionProps(id: string) {
  const model = Calc.controller.getItemModel(id);
  return grep((model as any).formula.expression_type, model);
}

const ExpressionOptionsMenuView = Fragile.ExpressionOptionsMenuView;

const getSectionsProto = ExpressionOptionsMenuView.prototype.getSections;

export function getSections(model: ItemModel) {
  return getSectionsProto.apply({ model, controller: Calc.controller } as any);
}

export function getCurrentGraphTitle(): string | undefined {
  return Calc._calc.globalHotkeys?.headerController?.graphsController?.getCurrentGraphTitle?.();
}

export const List = Fragile.List;
