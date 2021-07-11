import * as t from "@babel/types";
import { DependencyNameMap } from "./withDependencyMap";

export default function withinExport(
  exportedFunction: string,
  dependencyNameMap: DependencyNameMap,
  atExportedFunction: (func: t.FunctionExpression) => t.Expression | undefined
) {
  /* Looks for exports.[exportedFunction] = function(...) {...} 
  and calls `atExportedFunction` on the RHS. If `atExportedFunction` returns a node,
  then it is assigned to replace the RHS */
  return {
    AssignmentExpression(path: babel.NodePath<t.AssignmentExpression>) {
      const lhs = path.node.left;
      if (
        t.isMemberExpression(lhs) &&
        t.isIdentifier(lhs.object, {
          name: dependencyNameMap["exports"].name,
        }) &&
        t.isIdentifier(lhs.property, { name: exportedFunction }) &&
        // want to avoid replacing within the exports.exp1 = exports.exp2 = ... = void 0
        t.isFunctionExpression(path.node.right)
      ) {
        const result = atExportedFunction(path.node.right);
        if (result !== undefined) {
          path.node.right = result;
        }
      }
    },
  };
}
