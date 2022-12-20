import { DependencyNameMap } from "./overrideHelpers/withDependencyMap";
import { Visitor } from "@babel/traverse";

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
export default {} as {
  [key: string]: (dependencyNameMap: DependencyNameMap) => Visitor;
};
