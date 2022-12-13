import template from "@babel/template";
import * as t from "@babel/types";

export default () => ({
  MemberExpression(path: babel.NodePath<t.MemberExpression>) {
    /* @plugin video-creator
    
    @what Get access to the top level components: the stuff in the wrapper shell
      around the calculator, including the graph title.

    @how

    In
      var C = InstantiateTopLevelComponents({...}),
        // some lines omitted
        I = C.userController,
    Replace
        I = C.userController
    With
        I = (window._topLevelComponents = C).userController
     */
    if (
      t.isIdentifier(path.node.property, { name: "userController" }) &&
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
