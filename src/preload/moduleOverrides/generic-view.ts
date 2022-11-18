import { DependencyNameMap } from "../overrideHelpers/withDependencyMap";
import replaceDisplayIndex from "./partials/replaceDisplayIndex";
import replaceTopLevelDelete from "./partials/replaceTopLevelDelete";

export default (dependencyNameMap: DependencyNameMap) => ({
  /* Applies to image-view, table-view, and text_view */
  ...replaceTopLevelDelete(dependencyNameMap),
  ...replaceDisplayIndex(),
});
