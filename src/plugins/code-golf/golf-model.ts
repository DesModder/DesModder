import { mountToNode } from "#DCGView";
import { InlineMathInputView } from "src/components";
import {
  CalcController,
  ExpressionModel,
  FolderModel,
  ItemModel,
} from "src/globals";
import CodeGolf from ".";

const MAX_GOLF_LENGTH_CHARS = 2000;

function calcWidthInPixels(domNode?: HTMLElement) {
  const rootblock = domNode?.querySelector(".dcg-mq-root-block");

  if (!rootblock?.lastChild || !rootblock.firstChild) return 0;

  const range = document.createRange();
  range.setStartBefore(rootblock.firstChild);
  range.setEndAfter(rootblock.lastChild);

  const { width } = range.getBoundingClientRect();

  return width;
}

function symbolCount(el: Element) {
  const svgLen = [".dcg-mq-fraction", "svg", ".dcg-mq-token"]
    .map((s) => el.querySelectorAll(s).length)
    .reduce((a, b) => a + b);
  return (
    svgLen +
    (el.textContent?.replace(
      /\s|[\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000]/g,
      ""
    )?.length ?? 0)
  );
}

function calcSymbolCount(el?: HTMLElement) {
  const rootblock = el?.querySelector(".dcg-mq-root-block");
  if (!rootblock) return 0;

  return rootblock ? symbolCount(rootblock) : 0;
}

export interface GoodGolfStats {
  width: number;
  symbols: number;
}

/**
 * `TOO_LONG`: I'd love to compute stats for this, but it's longer than `MAX_GOLF_LENGTH_CHARS`.
 *   This also blocks any future measurements of children, if this is a collapsed folder.
 * `HIDDEN`: It's offscreen, or collapsed inside a folder. No need to measure it.
 */
export type GolfStats = "TOO_LONG" | "HIDDEN" | GoodGolfStats;

/**
 * Mutate the item models, filling in `dsmGolfStats`.
 * This is the same approach that Desmos takes to filling in the increasing
 * sequence of index numbers from start to end. The main difference is that
 * the calculation now relies on DOM measures, which could be brutal for
 * performance. We really should do all the measures in a single pass,
 * but that is not yet implemented.
 */
export function populateGolfStats(cg: CodeGolf) {
  const itemModels = cg.cc.getAllItemModels();

  // Mark long folders as too long.
  for (let i = 0; i < itemModels.length; i++) {
    const item = itemModels[i];

    // Clear out dsmGolfStats. In particular, clearing out TOO_LONG
    // allows re-calculate those exprs/folders if the latex gets short enough.
    item.dsmGolfStats = undefined;
    switch (item.type) {
      case "expression":
      case "folder":
      case undefined:
        if (isItemTooLong(itemModels, item, i)) {
          item.dsmGolfStats = "TOO_LONG";
        }
        break;
      case "image":
      case "table":
      case "text":
        continue;
      default:
        item satisfies never;
        continue;
    }
  }

  // Go in reverse direction so the children's stats are computed before each folder.
  for (let i = itemModels.length - 1; i >= 0; i--) {
    const item = itemModels[i];
    switch (item.type) {
      case "expression":
      case "folder":
        item.dsmGolfStats = golfStatsForItem(cg, itemModels, item, i);
        break;
      case "image":
      case "table":
      case "text":
      case undefined:
        // No stats for these.
        break;
      default:
        item satisfies never;
    }
  }
}

function isItemTooLong(
  itemModels: ItemModel[],
  item: ExpressionModel | FolderModel,
  i: number
) {
  return item.type === "folder"
    ? isFolderTooLong(itemModels, item, i)
    : isExprTooLong(item);
}

function isExprTooLong(item: ExpressionModel) {
  if (item.dsmEnableGolfDespiteLength) {
    return false;
  }
  if (item.folderId) {
    const folder = item.controller.getItemModel(item.folderId);
    if (folder?.dsmEnableGolfDespiteLength) {
      return false;
    }
  }
  return (item.latex?.length ?? 0) > MAX_GOLF_LENGTH_CHARS;
}

/**
 * Assume `itemModels[i]` is a folder with ID `folderID`.
 * Returns whether we just give up now for performance?
 */
function isFolderTooLong(
  itemModels: ItemModel[],
  folderItem: FolderModel,
  i: number
): boolean {
  if (folderItem.dsmEnableGolfDespiteLength) {
    return false;
  }
  const folderId = folderItem.id;
  let totalLength = 0;
  for (let j = i + 1; j < itemModels.length; j++) {
    const item = itemModels[j];
    if (item.folderId !== folderId) break;
    if (item.type !== "expression") continue;
    totalLength += item.latex?.length ?? 0;
    if (totalLength > MAX_GOLF_LENGTH_CHARS) {
      return true;
    }
  }
  return false;
}

function isHidden(cg: CodeGolf, item: ItemModel) {
  // Is offscreen, hidden, or filtered out by Ctrl+F.
  if (cg.dsm.pinExpressions?.isExpressionPinned(item.id)) {
    return false;
  }
  return item.renderShell || item.isHiddenFromUI || !!item.filteredBySearch;
}

function needToComputeStats(cg: CodeGolf, item: ItemModel): boolean {
  if (item.dsmGolfStats === "TOO_LONG") {
    return false;
  } else if (!isHidden(cg, item)) {
    return true;
  } else if (item.type !== "folder") {
    const parentFolder = item.folderId && cg.cc.getItemModel(item.folderId);
    return !!parentFolder && needToComputeStats(cg, parentFolder);
  } else {
    return false;
  }
}

function golfStatsForItem(
  cg: CodeGolf,
  itemModels: ItemModel[],
  item: ExpressionModel | FolderModel,
  i: number
): GolfStats {
  if (item.dsmGolfStats === "TOO_LONG") {
    return "TOO_LONG";
  }
  if (!needToComputeStats(cg, item)) {
    return "HIDDEN";
  }
  switch (item.type) {
    case "expression":
    case undefined:
      return golfStatsForExpr(cg.cc, item.latex ?? "");
    case "folder":
      return golfStatsForFolder(itemModels, item.id, i);
    default:
      item satisfies never;
      return "HIDDEN";
  }
}

const cachedGolfStatsPool = new Map<string, GoodGolfStats>();

function golfStatsForExpr(cc: CalcController, latex: string): GolfStats {
  if (latex.length === 0) return { width: 0, symbols: 0 };

  const cached = cachedGolfStatsPool.get(latex);
  if (cached) return cached;

  const fakeContainer = document.createElement("div");
  document.body.appendChild(fakeContainer);
  fakeContainer.style.transform = `scale(${1 / 0.75})`;

  mountToNode(InlineMathInputView, fakeContainer, {
    latex: () => latex ?? "",
    isFocused: () => false,
    selectOnFocus: () => false,
    handleLatexChanged: () => {},
    hasError: () => false,
    handleFocusChanged: () => () => false,
    ariaLabel: () => "",
    controller: () => cc,
    placeholder: () => "",
  });

  const stats = {
    width: calcWidthInPixels(fakeContainer),
    symbols: calcSymbolCount(fakeContainer),
  };

  cachedGolfStatsPool.set(latex, stats);

  if (cachedGolfStatsPool.size > 10000) {
    cachedGolfStatsPool.delete(cachedGolfStatsPool.keys().next().value!);
  }

  document.body.removeChild(fakeContainer);

  return stats;
}

/**
 * Assume `itemModels[i]` is a folder with ID `folderID`,
 * and the stats for everything after it have been filled in.
 * Give the GolfStats for the folder.
 */
function golfStatsForFolder(
  itemModels: ItemModel[],
  folderId: string,
  i: number
): GolfStats {
  let totalWidth = 0;
  let totalSymbols = 0;
  for (let j = i + 1; j < itemModels.length; j++) {
    const item = itemModels[j];
    if (item.folderId !== folderId) break;
    if (item.type !== "expression") continue;
    if (
      item.dsmGolfStats === undefined ||
      item.dsmGolfStats === "TOO_LONG" ||
      item.dsmGolfStats === "HIDDEN"
    ) {
      // To satisfy this, we need a parent folder to be TOO_LONG whenever
      // a child expression is TOO_LONG. This is met because we use the same
      // threshold in length for both.
      // Also, we need children to not be HIDDEN if the parent folder is not
      // HIDDEN. This is handled in `needToComputeStats`.

      throw new Error(
        `Expected dsmGolfStats to be computed for expr ${item.id}, but got ${item.dsmGolfStats}`
      );
    }
    const { width, symbols } = item.dsmGolfStats;
    totalWidth += width;
    totalSymbols += symbols;
  }

  return {
    width: totalWidth,
    symbols: totalSymbols,
  };
}
