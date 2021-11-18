import { DependencyNameMap } from "./overrideHelpers/withDependencyMap";
import { Visitor } from "@babel/traverse";
import featuresGraph from "./workerOverrides/features__graph";

export default {
  "core/math/features/graph": featuresGraph,
} as { [key: string]: (dependencyNameMap: DependencyNameMap) => Visitor };
