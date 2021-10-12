import * as t from "@babel/types";

export default () => ({
  ObjectExpression(path: babel.NodePath<t.ObjectExpression>) {
    /* @plugin hide-errors
      
    @what Remove `targetClickBehavior: this.const('stick')`
    
    @why We override click in hide-errors. The default targetClickBehavior is to show the
      entire tooltip on hover, with no difference on click, which is what we want.
      
    @how
      Remove the "targetClickBehavior" property from the attr object in
        Dcgview.createElement(Tooltip1.Tooltip, {
          tooltip: this.props.error,
          targetClickBehavior: this.const('stick'),
          gravity: this.props.gravity
        }, ...)
    */
    path.node.properties = path.node.properties.filter(
      (prop) =>
        !t.isObjectProperty(prop) ||
        !t.isIdentifier(prop.key, { name: "targetClickBehavior" })
    );
  },
});
