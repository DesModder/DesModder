import * as t from "@babel/types";
import { DependencyNameMap } from "preload/withDependencyMap";

export default (dependencyNameMap: DependencyNameMap) => ({
  ObjectExpression(path: babel.NodePath<t.ObjectExpression>) {
    /* @plugin hide-errors
      Remove `targetClickBehavior: this.const('stick')` because we will override click.
      The default targetClickBehavior is to show the entire tooltip on hover, with no
      difference on click. */
    path.node.properties = path.node.properties.filter(
      (prop) =>
        !t.isObjectProperty(prop) ||
        !t.isIdentifier(prop.key, { name: "targetClickBehavior" })
    );
  },
});
