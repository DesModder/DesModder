import Aug from "../aug/AugState";
import { NodePath } from "../down/TextAST";
import { astItemToTextString } from "./astToText";
import { graphSettingsToAST, itemAugToAST, tickerToAST } from "./augToAST";

export default function augToText(aug: Aug.State): string {
  const settingsString = graphSettingsToText(aug.settings);
  const tickerString = aug.expressions.ticker
    ? "\n\n" + tickerToText(aug.expressions.ticker)
    : "";
  const itemStrings = [];
  for (const item of aug.expressions.list) {
    const text = "\n\n" + itemToText(item);
    itemStrings.push(text);
  }
  return settingsString + tickerString + itemStrings.join("");
}

export function graphSettingsToText(settings: Aug.GraphSettings) {
  return astItemToTextString(new NodePath(graphSettingsToAST(settings), null));
}

export function tickerToText(ticker: Aug.TickerAug) {
  return astItemToTextString(new NodePath(tickerToAST(ticker), null));
}

export function itemToText(item: Aug.ItemAug): string {
  const ast = itemAugToAST(item);
  if (ast === null) return "";
  return astItemToTextString(new NodePath(ast, null));
}
