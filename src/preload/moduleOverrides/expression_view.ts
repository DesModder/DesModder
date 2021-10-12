import * as t from "@babel/types";
import template from "@babel/template";
import replaceTopLevelDelete from "./partials/replaceTopLevelDelete";
import replaceDisplayIndex from "./partials/replaceDisplayIndex";
import { DependencyNameMap } from "../overrideHelpers/withDependencyMap";

export default (dependencyNameMap: DependencyNameMap) => ({
  ...replaceTopLevelDelete(dependencyNameMap),
  ...replaceDisplayIndex(),

  AssignmentExpression(path: babel.NodePath<t.AssignmentExpression>) {
    /* @plugin hide-errors
    
    @what Disable slider creation prompt if error is hidden
    
    @how 
      Replaces
        shouldShowSliderPrompt = function() {
          return condition
        }
      with
        shouldShowSliderPrompt = function() {
          return condition && !windowDesModder.controller.isErrorHidden(this.model?.id)
        }
    */
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
    /* @plugin hide-errors
    
    @what Allow shift-enter to create a new expression and hide errors on the old expression
    
    @how
      Adds an else clause to
        if ("Enter" === e) {
          t && (t.preventDefault(), t.stopPropagation()),
          return this.controller.dispatch({
            type: "on-special-key-pressed",
            key: "Enter",
          })
        }
      specifically
        else if ("Shift-Enter" === e) {
          window.DesModder.controller.hideError(this.model.id);
          this.controller.dispatch({
            type: "on-special-key-pressed",
            key: "Enter"
          })
          return;
        }
    */
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
