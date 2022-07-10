import * as t from "@babel/types";

export default () => ({
  Identifier(path: babel.NodePath<t.Identifier>) {
    /* @plugin find-replace
    
    @what Allow find-replace to appear, even if the expression list is not focused
    
    @how
      Replaces
        this.controller.isExpressionListFocused()
      with `true`
    */
    if (path.node.name === "isExpressionListFocused") {
      const callPath = path.findParent((p) =>
        p.isCallExpression()
      ) as babel.NodePath<t.CallExpression> | null;
      callPath?.replaceWith(t.booleanLiteral(true));
    }
  },
});
