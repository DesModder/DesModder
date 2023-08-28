import {
  BinaryExpression,
  Node,
  NodePath,
  NonExprNode,
  Statement,
} from "../TextAST/Synthetic";

/**
 * Errs on the side of too many parens instead of not enough.
 *
 * Based on https://github.com/prettier/prettier/blob/main/src/language-js/needs-parens.js
 */
export default function needsParens(path: NodePath): boolean {
  const parent = path.parent;

  const node = path.node;
  const name = path.name;

  if (node.type === "SequenceExpression" && node.parenWrapped) return true;

  /* istanbul ignore if */
  if (parent === null) return false;

  if (node.type === "SequenceExpression")
    // sequence expressions will only ever be unwrapped when their parent
    // is a statement or style mapping (onClick event)
    return parent.type === "MappingEntry";

  if (
    isNonExpression(node) ||
    (isNonExpression(parent) && parent.type !== "PiecewiseBranch")
  )
    return false;

  switch (parent.type) {
    // TODO
    case "RepeatedExpression":
      // identifier, start, and end don't need parens
      // TODO: don't need parens sometimes in the expr
      return name === "expr";
    case "CallExpression":
      return (
        (name === "callee" &&
          node.type !== "Identifier" &&
          node.type !== "MemberExpression") ||
        node.type === "Substitution"
      );
    case "ListExpression":
    case "RangeExpression":
      return node.type === "Substitution";
    case "ListComprehension":
    case "Substitution":
      return false;
    case "MemberExpression":
      return name !== "object" || node.type !== "Identifier";
    // else fall through to the next switch
  }

  switch (node.type) {
    case "Identifier":
    case "String":
      return false;
    case "RepeatedExpression":
      // TODO: better logic for RepeatedExpression
      return true;
    case "Substitution":
      switch (parent.type) {
        case "UpdateRule":
          return false;
        default:
          return true;
      }
    case "RangeExpression":
    case "ListExpression":
    case "ListComprehension":
    case "PiecewiseExpression":
      // They come with their own grouping ([] or {}), no need to add parens
      return false;
    case "Number":
      if (node.value >= 0) return false;
    // fall through since "-1" parses like a prefix
    case "PrefixExpression":
      // Currently the only prefix expression is unary minus
      switch (parent.type) {
        case "PrefixExpression":
        case "ListAccessExpression":
        case "PostfixExpression":
          return true;
        case "BinaryExpression":
          return name === "left" && parent.op === "^";
        default:
          return false;
      }
    case "UpdateRule":
      switch (parent.type) {
        case "SequenceExpression":
          return false;
        case "BinaryExpression":
          // parent should never be arithmetic, but be safe
          return isArithmetic(parent);
        case "PiecewiseExpression":
        case "PiecewiseBranch":
          // This one can be contentious.
          // {x > 1: x -> 0, x -> 2} is NOT {x > 1: (x -> 0, x -> 2)}
          return false;
        /* istanbul ignore next */
        default:
          return true;
      }
    case "MemberExpression":
    case "ListAccessExpression":
      return false;
    case "BinaryExpression":
    case "DoubleInequality":
      switch (parent.type) {
        case "DerivativeExpression":
        case "PrefixExpression":
        case "PostfixExpression":
          return true;
        case "ListAccessExpression":
          return name === "expr";
        case "BinaryExpression": {
          if (node.type === "DoubleInequality") return true;
          const precedence = getPrecedence(node.op);
          const parentPrecedence = getPrecedence(parent.op);
          if (parentPrecedence > precedence) return true;
          if (parentPrecedence === precedence) {
            if (
              name === "right" ||
              parent.op === "^" ||
              (parent.op === "*" && node.op === "/") ||
              (parent.op === "/" && node.op === "*") ||
              (comparisonOps.includes(parent.op) &&
                comparisonOps.includes(node.op))
            )
              return true;
          }
          return false;
        }
        default:
          return false;
      }
    case "PostfixExpression":
      return parent.type === "PrefixExpression";
    case "Norm":
    case "CallExpression":
    case "PrimeExpression":
      return false;
    case "DerivativeExpression":
      // TODO: don't always need parens
      return true;
    /* istanbul ignore next */
    default:
      node satisfies never;
      throw new Error(
        `Programming Error: Unexpected Text node ${(node as any).type}`
      );
  }
}

function isStatement(node: Node): node is Statement {
  return (
    node.type === "ExprStatement" ||
    node.type === "Table" ||
    node.type === "Image" ||
    node.type === "Text" ||
    node.type === "Folder" ||
    node.type === "Settings" ||
    node.type === "Ticker"
  );
}

function isNonExpression(node: Node): node is NonExprNode {
  return (
    isStatement(node) ||
    node.type === "Program" ||
    node.type === "RegressionParameters" ||
    node.type === "RegressionEntry" ||
    node.type === "StyleMapping" ||
    node.type === "MappingEntry" ||
    node.type === "AssignmentExpression" ||
    node.type === "PiecewiseBranch"
  );
}

function isArithmetic(expr: BinaryExpression) {
  const op = expr.op;
  return op === "^" || op === "*" || op === "/" || op === "+" || op === "-";
}

const comparisonOps = ["<", ">", "<=", ">=", "="];

const PRECEDENCE = new Map(
  (
    [["<", ">", "<=", ">=", "="], ["~"], ["+", "-"], ["*", "/"], ["^"]] as const
  ).flatMap((operators, index) => operators.map((op) => [op, index]))
);

function getPrecedence(operator: BinaryExpression["op"]) {
  return PRECEDENCE.get(operator) as number;
}
