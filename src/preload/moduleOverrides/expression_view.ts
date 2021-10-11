import * as t from "@babel/types";
import template from "@babel/template";
import replaceTopLevelDelete from "./partials/replaceTopLevelDelete";
import replaceDisplayIndex from "./partials/replaceDisplayIndex";
import { DependencyNameMap } from "preload/withDependencyMap";

export default (dependencyNameMap: DependencyNameMap) => ({
  ...replaceTopLevelDelete(dependencyNameMap),
  ...replaceDisplayIndex(),

  /* AssignmentExpression and IfStatement are from hide-errors/moduleOverrides.
    This needs to be refactored, see #227 */
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
  IfStatement(path: babel.NodePath<t.IfStatement>) {
    /* Allow shift-enter to create a new expression and hide errors on the old expression */
    if (
      t.isBinaryExpression(path.node.test, { operator: "===" }) &&
      t.isStringLiteral(path.node.test.left, { value: "Enter" })
    ) {
      /* There was previously no alternate */
      path.node.alternate = template.statement(`if ("Shift-Enter" === e) {
          window.DesModder.controller.hideError(this.model.id);
           this.controller.dispatch({
            type: "on-special-key-pressed",
            key: "Enter"
          })
          return;
        }`)();
    }
  },
});
