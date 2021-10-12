import * as t from "@babel/types";
import template from "@babel/template";

export default () => ({
  LogicalExpression(path: babel.NodePath<t.LogicalExpression>) {
    /* @plugin shift-enter-newline

    @what Change shift-enter to insert a newline
    
    @how
      Replace
        n !== Keys.ENTER || e.metaKey
      with
        n !== Keys.ENTER || e.metaKey || e.shiftKey
      
      This leads to
        n !== Keys.ENTER || e.metaKey || e.shiftKey
          ? ...
          : (e.preventDefault(), this.props.onSpecialKey("Enter"))
      When shift-enter is pressed, the first branch is taken instead of the second,
      so `this.props.onSpecialKey("Enter")` is not triggered, and the cursor
      does not move to the next expression.
    */
    if (
      t.isBinaryExpression(path.node.left) &&
      t.isMemberExpression(path.node.right) &&
      t.isIdentifier(path.node.right.property, { name: "metaKey" })
    ) {
      path.node.right = template.expression.ast`e.metaKey || e.shiftKey`;
      // don't want to recurse
      path.skip();
    }
  },
});
