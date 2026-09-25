/**
 * Integrands built from exponentials, turned into rational functions.
 *
 * `∫dx/(eˣ + e⁻ˣ)` is `∫du/(u² + 1)` with `u = eˣ`: every exponential in it
 * is a power of the one `u`, and `dx = du/u`. The same move covers the
 * hyperbolic functions once they are written as what they are,
 * `cosh x = (eˣ + e⁻ˣ)/2`, which is how `∫sech x dx = 2 arctan(eˣ)` is done
 * by hand.
 *
 * Like the other substitutions this produces a different integral, not an
 * answer; the rational-function machinery does the work, and the caller's
 * numeric check covers the substitution being undone.
 */
import {
  add,
  asRatio,
  call,
  dependsOn,
  divide,
  expand,
  fold,
  freshName,
  id,
  multiply,
  number,
  power,
  rationalNode,
  rationalOf,
  replaceIdentifier,
  sameTree,
  subtract,
  visit,
  type Node,
} from "../../../symbolic";
import { linearIn } from "./integrate";

const HYPERBOLIC = ["sinh", "cosh", "tanh", "coth", "sech", "csch"];

/**
 * The hyperbolic functions of the variable written as exponentials, or
 * undefined when there are none. Each is its definition, so this is an
 * identity everywhere.
 */
export function hyperbolicAsExponentials(
  node: Node,
  variable: string
): Node | undefined {
  let rewrote = false;
  const walk = (n: Node): Node => {
    switch (n.type) {
      case "Negative":
        return { ...n, arg: walk(n.arg) };
      case "BinaryOperator":
        return { ...n, left: walk(n.left), right: walk(n.right) };
      case "FunctionCall": {
        const args = n.args.map(walk);
        const name = n.callee.symbol;
        if (
          args.length !== 1 ||
          !HYPERBOLIC.includes(name) ||
          !dependsOn(args[0], variable)
        )
          return { ...n, args };
        rewrote = true;
        const [u] = args;
        const up = power(id("e"), u);
        const down = power(id("e"), multiply(number(-1), u));
        const sum = add(up, down);
        const difference = subtract(up, down);
        switch (name) {
          case "sinh":
            return divide(difference, number(2));
          case "cosh":
            return divide(sum, number(2));
          case "tanh":
            return divide(difference, sum);
          case "coth":
            return divide(sum, difference);
          case "sech":
            return divide(number(2), sum);
          default:
            return divide(number(2), difference);
        }
      }
      default:
        return n;
    }
  };
  const rewritten = walk(node);
  return rewrote ? fold(rewritten) : undefined;
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) [x, y] = [y, x % y];
  return x;
}

/**
 * `u = e^{kx}`, when every appearance of the variable is inside an
 * exponential `e^{ax+b}` with `a` a rational multiple of one `k`. Then
 * `e^{ax+b} = e^b u^{a/k}` and `dx = du/(k u)`, and what is left is a
 * function of `u` alone.
 */
export function findExpSubstitution(
  node: Node,
  variable: string
):
  | { integrands: Node[]; name: string; back: (node: Node) => Node }
  | undefined {
  const slopes: { n: number; d: number }[] = [];
  let base: Node | undefined;
  let usable = true;
  visit(node, (child) => {
    if (
      child.type !== "BinaryOperator" ||
      child.name !== "Exponent" ||
      dependsOn(child.left, variable) ||
      !dependsOn(child.right, variable)
    )
      return;
    if (base !== undefined && !sameTree(base, child.left)) usable = false;
    base ??= child.left;
    const linear = linearIn(child.right, variable);
    const slope = linear && rationalOf(fold(linear.a));
    if (slope === undefined || slope.n === 0) usable = false;
    else slopes.push(slope);
  });
  if (!usable || slopes.length === 0 || base === undefined) return undefined;
  const e = base.type === "Identifier" && base.symbol === "e";
  // Only a base that is a positive number has a logarithm to divide by.
  if (!e && !(Number(rationalOf(base)?.n) > 0)) return undefined;

  // k = gcd of the numerators over lcm of the denominators.
  const numerator = slopes.reduce((g, s) => gcd(g, s.n), 0);
  const denominator = slopes.reduce((l, s) => (l * s.d) / gcd(l, s.d), 1);
  const k = { n: numerator, d: denominator };

  const name = freshName(node, ["u", "w", "s", "v"]);
  const u = id(name);
  const walk = (n: Node): Node => {
    if (
      n.type === "BinaryOperator" &&
      n.name === "Exponent" &&
      !dependsOn(n.left, variable) &&
      dependsOn(n.right, variable)
    ) {
      const linear = linearIn(n.right, variable);
      const slope = linear && rationalOf(fold(linear.a));
      if (linear === undefined || slope === undefined) return n;
      // a/k, exactly, as a rational.
      const ratio = { n: slope.n * k.d, d: slope.d * k.n };
      const g = gcd(ratio.n, ratio.d);
      const exponent = rationalNode({ n: ratio.n / g, d: ratio.d / g });
      return multiply(power(n.left, linear.b), power(u, exponent));
    }
    switch (n.type) {
      case "Negative":
        return { ...n, arg: walk(n.arg) };
      case "BinaryOperator":
        return { ...n, left: walk(n.left), right: walk(n.right) };
      case "FunctionCall":
        return { ...n, args: n.args.map(walk) };
      default:
        return n;
    }
  };
  const rewritten = walk(node);
  if (dependsOn(rewritten, variable)) return undefined;
  const kNode = rationalNode(k);
  const scale = e ? kNode : multiply(kNode, call("ln", base));
  const back = power(base, multiply(kNode, id(variable)));
  // Over one bar, both as it factors and multiplied out, since the rational
  // rules only see a rational function written as one: 1/((u + 1/u)u) is
  // 1/(u² + 1) and nothing recognises it until it says so.
  const ratio = asRatio(divide(rewritten, multiply(scale, u)));
  const factored = fold(divide(ratio.numerator, ratio.denominator));
  const opened = fold(
    divide(
      fold(expand(ratio.numerator).node),
      fold(expand(ratio.denominator).node)
    )
  );
  return {
    integrands: sameTree(factored, opened) ? [factored] : [factored, opened],
    name,
    back: (answer) => fold(replaceIdentifier(answer, name, fold(back))),
  };
}
