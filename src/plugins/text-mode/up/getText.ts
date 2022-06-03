import { Calc } from "globals/window";
import * as Aug from "../aug/AugState";
import rawToAug from "../aug/rawToAug";
import augToText from "./augToText";

export default function getText(): [boolean, string] {
  const state = Calc.getState();
  const aug = rawToAug(state);
  const augHasError = aug.expressions.list.some(itemHasError);
  const text = augToText(aug);
  return [augHasError, text];
}

function itemHasError(item: Aug.ItemAug) {
  return (
    item.error || (item.type === "folder" && item.children.some(itemHasError))
  );
}
