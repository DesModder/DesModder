import { DependencyNameMap } from "./overrideHelpers/withDependencyMap";
import { Visitor } from "@babel/traverse";
import plotter from "./workerOverrides/plotter";
import statementanalysis from "./workerOverrides/statementanalysis";
import featuresGraph from "./workerOverrides/features__graph";

export default {
  "core/math/plotter": plotter,
  "core/math/statementanalysis": statementanalysis,
  "core/math/features/graph": featuresGraph,
} as { [key: string]: (dependencyNameMap: DependencyNameMap) => Visitor };
