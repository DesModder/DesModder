import * as t from "@babel/types";
import template from "@babel/template";

export default () => ({
  /* @plugin debug-mode
  Replace expression index with expression id.
  This gets applied to expression_view, image-view, table-view, text_view, and folder-view */
  MemberExpression(path: babel.NodePath<t.MemberExpression>) {
    if (t.isIdentifier(path.node.property, { name: "displayIndex" })) {
      path.replaceWith(
        template.expression(
          `window.DesModder?.controller?.isPluginEnabled("debug-mode")
            ? %%model%%.id.length <= 6
              ? %%model%%.id
              : %%model%%.id.substring(0, 4) + "…"
            : %%model%%.displayIndex`
        )({
          model: path.node.object,
        })
      );
      path.skip();
    }
  },
});
