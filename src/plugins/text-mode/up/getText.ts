import { Calc } from "globals/window";
import * as Aug from "../aug/AugState";
import rawToAug from "../aug/rawToAug";
import { MapIDPosition } from "../modify/mapIDPosition";
import augToText from "./augToText";

export default function getText(): [boolean, string, MapIDPosition] {
  const state = Calc.getState();
  const aug = rawToAug(state);
  const augHasError = aug.expressions.list.some(itemHasError);
  const [text, idMap] = augToText(aug);
  return [augHasError, text, idMap];
}

function itemHasError(item: Aug.ItemAug) {
  return (
    item.error || (item.type === "folder" && item.children.some(itemHasError))
  );
}
