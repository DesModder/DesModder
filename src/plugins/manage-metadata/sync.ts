import Metadata from "#metadata/interface.ts";
import migrateToLatest from "#metadata/migrate.ts";
import { getBlankMetadata, isBlankMetadata } from "#metadata/manage.ts";
import { Calc, Console, FolderModel, TextModel } from "#globals";
import { List } from "#utils/depUtils.ts";

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

function getMetadataExpr() {
  return Calc.controller.getItemModel(ID_METADATA);
}

export function getMetadata() {
  const expr = getMetadataExpr();
  if (expr === undefined) return getBlankMetadata();
  if (expr.type === "text" && expr.text !== undefined) {
    const parsed = JSON.parse(expr.text);
    return migrateToLatest(parsed);
  }
  Console.warn("Invalid dsm-metadata. Ignoring");
  return getBlankMetadata();
}

function addItemToEnd(
  state: Omit<FolderModel, "index"> | Omit<TextModel, "index">
) {
  Calc.controller._addItemToEndFromAPI(Calc.controller.createItemModel(state));
}

export function setMetadata(metadata: Metadata) {
  cleanMetadata(metadata);
  List.removeItemById(Calc.controller.listModel, ID_METADATA);
  List.removeItemById(Calc.controller.listModel, ID_METADATA_FOLDER);
  if (!isBlankMetadata(metadata)) {
    addItemToEnd({
      type: "folder",
      id: ID_METADATA_FOLDER,
      secret: true,
      title: "DesModder Metadata",
    });
    addItemToEnd({
      type: "text",
      id: ID_METADATA,
      folderId: ID_METADATA_FOLDER,
      text: JSON.stringify(metadata),
    });
  }
}

function cleanMetadata(metadata: Metadata) {
  /* Mutates metadata by removing expressions that no longer exist */
  for (const id in metadata.expressions) {
    if (Calc.controller.getItemModel(id) === undefined) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete metadata.expressions[id];
    }
  }
}
