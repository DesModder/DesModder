import replaceTopLevelDelete from "./partials/replaceTopLevelDelete";
import replaceDisplayIndex from "./partials/replaceDisplayIndex";
import { DependencyNameMap } from "../overrideHelpers/withDependencyMap";

export default (dependencyNameMap: DependencyNameMap) => ({
  /* Applies to image-view, table-view, and text_view */
  ...replaceTopLevelDelete(dependencyNameMap),
  ...replaceDisplayIndex(),
});
