import * as t from "@babel/types";

export default function withinFunctionAssignment(
  functionName: string,
  atFunctionDefinition: (
    func: t.FunctionExpression,
    path: babel.NodePath<t.FunctionExpression>
    // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
  ) => t.Expression | void
) {
  /* Looks for someObject.[functionName] = function (...) {...}
  and calls `atFunctionDefinition` on the RHS function. If `atFunctionDefinition`
  returns a node, then it is assigned to replace the RHS function */
  return {
    enter(path: babel.NodePath) {
      if (path.node.type !== "AssignmentExpression") return;
      const lhs = path.node.left;
      if (
        t.isMemberExpression(lhs) &&
        t.isIdentifier(lhs.property, { name: functionName }) &&
        t.isFunctionExpression(path.node.right)
      ) {
        const result = atFunctionDefinition(
          path.node.right,
          path.get("right") as babel.NodePath<t.FunctionExpression>
        );
        if (result) {
          path.node.right = result;
        }
      }
    },
  };
}
