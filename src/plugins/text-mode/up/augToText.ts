import { NodePath } from "../down/TextAST";
import Aug from "../aug/AugState";
import { astItemToTextString } from "./astToText";
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
  return astItemToTextString(new NodePath(graphSettingsToAST(settings), null));
}

export function itemToText(item: Aug.ItemAug): string {
  const ast = itemAugToAST(item);
  if (ast === null) return "";
  return astItemToTextString(new NodePath(ast, null));
}
