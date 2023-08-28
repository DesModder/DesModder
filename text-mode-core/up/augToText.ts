import Aug from "../aug/AugState";
import { astToText } from "./astToText";
import { augToTextAST, graphSettingsToAST, itemAugToAST } from "./augToAST";

export function augToText(aug: Aug.State): string {
  return astToText(augToTextAST(aug));
}

export function graphSettingsToText(settings: Aug.GraphSettings) {
  return astToText(graphSettingsToAST(settings));
}

export function itemToText(item: Aug.ItemAug): string {
  const ast = itemAugToAST(item);
  if (ast === null) return "";
  return astToText(ast);
}
