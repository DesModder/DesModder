import * as t from "@babel/types";
import template from "@babel/template";

export default () => ({
  CallExpression(path: babel.NodePath<t.CallExpression>) {
    /* @plugin pin-expressions
    
    @what Prevent the down arrow from creating a new last item when pressing down from the bottom-most pinned expression
    
    @how
      Replaces
          !List.selectNextItem(e.getListModel())
      with
        !(window.DesModder?.controller?.isPinned(e.getSelectedItem().id) + List.selectNextItem(e.getListModel()))
    */
    if (
      t.isMemberExpression(path.node.callee) &&
      t.isIdentifier(path.node.callee.property, { name: "selectNextItem" })
    ) {
      path.replaceWith(
        template.expression(
          `window.DesModder?.controller?.isPinned(%%e%%.getSelectedItem().id) + %%callSelectNextItem%%`
        )({
          callSelectNextItem: path.node,
          e: path.getFunctionParent()?.node.params[0],
        })
      );
      path.skip();
    }
  },
  ReturnStatement(path: babel.NodePath<t.ReturnStatement>) {
    /* @plugin hide-errors

    @what Prevent enter/shift-enter from creating sliders
    
    @how
      Replaces
          if (cond) { e.createSlidersForItem(...) }
      with
          if (cond && !window.Desmodder.controller.isErrorHidden(l.id)) { e.createSlidersForItem(...) }
    */
    const returned = path.node.argument;
    if (
      returned &&
      t.isCallExpression(returned) &&
      t.isMemberExpression(returned.callee) &&
      t.isIdentifier(returned.callee.property, {
        name: "createSlidersForItem",
      })
    ) {
      const ifStatement = path.parentPath;
      const itemModelIf = ifStatement.parentPath?.parentPath?.node;
      if (t.isIfStatement(ifStatement.node) && t.isIfStatement(itemModelIf)) {
        ifStatement.node.test = template.expression(
          `%%oldCondition%% && !window.DesModder.controller.isErrorHidden(%%itemModel%%.id)`
        )({
          oldCondition: ifStatement.node.test,
          itemModel: itemModelIf.test,
        });
      }
    }
  },
});
