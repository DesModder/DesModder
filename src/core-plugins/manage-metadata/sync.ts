import Metadata from "#metadata/interface.ts";
import { migrateToLatestMaybe } from "#metadata/migrate.ts";
import {
  getBlankMetadata,
  isBlankMetadata,
  mergeMetadata,
} from "#metadata/manage.ts";
import {
  type Calc,
  CalcController,
  Console,
  ItemModel,
  TextModel,
} from "#globals";
import { List } from "#utils/depUtils.ts";
import { FolderState, TextState } from "graph-state/state";

/*
This file manages the metadata expressions. These are stored on the graph state as expressions and consist of:

{
  type: "folder",
  id: "dsm-metadata-folder",
  secret: true,
  title: "DesModder Metadata"
}

{
  type: "text",
  id: "dsm-metadata",
  folderId: "dsm-metadata-folder",
  text: "{\n  \"key\": value\n}"
}

The text content of dsm-metadata is in JSON format
*/

const ID_METADATA = "dsm-metadata";
const ID_METADATA_FOLDER = "dsm-metadata-folder";

function getMetadataExpr(cc: CalcController) {
  return cc.getItemModel(ID_METADATA);
}

function _getMetadataFromListModel(cc: CalcController) {
  const expr = getMetadataExpr(cc);
  if (expr === undefined) return getBlankMetadata();
  if (expr.type === "text") {
    const metadata = getMetadataFromTextItemMaybe(expr);
    if (metadata) {
      return metadata;
    }
  }

  Console.warn("Invalid dsm-metadata. Ignoring");
  return getBlankMetadata();
}

export function getMetadataFromListModel(calc: Calc) {
  return _getMetadataFromListModel(calc.controller);
}

function getMetadataFromTextItemMaybe(expr: TextModel): Metadata | undefined {
  if (!expr.text) return undefined;
  if (!expr.text.startsWith("{")) return undefined;
  try {
    const parsed = JSON.parse(expr.text);
    return migrateToLatestMaybe(parsed);
  } catch {
    return undefined;
  }
}

function addItemToEnd(calc: Calc, state: FolderState | TextState) {
  calc.controller._addItemToEndFromAPI(calc.controller.createItemModel(state));
}

export function setMetadataInListModel(calc: Calc, metadata: Metadata) {
  cleanMetadata(calc, metadata);
  List.removeItemById(calc.controller.listModel, ID_METADATA);
  List.removeItemById(calc.controller.listModel, ID_METADATA_FOLDER);
  if (!isBlankMetadata(metadata)) {
    addItemToEnd(calc, {
      type: "folder",
      id: ID_METADATA_FOLDER,
      secret: true,
      title: "DesModder Metadata",
    });
    addItemToEnd(calc, {
      type: "text",
      id: ID_METADATA,
      folderId: ID_METADATA_FOLDER,
      text: JSON.stringify(metadata),
    });
  }
}

/* Mutate metadata by removing expressions that no longer exist */
function cleanMetadata(calc: Calc, metadata: Metadata) {
  for (const id in metadata.expressions) {
    if (calc.controller.getItemModel(id) === undefined) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete metadata.expressions[id];
    }
  }
}

/**
 * We assume there's only at most one text expr with ID "dsm-metadata,"
 * which Desmos does guarantee. But importing or pasting graphs may
 * end up inserting new dsm-metadata text.
 * Here, we detect statements that look like pasted metadata expressions:
 *  - Secret, or inside a secret folder.
 *  - Text statement
 *  - Text starts with "{"
 *  - Parses as valid metadata.
 * They are removed and all merged into a single metadata expression.
 */
export function consolidateMetadataNotes(calc: Calc) {
  const cc = calc.controller;
  const toRemove = new Map<string, Metadata>();
  for (const item of cc.getAllItemModels()) {
    if (item.id === ID_METADATA) continue;
    if (item.type !== "text") continue;
    if (!isItemSecret(cc, item)) continue;
    const metadata = getMetadataFromTextItemMaybe(item);
    if (metadata === undefined) continue;
    const toDelete = idToDelete(cc, item);
    toRemove.set(toDelete, metadata);
    if (toRemove.size > 10) {
      // `cc.removeListOfItems` is currently a quadratic algorithm
      // since it just removes one item at a time. Give up instead
      // of freezing the page.
      return;
    }
  }
  if (toRemove.size === 0) {
    return;
  }
  const { deletedItems } = cc.removeListOfItems([...toRemove.keys()]);
  const graphMetadata = _getMetadataFromListModel(cc);
  for (const item of deletedItems) {
    const metadata = toRemove.get(item.id);
    if (!metadata) continue;
    mergeMetadata(graphMetadata, metadata);
  }
  setMetadataInListModel(calc, graphMetadata);
}

function isItemSecret(cc: CalcController, item: ItemModel): boolean {
  if (item.secret) return true;
  if (item.type === "folder") return false;
  const parentFolder = item.folderId && cc.getItemModel(item.folderId);
  return !!parentFolder && !!parentFolder.secret;
}

/** If the expr is the only expr in its folder, delete the folder entirely. */
function idToDelete(cc: CalcController, item: ItemModel): string {
  const parentFolder = item.folderId && cc.getItemModel(item.folderId);
  if (parentFolder) {
    const hasSibling =
      cc.getItemModelByIndex(item.index - 1) !== parentFolder ||
      cc.getItemModelByIndex(item.index + 1)?.folderId === item.folderId;
    if (!hasSibling) {
      return item.folderId!;
    }
  }
  return item.id;
}
