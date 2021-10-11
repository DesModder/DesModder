import template from "@babel/template";
import { DependencyNameMap } from "preload/withDependencyMap";
import withinFunctionAssignment from "preload/withinFunctionAssignment";

export default (dependencyNameMap: DependencyNameMap) =>
  /* @plugin pinned-expressions
  Disable pinned expressions from appearing in the unpinned section
  Might break tours/base_tour or expressions hidden inside folders */
  withinFunctionAssignment(
    "getDisplayState",
    () => template.expression.ast`function (e) {
        return e.isHiddenFromUI || e.filteredBySearch || window.DesModder?.controller?.isPinned(e.id)
          ? "none"
          : e.renderShell
          ? "shell"
          : "render";
      }`
  );
