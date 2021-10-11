import * as t from "@babel/types";
import template from "@babel/template";

export default () => ({
  CallExpression(path: babel.NodePath<t.CallExpression>) {
    /* @plugin pin-expressions
    
    Allows clicking on the pin/unpin button for notes and tables */
    if (
      t.isMemberExpression(path.node.callee) &&
      t.isIdentifier(path.node.callee.property, {
        name: "exitEditListMode",
      })
    ) {
      path.replaceWith(
        // using .closest handles the case where the user clicks directly on the (child/::before) icon instead of the padding
        template.expression(
          `%%t%%.target.closest(".dsm-stay-edit-list-mode") || %%callExit%%`
        )({
          callExit: path.node,
          t: path.getFunctionParent()?.node.params[0],
        })
      );
      // don't want to recurse on the inner copy of path.node
      path.skip();
    }
  },
});
