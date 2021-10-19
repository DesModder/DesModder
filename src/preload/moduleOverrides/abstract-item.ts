import template from "@babel/template";
import withinFunctionAssignment from "../overrideHelpers/withinFunctionAssignment";

export default () =>
  /* @plugin pinned-expressions
  
  @what Disable pinned expressions from appearing in the unpinned section
  Might break tours/base_tour or expressions hidden inside folders
  
  @how Completely rewrites getDisplayState(e) to also set an item as hidden if it is pinned
  */
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
