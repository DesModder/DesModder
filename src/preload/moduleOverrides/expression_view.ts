import { DependencyNameMap } from "../overrideHelpers/withDependencyMap";
import replaceDisplayIndex from "./partials/replaceDisplayIndex";
import replaceTopLevelDelete from "./partials/replaceTopLevelDelete";

export default (dependencyNameMap: DependencyNameMap) => ({
  ...replaceTopLevelDelete(dependencyNameMap),
  ...replaceDisplayIndex(),
});
