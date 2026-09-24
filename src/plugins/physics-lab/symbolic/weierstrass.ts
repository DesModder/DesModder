/**
 * The tangent half-angle substitution, which turns any rational function of
 * sine and cosine into a rational function of one variable.
 *
 * `∫dx/(1 + cos x)` is not a power of anything, not a product of two waves, and
 * has no `u` whose derivative divides out. What it is is a *rational function
 * of sin and cos*, and every one of those becomes an ordinary rational function
 * under `t = tan(x/2)`:
 *
 *     sin x = 2t/(1+t²)    cos x = (1-t²)/(1+t²)    dx = 2 dt/(1+t²)
 *
 * after which partial fractions and the discriminant finish it. The example
 * above collapses to `∫dt`, which is `tan(x/2)`.
 *
 * ## Why it is the last thing tried
 *
 * Because it works on far more than it should be used for. `∫sin x dx` is a
 * rational function of sine, and under this substitution it becomes
 * `∫4t/(1+t²)² dt` — correct, and an answer of `-2/(1+tan²(x/2)) ` where
 * `-cos x` was wanted. So it sits after every rule and every other rewrite, and
 * only ever runs on an integrand nothing else could touch.
 *
 * ## What it refuses
 *
 * A half-angle substitution needs every trigonometric function in the integrand
 * to be a function of the *same* linear argument, because `t` stands for one
 * angle. It also needs that argument to be linear, for the usual reason: the
 * `dx` factor is what a linear argument makes constant.
 */
import type { Aug } from "../../../../text-mode-core";
import {
  add,
  asRatio,
  constantValue,
  expand,
  dependsOn,
  divide,
  fold,
  freshName,
  id,
  multiply,
  number,
  power,
  replaceSubtree,
  sameTree,
  subtract,
  visit,
  type Node,
} from "../../../symbolic";
import { linearIn } from "./integrate";

export interface HalfAngleSubstitution {
  /**
   * The integral to do, in two spellings.
   *
   * Which one a rule can read depends on the integrand, and there is no way to
   * tell in advance. `1/(2 + sin x)` needs the `1 + t²` that the substitution
   * puts into every numerator and denominator to stay factored, so the fold can
   * cancel them against each other; `1/(1 + cos x)` needs the opposite, because
   * what is left after cancelling is a sum that only collects once it is
   * multiplied out. Both are the same function, so the caller tries them in
   * turn and keeps whichever one an existing rule finishes.
   */
  integrands: readonly Node[];
  name: string;
  back: (node: Node) => Node;
}

const TRIGONOMETRIC = new Set(["sin", "cos", "tan", "cot", "sec", "csc"]);

/**
 * The substitution for `node`, or `undefined` if it is not a rational function
 * of one angle.
 */
export function findHalfAngleSubstitution(
  node: Node,
  variable: string
): HalfAngleSubstitution | undefined {
  const calls = trigCalls(node, variable);
  if (calls.length === 0) return undefined;
  const [first] = calls;
  const [angle] = first.args;
  if (!calls.every((call) => sameTree(call.args[0], angle))) return undefined;

  const linear = linearIn(angle, variable);
  if (linear === undefined) return undefined;
  const slope = constantValue(fold(linear.a));
  if (slope === undefined || slope === 0) return undefined;

  const name = freshName(node, ["t", "w", "s", "u"]);
  const t = id(name);
  const squared = power(t, number(2));
  const onePlus = add(number(1), squared);
  const sine = divide(multiply(number(2), t), onePlus);
  const cosine = divide(subtract(number(1), squared), onePlus);
  const table: Record<string, Node> = {
    sin: sine,
    cos: cosine,
    tan: divide(sine, cosine),
    cot: divide(cosine, sine),
    sec: divide(number(1), cosine),
    csc: divide(number(1), sine),
  };

  let rewritten = node;
  for (const call of calls) {
    const replacement = table[call.callee.symbol];
    if (replacement === undefined) return undefined;
    rewritten = replaceSubtree(rewritten, call, replacement);
  }
  if (dependsOn(rewritten, variable)) return undefined;

  // dx = 2 dt / (a(1 + t²)), the derivative of the half-angle tangent inverted.
  const jacobian = divide(number(2), multiply(number(slope), onePlus));
  // Put over one bar before it is handed on. What comes out of the
  // substitution is a tower of fractions inside fractions, and every rule that
  // could finish it -- partial fractions, the discriminant -- can only see a
  // rational function when it is written as one.
  const ratio = asRatio(multiply(rewritten, jacobian));
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
    back: (answer) =>
      fold(
        replaceSubtree(answer, t, {
          type: "FunctionCall",
          callee: id("tan"),
          args: [divide(angle, number(2))],
        })
      ),
  };
}

/** Every trigonometric call in the tree that depends on the variable. */
function trigCalls(node: Node, variable: string): Aug.Latex.FunctionCall[] {
  const found: Aug.Latex.FunctionCall[] = [];
  visit(node, (child) => {
    if (child.type !== "FunctionCall" || child.args.length !== 1) return;
    if (!TRIGONOMETRIC.has(child.callee.symbol)) return;
    if (!dependsOn(child.args[0], variable)) return;
    if (found.some((existing) => sameTree(existing, child))) return;
    found.push(child);
  });
  return found;
}
