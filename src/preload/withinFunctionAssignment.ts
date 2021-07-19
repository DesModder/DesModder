import * as t from "@babel/types";

export default function withinFunctionAssignment(
  functionName: string,
  atFunctionDefinition: (func: t.FunctionExpression) => t.Expression | void
) {
  /* Looks for someObject.[functionName] = function (...) {...}
  and calls `atFunctionDefinition` on the RHS function. If `atFunctionDefinition`
  returns a node, then it is assigned to replace the RHS function*/
  return {
    AssignmentExpression(path: babel.NodePath<t.AssignmentExpression>) {
      const lhs = path.node.left;
      if (
        t.isMemberExpression(lhs) &&
        t.isIdentifier(lhs.property, { name: functionName }) &&
        t.isFunctionExpression(path.node.right)
      ) {
        const result = atFunctionDefinition(path.node.right);
        if (result !== undefined) {
          path.node.right = result;
        }
      }
    },
  };
}
