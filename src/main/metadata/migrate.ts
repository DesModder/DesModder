import migrate1to2 from "./migrations/migrate1to2";
import Metadata from "./interface";

export default function migrateToLatest(metadata: any): Metadata {
  if ("pinnedExpressions" in metadata) {
    /* Discriminate version 1 by using the presence of the pinnedExpressions
    property (it was the only property) */
    metadata = migrate1to2(metadata);
  }
  return metadata;
}
