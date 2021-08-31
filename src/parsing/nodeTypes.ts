import { AnyNode } from "./parsenode";

export function satisfiesType<T extends string>(
  node: AnyNode,
  type: T
): node is AnyNode & { type: T } {
  // navigate up prototype tree
  // we need this because we can't instanceof very easily
  if (node.type === type) {
    return true;
  } else {
    const proto = Object.getPrototypeOf(node);
    return proto && satisfiesType(proto, type);
  }
}
