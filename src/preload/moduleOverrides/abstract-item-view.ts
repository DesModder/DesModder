import template from "@babel/template";
import * as t from "@babel/types";

export default () => ({
  CallExpression(path: babel.NodePath<t.CallExpression>) {
    /* @plugin pin-expressions
    @plugin folder-tools
    
    @what Allows clicking on the pin/unpin button for notes and tables, without exiting edit-list-mode.
      This also allows clicking on the duplicate and delete button for non-expressions
      The class "dsm-stay-edit-list-mode" is added in expression-edit-actions.ts
    
    @how
      Replaces
        this.exitEditListMode()
      with
        (event.target.closest(".dsm-stay-edit-list-mode") || this.exitEditListMode())
    */
    if (
      t.isMemberExpression(path.node.callee) &&
      t.isIdentifier(path.node.callee.property, {
        name: "exitEditListMode",
      })
    ) {
      path.replaceWith(
        // using .closest handles the case where the user clicks directly on the (child/::before)
        // icon instead of the padding
        template.expression(
          `%%event%%.target.closest(".dsm-stay-edit-list-mode") || %%callExit%%`
        )({
          callExit: path.node,
          event: path.getFunctionParent()?.node.params[0],
        })
      );
      // don't want to recurse on the inner copy of path.node
      path.skip();
    }
  },
});
