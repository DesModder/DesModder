/* eslint-disable @typescript-eslint/no-dynamic-delete */
import Metadata, { Expression } from "./interface";
import migrateToLatest from "./migrate";
import { ItemModel } from "globals/models";
import { Calc } from "globals/window";
import { List } from "utils/depUtils";
import { OptionalProperties } from "utils/utils";

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
  console.warn("Invalid dsm-metadata. Ignoring");
  return getBlankMetadata();
}

function addItemToEnd(state: ItemModel) {
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

export function getBlankMetadata(): Metadata {
  return {
    version: 2,
    expressions: {},
  };
}

export function isBlankMetadata(metadata: Metadata) {
  return (
    Object.keys(metadata.expressions).length === 0 &&
    Object.keys(metadata).length === 2
  );
}

function cleanMetadata(metadata: Metadata) {
  /* Mutates metadata by removing expressions that no longer exist */
  for (const id in metadata.expressions) {
    if (Calc.controller.getItemModel(id) === undefined) {
      delete metadata.expressions[id];
    }
  }
}

export function changeExprInMetadata(
  metadata: Metadata,
  id: string,
  obj: OptionalProperties<Expression>
) {
  /* Mutates metadata by spreading obj into metadata.expressions[id],
  with default values deleted */
  const changed = metadata.expressions[id] ?? {};
  for (const _key in obj) {
    const key = _key as keyof Expression;
    const value = obj[key];
    if (value !== getDefaultValue(key)) {
      changed[key] = value;
    } else {
      delete changed[key];
    }
  }
  if (Object.keys(changed).length === 0) {
    delete metadata.expressions[id];
  } else {
    metadata.expressions[id] = changed;
  }
}

function getDefaultValue(key: keyof Expression) {
  switch (key) {
    case "pinned":
    case "errorHidden":
    case "glesmos":
    case "glesmosLinesConfirmed":
      return false;
    default: {
      const _exhaustive: never = key;
      return _exhaustive;
    }
  }
}
