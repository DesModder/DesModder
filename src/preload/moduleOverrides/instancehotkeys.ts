import * as t from "@babel/types";

export default () => ({
  Identifier(path: babel.NodePath<t.Identifier>) {
    /* Allow find-replace to appear, even if the expression list is not focused */
    if (path.node.name === "isExpressionListFocused") {
      const andPath = path.findParent((p) =>
        p.isLogicalExpression()
      ) as babel.NodePath<t.LogicalExpression> | null;
      andPath?.replaceWith(andPath.node.right);
    }
  },
});
