import * as t from "@babel/types";
import template from "@babel/template";

export default () => ({
  CallExpression(path: babel.NodePath<t.CallExpression>) {
    /* @plugin glesmos

    @what Replace main renderer with glesmos rendering when necessary

    @how
      Replace
        A.drawSketchToCtx(r[id], ...rest)
      with
        window.DesModder?.controller?.isGlesmosMode(id)
          ? window.DesModder?.controller?.drawGlesmosSketchToCtx(id)
          : A.drawSketchToCtx(r[id], ...rest)
    */
    if (
      t.isMemberExpression(path.node.callee) &&
      t.isIdentifier(path.node.callee.property, { name: "drawSketchToCtx" }) &&
      t.isMemberExpression(path.node.arguments[0])
    ) {
      path.replaceWith(
        template.expression(`
          window.DesModder?.controller?.isGlesmosMode?.(%%id%%)
            ? window.DesModder?.controller?.exposedPlugins["GLesmos"]
              ?.drawGlesmosSketchToCtx?.(%%id%%, %%ctx%%, %%transforms%%)
            : %%old%%
       `)({
          old: path.node,
          id: path.node.arguments[0].property,
          ctx: path.node.arguments[1],
          transforms: path.node.arguments[2],
        })
      );
      path.skip();
    }
  },
});
