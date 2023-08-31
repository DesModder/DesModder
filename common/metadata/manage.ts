import Metadata, { Expression } from "./interface";

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

export function changeExprInMetadata(
  metadata: Metadata,
  id: string,
  obj: Partial<Expression>
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
