import Aug from "./AugState";
import { isFactorialBang } from "./augToRaw";

export default function augNeedsParens(
  node: Aug.Latex.AnyChild,
  parent: Aug.Latex.AnyRootOrChild | null,
  path: string | undefined
): boolean {
  if (node.type === "Seq") return node.parenWrapped;

  if (parent === null) return false;

  switch (parent.type) {
    case "Integral":
      return false;
    case "ListAccess":
      return path === "list";
    case "DotAccess":
    case "OrderedPairAccess":
      return path === "object";
    case "RepeatedOperator":
      return path === "term";
    case "BinaryOperator":
      if (parent.name === "Exponent" && path === "right") return false;
      return power(node) <= power(parent);
    case "Negative":
      if (node.type === "Constant" && node.value > 0) return false;
      return power(node) <= power(parent);
    case "FunctionCall":
      return path === "factorial";
  }

  switch (node.type) {
    case "Derivative":
      return true;
    case "Substitution":
      return true;
  }

  return false;
}

const _precedence = [
  "top",
  "seq",
  "update",
  "with",
  "compare",
  "add",
  "multiply",
  "prefix",
  "factorial",
  "power",
  "index",
  "call",
  "bottom",
] as const;
const _precIndices = _precedence.map((op, index) => [op, index] as const);
const POWERS = Object.fromEntries(_precIndices) as Record<
  (typeof _precedence)[number],
  number
>;

// Don't worry about left vs right precedence for now. Err on the side of more parens.
function power(node: Aug.Latex.AnyChild): number {
  switch (node.type) {
    case "Constant":
      return node.value < 0 ? POWERS.prefix : POWERS.bottom;
    case "Identifier":
    case "List":
    case "Range":
    case "ListComprehension":
    case "Piecewise":
      return POWERS.bottom;
    case "FunctionCall":
      return isFactorialBang(node.callee, node.args)
        ? POWERS.factorial
        : POWERS.call;
    case "Prime":
      return POWERS.call;
    case "ListAccess":
    case "DotAccess":
    case "OrderedPairAccess":
      return POWERS.index;
    case "Negative":
      return POWERS.prefix;
    case "BinaryOperator":
      switch (node.name) {
        case "Exponent":
          return POWERS.power;
        case "Multiply":
          return POWERS.multiply;
        case "Divide":
          return POWERS.bottom;
        case "Add":
        case "Subtract":
          return POWERS.add;
      }
    // eslint-disable-next-line no-fallthrough
    case "Integral":
    case "Derivative":
    case "RepeatedOperator":
      return POWERS.multiply;
    case "UpdateRule":
      return POWERS.update;
    case "Comparator":
    case "DoubleInequality":
    case "AssignmentExpression":
      return POWERS.compare;
    case "Seq":
      return POWERS.seq;
    case "Substitution":
      return POWERS.with;
    default:
      node satisfies never;
      throw new Error(`Programming Error: Node type ${(node as any).type}`);
  }
}
