import Metadata, { Expression } from "./interface";

export const ID_METADATA = "dsm-metadata";
export const ID_METADATA_FOLDER = "dsm-metadata-folder";

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

/**
 * Mutate `metadata.expressions[id]` by inserting `obj`.
 * Default values are deleted.
 */
export function changeExprInMetadata(
  metadata: Metadata,
  id: string,
  obj: Partial<Expression>
) {
  const changed = metadata.expressions[id] ?? {};
  for (const _key in obj) {
    const key = _key as keyof Expression;
    const value = obj[key];
    if (value !== getDefaultValue(key)) {
      changed[key] = value;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete changed[key];
    }
  }
  if (Object.keys(changed).length === 0) {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete metadata.expressions[id];
  } else {
    metadata.expressions[id] = changed;
  }
}

/**
 * Mutate `target` by inserting the metadata from `source`.
 */
export function mergeMetadata(target: Metadata, source: Metadata) {
  for (const [id, obj] of Object.entries(source.expressions)) {
    if (!obj) continue;
    changeExprInMetadata(target, id, obj);
  }
}

/** Create a new metadata by replacing all IDs `from` with `oldIdToNewId[from]`. */
export function metadataWithIdsMapped(
  oldMetadata: Metadata,
  oldIdToNewId: Map<string, string>
) {
  const out = getBlankMetadata();
  for (const [id, value] of Object.entries(oldMetadata.expressions)) {
    out.expressions[oldIdToNewId.get(id) ?? id] = value;
  }
  return out;
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
