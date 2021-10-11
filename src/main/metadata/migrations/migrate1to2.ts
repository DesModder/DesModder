import Metadata from "../interface";

interface MetadataV1 {
  pinnedExpressions?: string[];
}

export default function migrate1to2(state: MetadataV1): Metadata {
  const stateOut = {
    version: 2 as const,
    expressions: {},
  } as Metadata;
  for (let pinnedID of state.pinnedExpressions ?? []) {
    stateOut.expressions[pinnedID] = {
      pinned: true,
    };
  }
  return stateOut;
}
