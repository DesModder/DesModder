import { Config } from "../TextModeConfig";
import { Aug } from "../aug";
import rawToAug from "../aug/rawToAug";
import { augToText } from "./augToText";
import type { GraphState } from "#graph-state";

/**
 * @returns [boolean hasError, string text]
 */
export function rawToText(cfg: Config, state: GraphState): [boolean, string] {
  try {
    const aug = rawToAug(cfg, state);
    const augHasError = aug.expressions.list.some(itemHasError);
    const text = augToText(aug);
    return [augHasError, text];
  } catch {
    return [true, `"Error in conversion"`];
  }
}

function itemHasError(item: Aug.ItemAug) {
  return (
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    item.error || (item.type === "folder" && item.children.some(itemHasError))
  );
}
