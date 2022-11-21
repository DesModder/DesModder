import Node, { ChildExprNode } from "./parsenode";

export class Path<n extends Node = Node> {
  constructor(
    public node: n,
    public parent: Path | null,
    public index: number
  ) {}

  getChildren() {
    switch (this.node.type) {
      case "Assignment":
      case "FunctionDefinition":
        return [this.node._expression];
      case "Regression":
      case "Equation":
        return [this.node._lhs, this.node._rhs];
      case "Error":
        return [];
      case "DoubleInequality":
        if ("args" in this.node) {
          return [this.node.args[0], this.node.args[2], this.node.args[4]];
        }
      // fallthrough
      default: {
        if ("args" in this.node) {
          return this.node.args as ChildExprNode[];
        }
        const type = (this.node as any).type;
        throw Error(`Unexpected node type: ${type}. How did you obtain it?`);
      }
    }
  }
}

interface Callbacks {
  enter?: (path: Path) => void;
  exit?: (path: Path) => void;
}

export default function traverse(node: Node, callbacks: Callbacks) {
  traversePath(new Path(node, null, 0), callbacks);
}

function traversePath(path: Path, callbacks: Callbacks) {
  callbacks.enter?.(path);
  const children = path.getChildren();
  for (let i = 0; i < children.length; i++) {
    traversePath(new Path(children[i], path, i), callbacks);
  }
  callbacks.exit?.(path);
}
