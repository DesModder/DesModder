/**
 * The substitution that clears a root of something linear, by making the root
 * itself the new variable.
 *
 * `∫x/√(x+1) dx` has no `u` whose derivative divides out and no quadratic for
 * trigonometric substitution to work on. What it has is a root, and the way
 * past a root is to let `u` *be* it: with `u = √(x+1)` the whole integrand
 * becomes a polynomial, because `x` is `u² - 1` and `dx` is `2u du`.
 *
 * This is the one substitution here that runs *backwards*. Everywhere else `u`
 * is a function of `x` and the integrand is divided by `du/dx`; here `x` is a
 * function of `u` and the integrand is multiplied by `dx/du`. That is the same
 * move trigonometric substitution makes, and for the same reason: what is in
 * the way is a shape rather than a composition.
 *
 * ## Several roots at once
 *
 * `1/(√x + ∛x)` has two, and one substitution clears both: `u = x^{1/6}` makes
 * the first `u³` and the second `u²`. The index taken is the least common
 * multiple of the ones present, which is why the roots are collected before
 * anything is chosen.
 *
 * ## What it refuses
 *
 * Anything under the root that is not linear in the variable. A quadratic is
 * trigonometric substitution's problem and it is tried first; anything else has
 * no inverse this can write down. And roots of two *different* linear
 * expressions, because no single new variable is both.
 */
import {
  add,
  call,
  constantValue,
  dependsOn,
  differentiate,
  divide,
  SymbolicError,
  fold,
  freshName,
  id,
  multiply,
  number,
  power,
  replaceIdentifier,
  replaceSubtree,
  sameTree,
  subtract,
  visit,
  type Node,
} from "../../../symbolic";
import { linearIn } from "./integrate";

export interface RootSubstitution {
  /** The integral to do, in the new variable. */
  integrand: Node;
  /** The new variable's name. */
  name: string;
  /** Turns an answer in that variable back into one in the original. */
  back: (node: Node) => Node;
}

/** Beyond this the substituted integrand is a polynomial nobody wants. */
const MAX_INDEX = 6;

/** One root found in the integrand: `base^{1/index}`, as it is written. */
interface Root {
  node: Node;
  base: Node;
  index: number;
  /** The whole power it is raised to, so `base^{3/2}` reports 3. */
  numerator: number;
}

/**
 * The substitution that clears every root in `node`, or `undefined` if there
 * is not one.
 */
export function findRootSubstitution(
  node: Node,
  variable: string
): RootSubstitution | undefined {
  const roots = rootsIn(node, variable);
  if (roots.length === 0) return undefined;
  const [{ base }] = roots;
  if (!roots.every((root) => sameTree(root.base, base))) return undefined;

  const invert = inverseOf(base, variable);
  if (invert === undefined) return undefined;

  let index = 1;
  for (const root of roots) index = leastCommonMultiple(index, root.index);
  if (index < 2 || index > MAX_INDEX) return undefined;

  const name = freshName(node, ["u", "w", "s", "v"]);
  const u = id(name);
  // base = u^index, so x = g^{-1}(u^index) and dx is its derivative in u.
  const raised = power(u, number(index));
  const inverse = invert(raised);
  let jacobian: Node;
  try {
    jacobian = fold(differentiate(inverse, name));
  } catch (error) {
    if (error instanceof SymbolicError) return undefined;
    throw error;
  }

  // Every root is replaced before the variable is, or the `x` inside each root
  // would be substituted and the root would never go away.
  let rewritten = node;
  for (const root of roots) {
    rewritten = replaceSubtree(
      rewritten,
      root.node,
      power(u, number((root.numerator * index) / root.index))
    );
  }
  // What is under the root may also appear outside it -- `tan x` beside
  // `sqrt(tan x)` -- and it is `u^index` there too.
  rewritten = replaceSubtree(rewritten, base, raised);
  rewritten = replaceIdentifier(rewritten, variable, inverse);
  if (dependsOn(rewritten, variable)) return undefined;

  return {
    integrand: fold(multiply(rewritten, jacobian)),
    name,
    back: (answer) =>
      fold(
        replaceIdentifier(
          answer,
          name,
          power(base, divide(number(1), number(index)))
        )
      ),
  };
}

/**
 * `x` as a function of `w`, where `w` is what sits under the root.
 *
 * A linear expression was the original case. The others are the functions
 * with an inverse that is defined on the whole range in question, so that the
 * substitution is a change of variable rather than a change of branch:
 * `√(tan x)` becomes `x = arctan(u²)`, which turns it into `2u²/(1+u⁴)` and
 * partial fractions. `sin` and `cos` are left out deliberately; `arcsin` would
 * make the answer right on one half-period and silently wrong on the next.
 */
function inverseOf(
  base: Node,
  variable: string
): ((w: Node) => Node) | undefined {
  const undoLinear = (inside: Node) => {
    const linear = linearIn(inside, variable);
    if (linear === undefined) return undefined;
    const slope = constantValue(fold(linear.a));
    const intercept = constantValue(fold(linear.b));
    if (slope === undefined || slope === 0 || intercept === undefined)
      return undefined;
    return (value: Node) =>
      divide(subtract(value, number(intercept)), number(slope));
  };

  const plain = undoLinear(base);
  if (plain !== undefined) return plain;

  const isE =
    base.type === "BinaryOperator" &&
    base.name === "Exponent" &&
    base.left.type === "Identifier" &&
    base.left.symbol === "e";
  if (isE) {
    const undo = undoLinear(base.right);
    return undo === undefined ? undefined : (w) => undo(call("ln", w));
  }
  if (base.type !== "FunctionCall" || base.args.length !== 1) return undefined;
  const undo = undoLinear(base.args[0]);
  if (undo === undefined) return undefined;
  switch (base.callee.symbol) {
    case "tan":
      return (w) => undo(call("arctan", w));
    case "exp":
      return (w) => undo(call("ln", w));
    case "ln":
      return (w) => undo(power(id("e"), w));
    default:
      return undefined;
  }
}

/** Every `f^{m/n}` in the tree where `n > 1`, including `sqrt`. */
function rootsIn(node: Node, variable: string): Root[] {
  const found: Root[] = [];
  visit(node, (child) => {
    const root = asRoot(child);
    if (root === undefined || !dependsOn(root.base, variable)) return;
    if (found.some((existing) => sameTree(existing.node, root.node))) return;
    found.push(root);
  });
  return found;
}

function asRoot(node: Node): Root | undefined {
  if (
    node.type === "FunctionCall" &&
    node.callee.symbol === "sqrt" &&
    node.args.length === 1
  ) {
    return { node, base: node.args[0], index: 2, numerator: 1 };
  }
  if (node.type !== "BinaryOperator" || node.name !== "Exponent")
    return undefined;
  const exponent = fold(node.right);
  if (exponent.type !== "BinaryOperator" || exponent.name !== "Divide") {
    return undefined;
  }
  const numerator = constantValue(exponent.left);
  const index = constantValue(exponent.right);
  if (
    numerator === undefined ||
    index === undefined ||
    !Number.isInteger(numerator) ||
    !Number.isInteger(index) ||
    index < 2 ||
    numerator === 0
  ) {
    return undefined;
  }
  return { node, base: node.left, index, numerator };
}

function leastCommonMultiple(a: number, b: number) {
  return (a / greatestCommonDivisor(a, b)) * b;
}

function greatestCommonDivisor(a: number, b: number): number {
  while (b !== 0) [a, b] = [b, a % b];
  return a;
}

/** Kept for the tests, which check the reading apart from the substituting. */
export const forTesting = { rootsIn, asRoot, add };
