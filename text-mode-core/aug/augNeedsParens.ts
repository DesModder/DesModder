import { Aug } from ".";

export default function augNeedsParens(
  node: Aug.Latex.AnyChild,
  parent: Aug.Latex.AnyRootOrChild | null,
  path: string | undefined
): boolean {
  if (node.type === "Seq" && node.parenWrapped) return true;
  const nodeIsLikeSub = node.type === "Substitution";
  // TODO: this might be needed for correctness. Extra thing for nodeIsLikeSub.
  // || (node.type === "ListComprehension" && !node.bracketWrapped);
  if (path === "before-comma" && nodeIsLikeSub) return true;

  if (parent === null) return false;

  switch (parent.type) {
    case "Integral":
      return path === "integrand" && power(node) <= POWERS.add;
    case "ListAccess":
      // weird, index is not threshold
      return path === "list" && power(node) < POWERS.power;
    case "DotAccess":
    case "OrderedPairAccess":
      return path === "object" && power(node) < POWERS.power;
    case "RepeatedOperator":
      return path === "term" && power(node) <= POWERS.add;
    case "Derivative":
      return power(node) <= POWERS.add;
    case "Comparator":
    case "ComparatorChain":
      return (
        power(node) <= (path === "top-level-eq" ? POWERS.top : POWERS.compare)
      );
    case "BinaryOperator":
      return binopNeedsParens(node, parent.name, path!);
    case "Negative":
      if (node.type === "Constant" && node.value > 0) return false;
      return power(node) <= POWERS.prefix;
    case "Factorial":
      return power(node) < POWERS.power;
    case "AssignmentExpression":
      return nodeIsLikeSub;
    case "ListComprehension":
    case "Substitution":
    case "UpdateRule":
      return power(node) <= POWERS.update;
    // List of things, including function args
    case "FunctionCall":
    case "Seq":
    case "Prime":
    case "Visualization":
    case "List":
    case "Piecewise":
    case "Restriction":
    case "Or": // Note "Or" can only show up as a direct child of restriction or Or.
    case "Range":
    case "Norm":
      return false;
    // Top-level cases
    case "Equation":
    case "FunctionDefinition":
    case "Regression":
    case "Assignment":
      return false;
    default:
      // Impossible cases
      parent.type satisfies "Constant" | "Identifier";
      return true;
  }
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
  "power",
  "factorial",
  "index",
  "call",
  "atom",
] as const;
const _precIndices = _precedence.map((op, index) => [op, index * 10] as const);
const POWERS = Object.fromEntries(_precIndices) as Record<
  (typeof _precedence)[number],
  number
>;

type BinopName = Aug.Latex.BinaryOperator["name"];

function binopNeedsParens(
  node: Aug.Latex.AnyChild,
  parentName: BinopName,
  path: string
) {
  const parentPower =
    path === "left" ? binopLeftPower(parentName) : binopRightPower(parentName);
  if (node.type === "BinaryOperator") {
    if (
      (node.name === "CrossMultiply" && parentName === "Multiply") ||
      // For clarity, always parenthesize multiplication in cross product or vice versa etc.
      (node.name === "Multiply" && parentName === "CrossMultiply")
    )
      return true;
  }
  return power(node) <= parentPower;
}

// This node can hold anything with power greater than (return value) on its left
function binopLeftPower(name: BinopName): number {
  // left-associative
  return name === "Divide"
    ? POWERS.top - 1
    : name === "Exponent"
      ? POWERS.power + 1
      : binopPower(name) - 1;
}

// This node can hold anything with power greater than (return value) on its right
function binopRightPower(name: BinopName): number {
  return name === "Divide" || name === "Exponent"
    ? POWERS.top - 1
    : binopPower(name);
}

function binopPower(name: BinopName): number {
  switch (name) {
    case "Exponent":
      return POWERS.power;
    case "Multiply":
    case "CrossMultiply":
      return POWERS.multiply;
    case "Divide":
      return POWERS.atom;
    case "Add":
    case "Subtract":
      return POWERS.add;
    default:
      name satisfies never;
      return POWERS.top;
  }
}

// power for inclusion in something else
function power(node: Aug.Latex.AnyChild): number {
  switch (node.type) {
    case "Constant":
      return node.value < 0 ? POWERS.prefix : POWERS.atom;
    case "Identifier":
    case "List":
    case "Range":
    case "Piecewise":
    case "Restriction":
      return POWERS.atom;
    case "ListComprehension":
      return node.bracketWrapped ? POWERS.atom : POWERS.with;
    case "Factorial":
      return POWERS.factorial;
    case "FunctionCall":
    case "Prime":
    case "Norm":
      return POWERS.call;
    case "ListAccess":
    case "DotAccess":
    case "OrderedPairAccess":
      return POWERS.index;
    case "Negative":
      return POWERS.prefix;
    case "BinaryOperator":
      return binopPower(node.name);
    case "Integral":
    case "Derivative":
    case "RepeatedOperator":
      return POWERS.multiply;
    case "UpdateRule":
      return POWERS.update;
    case "Comparator":
    case "ComparatorChain":
    case "AssignmentExpression":
      return POWERS.compare;
    case "Or":
    case "Seq":
      return POWERS.seq;
    case "Substitution":
      return POWERS.with;
    default:
      node satisfies never;
      return POWERS.top;
  }
}
