import { DependencyNameMap } from "./overrideHelpers/withDependencyMap";
import { Visitor } from "@babel/traverse";
import plotter from "./workerOverrides/plotter";

export default {
  "core/math/plotter": plotter,
} as { [key: string]: (dependencyNameMap: DependencyNameMap) => Visitor };
