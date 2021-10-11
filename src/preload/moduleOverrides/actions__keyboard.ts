import * as t from "@babel/types";
import template from "@babel/template";

export default () => ({
  CallExpression(path: babel.NodePath<t.CallExpression>) {
    /* @plugin pin-expressions */
    if (
      t.isMemberExpression(path.node.callee) &&
      t.isIdentifier(path.node.callee.property, { name: "selectNextItem" })
    ) {
      /* Prevent the down arrow from creating a new last item when pressing down from the bottom-most pinned expression */
      /* Change `!List.selectNextItem(e.getListModel())`
        to !(window.DesModder?.controller?.isPinned(e.getSelectedItem().id) + List.selectNextItem(e.getListModel())) */
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
    Prevent enter/shift-enter from creating sliders */
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
