import workerSrcUnderlying from "./moduleOverrides/text__worker_src_underlying";
import { DependencyNameMap } from "./overrideHelpers/withDependencyMap";
import { Visitor } from "@babel/traverse";

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
export default {
  "text!worker_src_underlying": workerSrcUnderlying,
} as { [key: string]: (dependencyNameMap: DependencyNameMap) => Visitor };
