import { Calc } from "globals/window";
import { ItemModel } from "globals/Calc";
import Metadata from "./interface";
import metadataSchema from "./metadata_schema.json";
import Ajv, { ValidateFunction } from "ajv";
import { desModderController } from "desmodder";

const ajv = new Ajv();
const validateMetadata = ajv.compile(
  metadataSchema
) as ValidateFunction<Metadata>;

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
  if (expr === undefined) return {};
  if (expr.type === "text" && expr.text !== undefined) {
    const parsed = JSON.parse(expr.text);
    if (validateMetadata(parsed)) {
      return parsed;
    }
  }
  console.warn("Invalid dsm-metadata. Ignoring");
  return {};
}

function addItemToEnd(state: ItemModel) {
  Calc.controller.dispatch({
    type: "add-item-to-end-from-api",
    state,
  });
}

export function setMetadata(metadata: Metadata) {
  desModderController.metadataChangeSuppressed = true;
  Calc.removeExpressions([{ id: ID_METADATA }, { id: ID_METADATA_FOLDER }]);
  if (Object.keys(metadata).length > 0) {
    // nonempty metadata, so include it in graph state
    // Calc.setExpression and Calc.setExpressions limit to expressions and tables only,
    // so we bypass them using a dispatch
    addItemToEnd({
      type: "folder",
      id: ID_METADATA_FOLDER,
      secret: true,
      title: "DesModder Metadata",
    });
    desModderController.metadataChangeSuppressed = false;
    addItemToEnd({
      type: "text",
      id: ID_METADATA,
      folderId: ID_METADATA_FOLDER,
      text: JSON.stringify(metadata),
    });
  }
}
