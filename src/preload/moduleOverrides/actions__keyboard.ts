import template from "@babel/template";
import * as t from "@babel/types";

export default () => ({
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
