import Metadata from "#metadata/interface.ts";
import migrateToLatest from "#metadata/migrate.ts";
import { getBlankMetadata, isBlankMetadata } from "#metadata/manage.ts";
import { type Calc, Console } from "#globals";
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

function getMetadataExpr(calc: Calc) {
  return calc.controller.getItemModel(ID_METADATA);
}

export function getMetadataFromListModel(calc: Calc) {
  const expr = getMetadataExpr(calc);
  if (expr === undefined) return getBlankMetadata();
  if (expr.type === "text" && expr.text !== undefined) {
    try {
      const parsed = JSON.parse(expr.text);
      return migrateToLatest(parsed);
    } catch {
      // Fallthrough to below Invalid case.
    }
  }
  Console.warn("Invalid dsm-metadata. Ignoring");
  return getBlankMetadata();
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
