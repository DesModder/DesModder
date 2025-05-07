import { Aug } from "../aug";
import { TextEmitOptions, astToText } from "./astToText";
import { augToTextAST, graphSettingsToAST, itemAugToAST } from "./augToAST";

export function augToText(aug: Aug.State, emitOpts?: TextEmitOptions): string {
  return astToText(augToTextAST(aug), emitOpts);
}

export function graphSettingsToText(
  settings: Aug.GraphSettings,
  emitOpts?: TextEmitOptions
) {
  return astToText(graphSettingsToAST(settings), emitOpts);
}

export function itemToText(
  item: Aug.ItemAug,
  emitOpts?: TextEmitOptions
): string {
  const ast = itemAugToAST(item);
  if (ast === null) return "";
  return astToText(ast, emitOpts);
}
