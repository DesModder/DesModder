import { desmosRequire, Calc } from "globals/window";
import { IRChunk } from "parsing/IR";
import Node from "../parsing/parsenode";

const _EvaluateSingleExpression = desmosRequire(
  "core/math/evaluate-single-expression"
).default;

export const jquery = desmosRequire("jquery");
export const keys = desmosRequire("keys");
export const parseDesmosLatex = desmosRequire("core/math/parser").parse as (
  s: string
) => Node;

export function EvaluateSingleExpression(s: string): number {
  // may also return NaN (which is a number)
  return _EvaluateSingleExpression(s, Calc.controller.isDegreeMode());
}

export const getQueryParams: () => { [key: string]: string | true } =
  desmosRequire("lib/parse-query-params").getQueryParams;
