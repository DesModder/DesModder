import * as t from "@babel/types";
import template from "@babel/template";
import { DependencyNameMap } from "preload/withDependencyMap";

export default (dependencyNameMap: DependencyNameMap) => ({
  LogicalExpression(path: babel.NodePath<t.LogicalExpression>) {
    /* @plugin shift-enter-newline
    
      convert `n !== Keys.ENTER || e.metaKey`
      to `n !== Keys.ENTER || e.metaKey || e.shiftKey` */
    if (
      t.isBinaryExpression(path.node.left) &&
      t.isMemberExpression(path.node.right) &&
      t.isIdentifier(path.node.right.property, { name: "metaKey" })
    ) {
      path.node.right = template.expression.ast`e.metaKey || e.shiftKey`;
      // don't want to recurse
      path.skip();
    }
  },
});
