import * as t from "@babel/types";
import template from "@babel/template";
import { findIdentifierThis } from "preload/moduleUtils";
import { DependencyNameMap } from "preload/withDependencyMap";

export default (dependencyNameMap: DependencyNameMap) => ({
  ObjectProperty(path: babel.NodePath<t.ObjectProperty>) {
    /* @plugin hide-errors
      Wrap the error message tooltipped-error with a div, using
      onTap to trigger hiding/showing the error. */
    if (
      t.isIdentifier(path.node.key, { name: "error" }) &&
      path.node.value.type === "FunctionExpression"
    ) {
      path.node.value = template.expression(
        `() => %%DCGView%%.createElement(
          "div",
          {
            onTap: () => window.DesModder.controller.toggleErrorHidden(%%this%%.model.id),
            style: () => (
              window.DesModder.controller.isErrorHidden(%%this%%.model.id)
                ? "opacity: 0.5"
                : ""
              )
          },
          (%%tooltippedError%%)()
        )`
      )({
        DCGView: dependencyNameMap.dcgview,
        tooltippedError: path.node.value,
        this: findIdentifierThis(path),
      });
    }
  },
});
