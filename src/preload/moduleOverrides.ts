import listView from "./moduleOverrides/list-view";
import mainEvaluator from "./moduleOverrides/main__evaluator";
import workerSrcUnderlying from "./moduleOverrides/text__worker_src_underlying";
import tooltippedError from "./moduleOverrides/tooltipped-error";
import { DependencyNameMap } from "./overrideHelpers/withDependencyMap";
import { Visitor } from "@babel/traverse";

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
export default {
  "dcgview-helpers/tooltipped-error": tooltippedError,
  "expressions/list-view": listView,
  "text!worker_src_underlying": workerSrcUnderlying,
  "main/evaluator": mainEvaluator,
} as { [key: string]: (dependencyNameMap: DependencyNameMap) => Visitor };
