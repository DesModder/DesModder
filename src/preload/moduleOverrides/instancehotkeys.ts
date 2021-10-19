import * as t from "@babel/types";

export default () => ({
  Identifier(path: babel.NodePath<t.Identifier>) {
    /* @plugin find-replace
    
    @what Allow find-replace to appear, even if the expression list is not focused
    
    @how
      Replaces
        this.controller.isExpressionListFocused() &&
          (this.controller.dispatch({ type: "open-expression-search" }), ...
      with just the right side of the `&&`:
        (this.controller.dispatch({ type: "open-expression-search" }), ...
    */
    if (path.node.name === "isExpressionListFocused") {
      const andPath = path.findParent((p) =>
        p.isLogicalExpression()
      ) as babel.NodePath<t.LogicalExpression> | null;
      andPath?.replaceWith(andPath.node.right);
    }
  },
});
