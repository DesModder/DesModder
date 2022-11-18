import template from "@babel/template";
import * as t from "@babel/types";

export default () => ({
  MemberExpression(path: babel.NodePath<t.MemberExpression>) {
    /* @plugin video-creator
    
    @what Get access to the top level components: the stuff in the wrapper shell
      around the calculator, including the graph title.

    @how

    In
      var r = InstantiateTopLevelComponents({...),
        C = r.Calc,
        k = C._calc.controller;
    Replace
        C = r.Calc
    With
        C = (window._topLevelComponents = r).Calc
     */
    if (
      t.isIdentifier(path.node.property, { name: "Calc" }) &&
      t.isIdentifier(path.node.object)
    ) {
      path.get("object").replaceWith(
        template.expression(
          `window._topLevelComponents = %%topLevelComponents%%`
        )({
          topLevelComponents: path.node.object,
        })
      );
      path.stop();
    }
  },
});
