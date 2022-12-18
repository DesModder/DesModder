import { DependencyNameMap } from "../overrideHelpers/withDependencyMap";
import replaceTopLevelDelete from "./partials/replaceTopLevelDelete";

export default (dependencyNameMap: DependencyNameMap) => ({
  ...replaceTopLevelDelete(dependencyNameMap),
});
