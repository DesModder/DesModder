import Node, { ChildExprNode } from "./parsenode";

class Path<n extends Node = Node> {
  shouldSkip = false;
  constructor(
    public node: n,
    public parent: Path | null,
    public index: number
  ) {}

  skip() {
    this.shouldSkip = true;
  }

  getChildren() {
    if ("args" in this.node) {
      return this.node.args as ChildExprNode[];
    }
    switch (this.node.type) {
      case "Assignment":
      case "FunctionDefinition":
        return [this.node._expression];
      case "Regression":
      case "Equation":
        return [this.node._lhs, this.node._rhs];
      case "Error":
        return [];
      default:
        const type = (this.node as any).type;
        throw `Unexpected node type: ${type}. How did you obtain it?`;
    }
  }
}

interface Callbacks {
  enter?(path: Path): void;
  exit?(path: Path): void;
}

export default function traverse(node: Node, callbacks: Callbacks) {
  traversePath(new Path(node, null, 0), callbacks);
}

function traversePath(path: Path, callbacks: Callbacks) {
  callbacks.enter?.(path);
  if (!path.shouldSkip) {
    const children = path.getChildren();
    for (let i = 0; i < children.length; i++) {
      traversePath(new Path(children[i], path, i), callbacks);
    }
  }
  callbacks.exit?.(path);
}

(window as any).traverse = traverse;

/*
// sample code to replace all `t` identifiers with `u`.
{
  const s = String.raw`t^2+2t+[1...5][t]`;
  const node = require("core/math/baseparser").parse(s);
  traverse(node, {
    enter: (path) => {
      if (path.node.type === "Identifier" && path.node._symbol === "t") {
        path.node._symbol = "u";
      }
    },
  });
  console.log(node.printLatex());
}
*/
