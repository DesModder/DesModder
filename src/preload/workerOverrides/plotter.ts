import * as t from "@babel/types";
import template from "@babel/template";

export default () => ({
  CallExpression(path: babel.NodePath<t.CallExpression>) {
    /* @plugin glesmos

    @what Disable calculation of implicits when unwanted
    */
    if (
      t.isMemberExpression(path.node.callee) &&
      t.isIdentifier(path.node.callee.property, { name: "sampleImplicit" })
    ) {
      path.replaceWith(
        template.expression.ast(
          `{
            fillSegments: [],
            segments: [],
            resolved: false,
          }`
        )
      );
      path.skip();
    }
  },
});
