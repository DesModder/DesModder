import Aug from "../aug/AugState";
import { astItemToText } from "./astToText";
import { graphSettingsToAST, itemAugToAST } from "./augToAST";

export default function augToText(aug: Aug.State): string {
  // TODO: ticker
  const settingsString = graphSettingsToText(aug.settings);
  const itemStrings = [];
  for (const item of aug.expressions.list) {
    const text = "\n\n" + itemToText(item);
    itemStrings.push(text);
  }
  return settingsString + itemStrings.join("");
}

export function graphSettingsToText(settings: Aug.GraphSettings) {
  return astItemToText(graphSettingsToAST(settings));
}

export function itemToText(item: Aug.ItemAug): string {
  const ast = itemAugToAST(item);
  if (ast === null) return "";
  return astItemToText(ast);
}
