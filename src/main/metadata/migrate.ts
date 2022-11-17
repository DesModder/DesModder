import Metadata from "./interface";
import migrate1to2 from "./migrations/migrate1to2";

export default function migrateToLatest(metadata: any): Metadata {
  if ("pinnedExpressions" in metadata) {
    /* Discriminate version 1 by using the presence of the pinnedExpressions
    property (it was the only property) */
    metadata = migrate1to2(metadata);
  }
  if (metadata.version !== 2) {
    // Something went wrong with migration. Just return a blank metadata
    return {
      version: 2,
      expressions: {},
    };
  }
  return metadata;
}
