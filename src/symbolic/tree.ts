/**
 * The vocabulary every symbolic rewrite in this repo is written in.
 *
 * These walked, flattened and rebuilt Desmos's own syntax trees from inside
 * `plugins/physics-lab/symbolic/integrate.ts`, where they sat beside the
 * integration rules because that is where the first caller happened to be, and
 * Vector Tools had a second copy of the two smallest of them. Neither is about
 * integrating or about differentiating: they are about Aug trees, which nothing
 * in either plugin owns.
 *
 * Nothing here decides anything. Every function is either a question about a
 * tree or a way of taking one apart and putting it back together; the rewrites
 * that use the answers live in `fold.ts`, `condense.ts` and `expand.ts`.
 */
import { Aug, AugBuilders } from "../../text-mode-core";

export type Node = Aug.Latex.AnyChild;

export const { number, binop, functionCall, id, negative } = AugBuilders;

export const add = (a: Node, b: Node) => binop("Add", a, b);
export const subtract = (a: Node, b: Node) => binop("Subtract", a, b);
export const multiply = (a: Node, b: Node) => binop("Multiply", a, b);
export const divide = (a: Node, b: Node) => binop("Divide", a, b);
export const power = (a: Node, b: Node) => binop("Exponent", a, b);
export const call = (name: string, arg: Node) => functionCall(id(name), [arg]);

/**
 * Every node in the tree, parents before children.
 *
 * Written over `Object.values` rather than over a list of node shapes on
 * purpose. Aug has dozens of node types and this has to keep working for the
 * ones no rewrite here handles — a visitor that knew the shapes would silently
 * stop descending the moment Aug gained a node, and the caller asking "does
 * this depend on x" would get `false` for an expression that plainly does.
 */
export function visit(node: Node, callback: (node: Node) => void) {
  callback(node);
  for (const value of Object.values(
    node as unknown as Record<string, unknown>
  )) {
    if (Array.isArray(value)) {
      for (const child of value) if (isNode(child)) visit(child, callback);
    } else if (isNode(value)) {
      visit(value, callback);
    }
  }
}

export function isNode(value: unknown): value is Node {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { type?: unknown }).type === "string"
  );
}

/** Whether `variable` appears anywhere in the tree. */
export function dependsOn(node: Node, variable: string): boolean {
  let found = false;
  visit(node, (child) => {
    if (child.type === "Identifier" && child.symbol === variable) found = true;
  });
  return found;
}

/** Every identifier in the tree, in first-seen order. */
export function identifiersIn(node: Node): string[] {
  const names: string[] = [];
  visit(node, (child) => {
    if (child.type === "Identifier" && !names.includes(child.symbol))
      names.push(child.symbol);
  });
  return names;
}

/** Whether two trees are the same expression, written the same way. */
export function sameTree(a: Node, b: Node) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * The top-level terms of a sum, with their signs.
 *
 * Shared because four things want it and all four want it to mean exactly the
 * same thing: the differentiator differentiates a sum in one step, the
 * factoriser looks for what every term has in common, the expander distributes
 * over one, and the panel breaks a long answer over lines. The last is why it
 * stops at the top level — a break inside a product, or under a fraction bar,
 * reads as a different expression.
 */
export function topLevelTerms(
  node: Node
): readonly { term: Node; negated: boolean }[] {
  const out: { term: Node; negated: boolean }[] = [];
  collectTerms(node, false, out);
  return out;
}

function collectTerms(
  node: Node,
  negated: boolean,
  out: { term: Node; negated: boolean }[]
) {
  if (node.type === "BinaryOperator") {
    if (node.name === "Add") {
      collectTerms(node.left, negated, out);
      collectTerms(node.right, negated, out);
      return;
    }
    if (node.name === "Subtract") {
      collectTerms(node.left, negated, out);
      collectTerms(node.right, !negated, out);
      return;
    }
  }
  out.push({ term: node, negated });
}

/** A signed list of terms back into one expression. */
export function rebuildSum(
  parts: readonly { value: Node; negated: boolean }[]
): Node {
  let result: Node | undefined;
  for (const part of parts) {
    if (result === undefined) {
      result = part.negated ? negative(part.value) : part.value;
    } else {
      result = part.negated
        ? subtract(result, part.value)
        : add(result, part.value);
    }
  }
  return result ?? number(0);
}

/**
 * Every factor of a product or quotient, flattened, each marked with the side
 * of the bar it was on.
 *
 * Division has to be walked as well as multiplication. The integrating factor
 * meets its opposite through a fraction far more often than beside it —
 * `e^{3x}·(x·e^{-3x}/-3)` is what solving `dy/dx = x + 3y` produces, and a
 * flattener that stopped at the fraction would leave the two exponentials in
 * plain sight and never cancel them.
 */
export function quotientFactors(
  node: Node,
  inNumerator: boolean,
  out: { node: Node; inNumerator: boolean }[]
) {
  if (node.type === "BinaryOperator") {
    if (node.name === "Multiply" || node.name === "CrossMultiply") {
      quotientFactors(node.left, inNumerator, out);
      quotientFactors(node.right, inNumerator, out);
      return;
    }
    if (node.name === "Divide") {
      quotientFactors(node.left, inNumerator, out);
      quotientFactors(node.right, !inNumerator, out);
      return;
    }
  }
  if (node.type === "Negative") {
    // A sign is a factor of -1, and leaving it wrapped round the term would
    // hide every exponential inside it from the fold. `e^{3x}·-(e^{-3x}/3)/3`
    // is what the integrating factor produces, and the two exponentials only
    // meet once the minus stops being a lid on one of them.
    out.push({ node: number(-1), inNumerator });
    quotientFactors(node.arg, inNumerator, out);
    return;
  }
  out.push({ node, inNumerator });
}

/** A node's numeric value, seeing through a leading minus sign. */
export function constantValue(node: Node): number | undefined {
  if (node.type === "Constant") return node.value;
  if (node.type === "Negative") {
    const inner = constantValue(node.arg);
    return inner === undefined ? undefined : -inner;
  }
  return undefined;
}

/**
 * Splits a leading numeric coefficient off a term: `2x` becomes `[2, x]`, and
 * anything without one becomes `[1, itself]`.
 *
 * A bare constant reports its own value against a remainder of 1, so two
 * constants collect the same way two multiples of x do.
 */
export function splitCoefficient(node: Node): [number, Node] {
  if (node.type === "Constant") return [node.value, number(1)];
  if (node.type === "Negative") {
    const [factor, rest] = splitCoefficient(node.arg);
    return [-factor, rest];
  }
  if (
    node.type === "BinaryOperator" &&
    (node.name === "Multiply" || node.name === "CrossMultiply")
  ) {
    const factor = constantValue(node.left);
    if (factor !== undefined) return [factor, node.right];
  }
  return [1, node];
}

/**
 * A node as an exact rational, where it is one.
 *
 * `constantValue` only sees a plain number, which is why `\frac{1}{2} - 1` used
 * to survive simplification untouched: a fraction of two integers is a Divide
 * node, not a Constant, so neither side folded and the power rule produced
 * `x^{1/2 - 1}`. Reading fractions as well means the arithmetic happens without
 * ever passing through a decimal.
 */
export function rationalOf(node: Node): { n: number; d: number } | undefined {
  if (node.type === "Constant")
    return Number.isInteger(node.value) ? { n: node.value, d: 1 } : undefined;
  if (node.type === "Negative") {
    const inner = rationalOf(node.arg);
    return inner === undefined ? undefined : { n: -inner.n, d: inner.d };
  }
  if (node.type === "BinaryOperator" && node.name === "Divide") {
    const top = rationalOf(node.left);
    const bottom = rationalOf(node.right);
    if (top === undefined || bottom === undefined || bottom.n === 0)
      return undefined;
    return { n: top.n * bottom.d, d: top.d * bottom.n };
  }
  return undefined;
}

/** A rational back as a node: an integer where it is one, a fraction otherwise. */
export function rationalNode(value: { n: number; d: number }): Node {
  let { n, d } = value;
  if (d < 0) {
    n = -n;
    d = -d;
  }
  const divisor = greatestCommonDivisor(Math.abs(n), d);
  if (divisor > 1) {
    n /= divisor;
    d /= divisor;
  }
  if (d === 1) return number(n);
  return n < 0
    ? negative(divide(number(-n), number(d)))
    : divide(number(n), number(d));
}

export function greatestCommonDivisor(a: number, b: number): number {
  while (b !== 0) [a, b] = [b, a % b];
  return a;
}

/** How many nodes a tree has, which is how a rewrite knows it has run away. */
export function nodeCount(node: Node): number {
  let count = 0;
  visit(node, () => count++);
  return count;
}
