import * as Aug from "../aug/AugState";
import { MapIDPosition } from "../modify/mapIDPosition";
import { astItemToText } from "./astToText";
import { graphSettingsToAST, itemAugToAST } from "./augToAST";

export default function augToText(aug: Aug.State): [string, MapIDPosition] {
  // TODO: ticker
  const idMap: MapIDPosition = {};
  const settingsString = graphSettingsToText(aug.settings);
  let pos = settingsString.length;
  const itemStrings = [];
  for (const item of aug.expressions.list) {
    // + 2 for the \n\n
    idMap[item.id] = pos + 2;
    const text = "\n\n" + itemToText(item);
    itemStrings.push(text);
    pos += text.length;
  }
  return [settingsString + itemStrings.join(""), idMap];
}

export function graphSettingsToText(settings: Aug.GraphSettings) {
  return astItemToText(graphSettingsToAST(settings));
}

export function itemToText(item: Aug.ItemAug): string {
  const ast = itemAugToAST(item);
  if (ast === null) return "";
  return astItemToText(ast);
}
