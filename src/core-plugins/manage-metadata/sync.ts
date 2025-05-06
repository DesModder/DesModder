import Metadata from "#metadata/interface.ts";
import { migrateToLatestMaybe } from "#metadata/migrate.ts";
import {
  getBlankMetadata,
  ID_METADATA,
  ID_METADATA_FOLDER,
  isBlankMetadata,
  mergeMetadata,
  metadataWithIdsMapped,
} from "#metadata/manage.ts";
import { type Calc, CalcController, Console, ItemModel } from "#globals";
import { List } from "#utils/depUtils.ts";
import { FolderState, ItemState, TextState } from "graph-state/state";

/*
This file manages the metadata expressions. These are stored on the graph state as expressions and consist of:


{
  type: "text",
  id: "dsm-metadata",
  secret: true,
  text: "{\n  \"key\": value\n}"
}

The text content of dsm-metadata is in JSON format

There used to be a folder with ID "dsm-metadata-folder". We no longer use it
and instead remove the folder from existing graphs.
*/

function getMetadataExpr(cc: CalcController) {
  return cc.getItemModel(ID_METADATA);
}

function _getMetadataFromListModel(cc: CalcController) {
  const expr = getMetadataExpr(cc);
  if (expr === undefined) return getBlankMetadata();
  if (expr.type === "text") {
    const metadata = getMetadataFromTextMaybe(expr.text);
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

export function getMetadataFromListJSONMaybe(
  list: ItemState[],
  mappedId: string
): Metadata | undefined {
  for (const item of list) {
    if (item.id === mappedId && item.type === "text")
      return getMetadataFromTextMaybe(item.text);
  }
}

function getMetadataFromTextMaybe(
  text: string | undefined
): Metadata | undefined {
  if (!text) return undefined;
  if (!text.startsWith("{")) return undefined;
  try {
    const parsed = JSON.parse(text);
    return migrateToLatestMaybe(parsed);
  } catch {
    return undefined;
  }
}

function addItemToEnd(calc: Calc, state: FolderState | TextState) {
  calc.controller._addItemToEndFromAPI(calc.controller.createItemModel(state));
}

/** Mutate `listModel` by setting metadata exprs. */
export function setMetadataInListModel(calc: Calc, metadata: Metadata) {
  cleanMetadata(calc, metadata);
  List.removeItemById(calc.controller.listModel, ID_METADATA);
  List.removeItemById(calc.controller.listModel, ID_METADATA_FOLDER);
  if (!isBlankMetadata(metadata)) {
    addItemToEnd(calc, {
      type: "text",
      id: ID_METADATA,
      secret: true,
      text: JSON.stringify(metadata),
    });
  }
}

/** Mutate `list` by setting metadata exprs. */
export function setMetadataInListJSON(list: ItemState[], metadata: Metadata) {
  cleanMetadataGivenList(list, metadata);
  removeIDFromListJSON(list, ID_METADATA);
  removeIDFromListJSON(list, ID_METADATA_FOLDER);
  if (!isBlankMetadata(metadata)) {
    list.push({
      type: "text",
      id: ID_METADATA,
      secret: true,
      text: JSON.stringify(metadata),
    });
  }
}

function removeIDFromListJSON(list: ItemState[], id: string) {
  for (let i = list.length - 1; i >= 0; i--) {
    const item = list[i];
    if (item.id === id) {
      list.splice(i, 1);
      return;
    }
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

/* Mutate metadata by removing expressions that no longer exist */
function cleanMetadataGivenList(list: ItemState[], metadata: Metadata) {
  const presentIds = new Set();
  for (const item of list) {
    presentIds.add(item.id);
  }
  for (const id in metadata.expressions) {
    if (!presentIds.has(id)) {
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
 * They are all removed. They were pasted without proper ID migration,
 * so the IDs are wrong: there is no point merging them in to the existing metadata.
 */
export function deleteJunkMetadataNotes(calc: Calc) {
  const cc = calc.controller;
  const toRemove = new Map<string, Metadata>();
  for (const item of cc.getAllItemModels()) {
    if (item.id === ID_METADATA) continue;
    if (item.type !== "text") continue;
    if (item.readonly) continue;
    if (!isItemSecret(cc, item)) continue;
    const metadata = getMetadataFromTextMaybe(item.text);
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
  cc.removeListOfItems([...toRemove.keys()]);
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

/**
 * Used by a replacement. The `newList` has already been spliced into
 * `currentList`, with IDs migrated to newly-generated IDs (without collision)
 * as described by the map `oldIdToNewId`. If metadata is present on `newList`,
 * then mutate the metadata on the `currentList` (or insert if missing),
 * and delete the metadata on the `newList`.
 */
export function transferMetadata(
  currentList: ItemState[],
  newList: ItemState[],
  oldIdToNewId: Map<string, string>
) {
  const newMetadataID = oldIdToNewId.get(ID_METADATA);
  if (!newMetadataID) return;
  const newMetadataWithOldIDs = getMetadataFromListJSONMaybe(
    newList,
    newMetadataID
  );
  if (!newMetadataWithOldIDs) return;

  const newMetadata = metadataWithIdsMapped(
    newMetadataWithOldIDs,
    oldIdToNewId
  );
  const currentMetadata = getMetadataFromListJSONMaybe(
    currentList,
    ID_METADATA
  );
  const metadata = currentMetadata
    ? (mergeMetadata(currentMetadata, newMetadata), currentMetadata)
    : newMetadata;
  removeIDFromListJSON(newList, newMetadataID);
  const newMetadataFolderID = oldIdToNewId.get(ID_METADATA_FOLDER);
  if (newMetadataFolderID) {
    removeIDFromListJSON(newList, newMetadataFolderID);
  }
  setMetadataInListJSON(currentList, metadata);
}
