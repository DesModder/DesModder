import * as t from "@babel/types";

export function findIdentifierThis(path: babel.NodePath): t.Identifier | null {
  /* Didn't figure out path.scope, so ...
  Hopes that a statement like `var e = this` is the start of a function parent of `path`
  Returns the identifier `e` */
  let func = path.getFunctionParent();
  while (func !== null) {
    let body = func.node.body;
    if (t.isBlockStatement(body)) {
      for (let statement of body.body) {
        if (t.isVariableDeclaration(statement)) {
          for (let decl of statement.declarations) {
            if (t.isThisExpression(decl.init) && t.isIdentifier(decl.id)) {
              return decl.id;
            }
          }
        }
      }
    }
    func = func.getFunctionParent();
  }
  return null;
}

export function containingCreateElementCall(path: babel.NodePath) {
  return path.findParent(
    (path) =>
      path.isCallExpression() &&
      t.isMemberExpression(path.node.callee) &&
      t.isIdentifier(path.node.callee.property, { name: "createElement" })
  ) as babel.NodePath<t.CallExpression> | null;
}
