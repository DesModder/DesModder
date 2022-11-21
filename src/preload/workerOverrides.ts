import { DependencyNameMap } from "./overrideHelpers/withDependencyMap";
import featuresGraph from "./workerOverrides/features__graph";
import { Visitor } from "@babel/traverse";

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
export default {
  "core/math/features/graph": featuresGraph,
} as { [key: string]: (dependencyNameMap: DependencyNameMap) => Visitor };
