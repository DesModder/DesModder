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
  "expressions/expression_view": withDependencyMap(() => ({
    AssignmentExpression(path: babel.NodePath<t.AssignmentExpression>) {
      /* Disable slider creation prompt if error is hidden */
      if (
        t.isMemberExpression(path.node.left) &&
        t.isIdentifier(path.node.left.property, {
          name: "shouldShowSliderPrompt",
        }) &&
        t.isFunctionExpression(path.node.right) &&
        t.isBlockStatement(path.node.right.body)
      ) {
        const oldReturnStatement = path.node.right.body.body[0];
        if (t.isReturnStatement(oldReturnStatement)) {
          path.node.right = template.expression(`function () {
            return (%%oldReturn%%) && !window.DesModder.controller.isErrorHidden(this.model?.id)
          }`)({
            oldReturn: oldReturnStatement.argument,
          });
        }
      }
    },
  })),
};
export default moduleOverrides;
