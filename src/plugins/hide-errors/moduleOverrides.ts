import * as t from "@babel/types";
import template from "@babel/template";
import withDependencyMap from "preload/withDependencyMap";
import { findIdentifierThis } from "preload/moduleUtils";

const moduleOverrides = {
  "dcgview-helpers/tooltipped-error": withDependencyMap(() => ({
    ObjectExpression(path: babel.NodePath<t.ObjectExpression>) {
      /* Remove `targetClickBehavior: this.const('stick')` because we will override click.
      The default targetClickBehavior is to show the entire tooltip on hover, with no
      difference on click. */
      path.node.properties = path.node.properties.filter(
        (prop) =>
          !t.isObjectProperty(prop) ||
          !t.isIdentifier(prop.key, { name: "targetClickBehavior" })
      );
    },
  })),
  "expressions/expression-icon-view": withDependencyMap(
    (dependencyNameMap) => ({
      ObjectProperty(path: babel.NodePath<t.ObjectProperty>) {
        /* Wrap the error message tooltipped-error with a div, using
        onTap to trigger hiding/showing the error. */
        if (
          t.isIdentifier(path.node.key, { name: "error" }) &&
          path.node.value.type === "FunctionExpression"
        ) {
          path.node.value =
            template.expression(`() => %%DCGView%%.createElement(
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
            )`)({
              DCGView: dependencyNameMap.dcgview,
              tooltippedError: path.node.value,
              this: findIdentifierThis(path),
            });
        }
      },
    })
  ),
};
export default moduleOverrides;
