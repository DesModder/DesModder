import Metadata from "./interface";
import { getBlankMetadata } from "./manage";
import migrate1to2 from "./migrations/migrate1to2";

export default function migrateToLatest(metadata: any): Metadata {
  return migrateToLatestMaybe(metadata) ?? getBlankMetadata();
}

export function migrateToLatestMaybe(metadata: any): Metadata | undefined {
  if ("pinnedExpressions" in metadata) {
    /* Discriminate version 1 by using the presence of the pinnedExpressions
    property (it was the only property) */
    metadata = migrate1to2(metadata);
  }
  if (metadata.version !== 2) {
    // Something went wrong with migration. Just return a blank metadata
    return undefined;
  }
  if (
    !("expressions" in metadata) ||
    typeof metadata.expressions !== "object"
  ) {
    return undefined;
  }
  return metadata;
}
