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
 * Written over the node's own keys rather than over a list of node shapes on
 * purpose. Aug has dozens of node types and this has to keep working for the
 * ones no rewrite here handles: a walker that knew the shapes would silently
 * stop descending the moment Aug gained a node, and the caller asking "does
 * this depend on x" would get `false` for an expression that plainly does.
 *
 * `for...in` rather than `Object.values`, which allocated an array for every
 * node in every tree. This is the innermost loop of everything in this
 * directory and the array was most of its cost.
 */
export function visit(node: Node, callback: (node: Node) => void) {
  callback(node);
  forEachChild(node, (child) => {
    visit(child, callback);
  });
}

/** The direct children of a node, whatever shape it is. */
function forEachChild(node: Node, on: (child: Node) => void) {
  for (const key in node) {
    const value = (node as unknown as Record<string, unknown>)[key];
    if (typeof value !== "object" || value === null) continue;
    if (Array.isArray(value)) {
      for (const child of value) if (isNode(child)) on(child);
    } else if (isNode(value)) {
      on(value);
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

/**
 * Whether `variable` appears anywhere in the tree.
 *
 * Its own walk rather than a `visit` with a flag, so that it can stop at the
 * first occurrence. The integrator asks this of every operand of every node it
 * looks at, which makes it the most-called function here by a wide margin, and
 * an expression that depends on x usually says so near the top.
 */
export function dependsOn(node: Node, variable: string): boolean {
  if (node.type === "Identifier") return node.symbol === variable;
  let found = false;
  forEachChild(node, (child) => {
    if (!found && dependsOn(child, variable)) found = true;
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

/**
 * Whether two trees are the same expression, written the same way.
 *
 * A structural walk rather than comparing `JSON.stringify` of each, which is
 * what this used to do. Three reasons, in order of how much they matter.
 *
 * It stops at the first difference. Stringifying cannot: it builds both strings
 * in full before looking at either of them, and the overwhelmingly common call
 * here is one that fails on the node it starts at. Every product asks whether
 * each of its factors shares a base with each of the others.
 *
 * It allocates nothing, where stringifying allocated two strings per call.
 *
 * And it does not depend on the order the keys happen to sit in. Two nodes with
 * the same fields written in a different order are the same expression, and
 * `{ ...node, args }` is enough to produce one, so the old spelling could
 * answer `false` for a tree compared against a rebuilt copy of itself.
 */
export function sameTree(a: Node, b: Node): boolean {
  return deepEqual(a, b);
}

/**
 * A call's `parenWrapped` records brackets the user wrote around it, which
 * matter only to `implicitProducts` deciding what `(x(y-1))^2` means. Once a
 * call is a call, `(sin(3x))` and `sin(3x)` are the same expression, and a
 * derivative rule rebuilding the second must still cancel against the first.
 */
function isBracketMark(node: Record<string, unknown>, key: string) {
  return key === "parenWrapped" && node.type === "FunctionCall";
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (
    typeof a !== "object" ||
    typeof b !== "object" ||
    a === null ||
    b === null
  ) {
    return false;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length)
      return false;
    for (let i = 0; i < a.length; i += 1) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  let keys = 0;
  for (const key in left) {
    if (isBracketMark(left, key)) continue;
    keys += 1;
    if (!deepEqual(left[key], right[key])) return false;
  }
  // Only reached once every one of a's keys matched, so counting b's is all
  // that is left: a key b has and a does not would otherwise pass.
  let otherKeys = 0;
  for (const key in right) {
    if (isBracketMark(right, key)) continue;
    otherKeys += 1;
  }
  return keys === otherKeys;
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
  let count = 1;
  forEachChild(node, (child) => {
    count += nodeCount(child);
  });
  return count;
}

/**
 * Whether a tree has more than `limit` nodes, without counting the rest.
 *
 * The expander asks this of every rewrite it makes, and a rewrite that has run
 * away is exactly the case where counting to the end costs most: the answer is
 * already known a few hundred nodes into a tree with a hundred thousand in it.
 */
export function exceedsNodeCount(node: Node, limit: number): boolean {
  return countUpTo(node, limit) > limit;
}

function countUpTo(node: Node, limit: number): number {
  let count = 1;
  forEachChild(node, (child) => {
    if (count > limit) return;
    count += countUpTo(child, limit - count);
  });
  return count;
}

/**
 * Every occurrence of `target` in the tree, replaced by `value`.
 *
 * What makes a substitution a substitution. Matching is structural rather than
 * by object identity, because the subexpression being replaced was found by
 * walking a tree and the tree the caller wants rewritten is usually a *folded*
 * version of the one it was found in.
 *
 * It does not descend into a node it has just replaced, so a `value` that
 * contains the `target` cannot send it round forever.
 */
export function replaceSubtree(node: Node, target: Node, value: Node): Node {
  if (sameTree(node, target)) return value;
  return mapChildNodes(node, (child) => replaceSubtree(child, target, value));
}

/** Every use of an identifier replaced by an expression. */
export function replaceIdentifier(node: Node, name: string, value: Node): Node {
  if (node.type === "Identifier" && node.symbol === name) return value;
  return mapChildNodes(node, (child) => replaceIdentifier(child, name, value));
}

/**
 * A node rebuilt with each direct child mapped, for the shapes a rewrite here
 * can meet.
 *
 * Deliberately narrower than `visit`, and the asymmetry is on purpose: walking
 * an unknown node type is safe, because the worst case is a question answered
 * about more of the tree than necessary. *Rebuilding* one is not — a node put
 * back together from the fields this function happens to know about would lose
 * the rest of them silently. So anything else is returned untouched, and a
 * substitution simply does not reach inside it.
 */
export function mapChildNodes(node: Node, on: (child: Node) => Node): Node {
  switch (node.type) {
    case "Negative":
      return negative(on(node.arg));
    case "FunctionCall":
      return { ...node, args: node.args.map(on) };
    case "Factorial":
      return { ...node, arg: on(node.arg) };
    case "BinaryOperator":
      return node.name === "CrossMultiply"
        ? { ...node, left: on(node.left), right: on(node.right) }
        : binop(node.name, on(node.left), on(node.right));
    case "Seq":
      return { ...node, args: node.args.map(on) };
    case "RepeatedOperator":
      return { ...node, expression: on(node.expression) };
    default:
      return node;
  }
}

/**
 * `|g|` as `abs(g)`.
 *
 * Desmos parses the bars as a `Norm` node rather than as a call, so nothing
 * that knows `abs` — evaluation, the limit rules, the sign of a side — sees an
 * absolute value typed the way everybody types one. `\operatorname{abs}` was
 * understood and `\left|x\right|` evaluated to nothing at every point.
 */
export function normsToAbs(node: Node): Node {
  if (node.type === "Norm") return call("abs", normsToAbs(node.arg));
  return mapChildNodes(node, normsToAbs);
}

/** A name nothing in `node` already uses, for a substitution's placeholder. */
export function freshName(node: Node, preferred: readonly string[]): string {
  const taken = new Set(identifiersIn(node));
  for (const name of preferred) if (!taken.has(name)) return name;
  for (let i = 1; ; i += 1) {
    const name = `u_{${i}}`;
    if (!taken.has(name)) return name;
  }
}

/**
 * A term split into an exact rational coefficient and what it multiplies.
 *
 * `splitCoefficient` only sees a whole number in front, which is enough to
 * collect `2x` against `5x` and not enough for `x/4` against `x/8` — and the
 * second is what a half-angle identity produces, twice, in every even power of
 * a sine. Reading the division as part of the coefficient is what lets those
 * collect into `3x/8`.
 *
 * Rational rather than a plain number throughout, because the whole point is
 * that the collected coefficient goes into a printed answer: `0.375x` is the
 * same value and is not the same answer.
 */
export function splitRationalCoefficient(node: Node): {
  coefficient: { n: number; d: number };
  rest: Node;
} {
  const whole = rationalOf(node);
  if (whole !== undefined) return { coefficient: whole, rest: number(1) };
  if (node.type === "Negative") {
    const inner = splitRationalCoefficient(node.arg);
    return {
      coefficient: { n: -inner.coefficient.n, d: inner.coefficient.d },
      rest: inner.rest,
    };
  }
  if (node.type === "BinaryOperator") {
    if (node.name === "Multiply" || node.name === "CrossMultiply") {
      const left = rationalOf(node.left);
      if (left !== undefined) {
        const inner = splitRationalCoefficient(node.right);
        return {
          coefficient: {
            n: left.n * inner.coefficient.n,
            d: left.d * inner.coefficient.d,
          },
          rest: inner.rest,
        };
      }
    }
    if (node.name === "Divide") {
      const right = rationalOf(node.right);
      if (right !== undefined && right.n !== 0) {
        const inner = splitRationalCoefficient(node.left);
        return {
          coefficient: {
            n: inner.coefficient.n * right.d,
            d: inner.coefficient.d * right.n,
          },
          rest: inner.rest,
        };
      }
    }
  }
  return { coefficient: { n: 1, d: 1 }, rest: node };
}

/**
 * An expression as a single numerator over a single denominator.
 *
 * Built from the four operations and integer powers; anything else is its own
 * numerator over one. The point is not tidiness — `x + 1/x` over a common
 * denominator reads worse, not better — but that a *rule* can only see a
 * rational function when it is written as one. The tangent half-angle
 * substitution turns `1/(1+cos x)` into a tower of fractions inside fractions,
 * and every one of them is a rational function of the new variable that no rule
 * can recognise until it is over one bar.
 *
 * Nothing is cancelled and nothing is multiplied out: the caller folds and
 * expands the two halves if it wants them as polynomials.
 */
export function asRatio(node: Node): { numerator: Node; denominator: Node } {
  const whole = (value: Node) => ({ numerator: value, denominator: number(1) });
  switch (node.type) {
    case "Negative": {
      const inner = asRatio(node.arg);
      return { ...inner, numerator: negative(inner.numerator) };
    }
    case "BinaryOperator": {
      const left = asRatio(node.left);
      const right = asRatio(node.right);
      switch (node.name) {
        case "Add":
        case "Subtract": {
          const scaledLeft = multiply(left.numerator, right.denominator);
          const scaledRight = multiply(right.numerator, left.denominator);
          return {
            numerator:
              node.name === "Add"
                ? add(scaledLeft, scaledRight)
                : subtract(scaledLeft, scaledRight),
            denominator: multiply(left.denominator, right.denominator),
          };
        }
        case "Multiply":
        case "CrossMultiply":
          return {
            numerator: multiply(left.numerator, right.numerator),
            denominator: multiply(left.denominator, right.denominator),
          };
        case "Divide":
          return {
            numerator: multiply(left.numerator, right.denominator),
            denominator: multiply(left.denominator, right.numerator),
          };
        case "Exponent": {
          const exponent = constantValue(node.right);
          if (exponent === undefined || !Number.isInteger(exponent))
            return whole(node);
          const raise = (value: Node, to: number): Node =>
            to === 1 ? value : binop("Exponent", value, number(to));
          if (exponent >= 0) {
            return {
              numerator: raise(left.numerator, exponent),
              denominator: raise(left.denominator, exponent),
            };
          }
          return {
            numerator: raise(left.denominator, -exponent),
            denominator: raise(left.numerator, -exponent),
          };
        }
        default:
          return whole(node);
      }
    }
    default:
      return whole(node);
  }
}

/**
 * Whether two expressions are the same product, in any order.
 *
 * Not a canonical form and not a step toward one. It answers exactly one
 * question — are these the same factors? — and multiplication being
 * commutative is not a matter of opinion, so the answer is not either. What it
 * is *not* able to do is see that `x(x+1)` and `x²+x` are the same, which is
 * where a canonical form would have to start.
 *
 * It earns its place in collecting like terms. Integration by parts produces
 * `2(x arctan√x)` in one place and `arctan(√x)x` in another, and left as two
 * different terms an answer carries both.
 */
export function sameProduct(a: Node, b: Node): boolean {
  if (sameTree(a, b)) return true;
  const left: { node: Node; inNumerator: boolean }[] = [];
  const right: { node: Node; inNumerator: boolean }[] = [];
  quotientFactors(a, true, left);
  quotientFactors(b, true, right);
  if (left.length !== right.length) return false;
  const taken = new Array<boolean>(right.length).fill(false);
  for (const factor of left) {
    const match = right.findIndex(
      (other, index) =>
        !taken[index] &&
        other.inNumerator === factor.inNumerator &&
        sameTree(other.node, factor.node)
    );
    if (match < 0) return false;
    taken[match] = true;
  }
  return true;
}
