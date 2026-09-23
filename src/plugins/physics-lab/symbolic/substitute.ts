/**
 * Integration by substitution, found rather than guessed.
 *
 * Every other rule in `integrate.ts` matches a shape. This one searches: it
 * takes each subexpression of the integrand in turn, asks what would happen if
 * that were `u`, and keeps the first one that works. That is the same thing a
 * person does, and it is worth doing this way because substitution is not a
 * shape at all — `2xe^{x²}`, `x/(x²+1)`, `sin³x·cos x` and `1/(x ln x)` have
 * nothing structurally in common, and every one of them is one substitution
 * away from a rule that already exists.
 *
 * ## How a candidate is tested
 *
 * For a candidate `u`, the test is whether the integrand divided by `du/dx` is
 * a function of `u` alone:
 *
 *     ∫ f(x) dx  =  ∫ [ f(x) / u'(x) ] du
 *
 * so if `f/u'` can be written in terms of `u` with no `x` left over, the
 * integral in `u` is the one to do. The division is the whole trick and it is
 * the *fold* that makes it work: `x·e^{x²} / 2x` cancels to `e^{x²}/2` because
 * `cancelCommonFactors` flattens both sides of the bar and matches factors
 * across it. Nothing here does any algebra of its own.
 *
 * Whether what is left is "a function of u alone" is then a question anybody
 * can answer: replace every occurrence of `u` with a name, and see whether `x`
 * still appears.
 *
 * ## Why it cannot produce a wrong answer
 *
 * Because it does not produce an answer. It produces a *different integral*,
 * which is handed back to the integrator, which either solves it by a rule that
 * was already trusted or refuses it. If the substitution was a bad idea the
 * worst case is a refusal. And the caller checks the result by differentiating
 * it numerically before anybody sees it, which catches the one thing that could
 * go wrong here — a substitution undone incorrectly.
 *
 * ## Order, and why it matters for how the answer reads
 *
 * Candidates are tried largest first. `∫x/(x²+1)dx` works with `u = x²+1` and
 * with `u = x²`, and both give the same function; the first gives `½ln|x²+1|`
 * and the second gives `½ln|x²+1|` by way of `½ln|t+1|`, which is the same
 * thing arrived at more slowly. Bigger first is also the shape that fails
 * fastest when it is wrong.
 */
import {
  dependsOn,
  differentiate,
  fold,
  freshName,
  identifiersIn,
  multiply,
  nodeCount,
  replaceSubtree,
  sameTree,
  SymbolicError,
  visit,
  type Node,
} from "../../../symbolic";

/** What a found substitution says, so the integrator can undo it. */
export interface Substitution {
  /** The subexpression standing in for the new variable. */
  u: Node;
  /** The name `u` was given while the inner integral is done. */
  name: string;
  /** The integrand rewritten in that name, with no `x` left in it. */
  integrand: Node;
  /** `du/dx`, kept because it is what decides between two substitutions. */
  derivative: Node;
}

/**
 * Deeper than this and a candidate is a leaf or nearly one, where `u = x` says
 * nothing and `u = 2` has no derivative. The search would still be correct and
 * would spend its time on substitutions that cannot help.
 */
const MINIMUM_CANDIDATE_NODES = 2;

/**
 * How many subexpressions are tried before giving up.
 *
 * Each one costs a differentiation, a fold and a walk, so an integrand with a
 * hundred subexpressions would cost a hundred of those on its way to a refusal.
 * In practice the useful candidate is among the first few, because they are
 * tried largest first.
 */
const MAX_CANDIDATES = 24;

/**
 * A substitution that turns `node` into an integral in one new variable, or
 * `undefined` if no subexpression does.
 */
export function findSubstitution(
  node: Node,
  variable: string
): Substitution | undefined {
  const name = freshName(node, ["u", "w", "s", "v"]);
  let best: { found: Substitution; score: number } | undefined;
  for (const u of candidates(node, variable)) {
    const found = tryCandidate(node, variable, u, name);
    if (found === undefined) continue;
    const score = nodeCount(found.u) - nodeCount(found.derivative);
    if (best === undefined || score > best.score) best = { found, score };
  }
  return best?.found;
}

function tryCandidate(
  node: Node,
  variable: string,
  u: Node,
  name: string
): Substitution | undefined {
  let derivative: Node;
  try {
    derivative = fold(differentiate(u, variable));
  } catch (error) {
    // A candidate this cannot differentiate is simply not a candidate. The
    // differentiator refuses rather than guessing, and that refusal is about
    // the subexpression, not about the integral.
    if (error instanceof SymbolicError) return undefined;
    throw error;
  }
  // A `u` whose derivative is zero is free of the variable, and dividing by it
  // would be dividing by nothing.
  if (derivative.type === "Constant" && derivative.value === 0)
    return undefined;

  const quotient = fold({
    type: "BinaryOperator",
    name: "Divide",
    left: node,
    right: derivative,
  });
  const rewritten = fold(replaceSubtree(quotient, u, identifier(name)));
  // The test. Anything still mentioning x is not a function of u.
  if (dependsOn(rewritten, variable)) return undefined;
  return { u, name, integrand: rewritten, derivative };
}

function identifier(symbol: string) {
  return { type: "Identifier", symbol } as const;
}

/**
 * Every subexpression worth trying, without repeats.
 *
 * All of them are tried rather than the first that works, because more than one
 * usually does and they are not equally good. `∫x√(x²+1)dx` works with
 * `u = x²+1`, giving `(x²+1)^{3/2}/3`, and it also works with
 * `u = √(x²+1)`, giving `√(x²+1)³/3` -- the same function written as a
 * cube of a root, which is nobody's answer.
 *
 * The one kept is the one with the largest `u` relative to its derivative,
 * which is what "a good substitution" means: the point of the move is to take
 * a complicated subexpression out of the picture, and a `u` whose derivative
 * is as complicated as it was has not taken anything out.
 *
 * The whole integrand is excluded: `u = f(x)` makes `f/f'` the new integrand,
 * which is not progress, and when it happens to be it is the `f'/f` case the
 * logarithm rule already has. Anything free of the variable is excluded for the
 * same reason a constant cannot be substituted for.
 */
function candidates(node: Node, variable: string): Node[] {
  const found: Node[] = [];
  visit(node, (child) => {
    if (sameTree(child, node)) return;
    if (nodeCount(child) < MINIMUM_CANDIDATE_NODES) return;
    if (!dependsOn(child, variable)) return;
    if (found.some((existing) => sameTree(existing, child))) return;
    found.push(child);
  });
  // Largest first, so that the cap keeps the candidates most likely to help.
  found.sort((a, b) => nodeCount(b) - nodeCount(a));
  return found.slice(0, MAX_CANDIDATES);
}

/**
 * `sin^n u` and `cos^n u` for odd n, rewritten so that a substitution can find
 * them.
 *
 * The one family substitution cannot reach on its own, and it is worth the
 * special case because it is half of what a trigonometric-integral exercise
 * asks for. `∫sin³x dx` has no `u` that works: every candidate leaves a `sin x`
 * or a `cos x` behind. Peeling one factor off and writing the rest through
 * `sin² = 1 - cos²` gives `∫(1 - cos²x)·sin x dx`, where `u = cos x` works
 * immediately — and the rewrite is an identity, so nothing is being assumed.
 *
 * Even powers are left alone: they reduce through the half-angle identity
 * instead, which is a different rewrite and lives with the other table entries.
 */
export function oddTrigPower(node: Node, variable: string): Node | undefined {
  if (node.type !== "BinaryOperator" || node.name !== "Exponent")
    return undefined;
  const { left: base, right: exponent } = node;
  if (exponent.type !== "Constant") return undefined;
  const power = exponent.value;
  if (!Number.isInteger(power) || power < 3 || power > 9 || power % 2 === 0)
    return undefined;
  if (base.type !== "FunctionCall" || base.args.length !== 1) return undefined;
  const name = base.callee.symbol;
  if (name !== "sin" && name !== "cos") return undefined;
  const [argument] = base.args;
  if (!dependsOn(argument, variable)) return undefined;

  // sin^{2k+1} = (1 - cos²)^k · sin, and the same the other way round.
  const partner = name === "sin" ? "cos" : "sin";
  const squared: Node = {
    type: "BinaryOperator",
    name: "Exponent",
    left: {
      type: "FunctionCall",
      callee: identifier(partner),
      args: [argument],
    },
    right: { type: "Constant", value: 2 },
  };
  const reduced: Node = {
    type: "BinaryOperator",
    name: "Exponent",
    left: {
      type: "BinaryOperator",
      name: "Subtract",
      left: { type: "Constant", value: 1 },
      right: squared,
    },
    right: { type: "Constant", value: (power - 1) / 2 },
  };
  return multiply(
    reduced,
    base.args.length === 1 ? withArg(name, argument) : base
  );
}

function withArg(name: string, argument: Node): Node {
  return { type: "FunctionCall", callee: identifier(name), args: [argument] };
}

/** Whether a substitution left anything at all to integrate. */
export function mentions(node: Node, name: string) {
  return identifiersIn(node).includes(name);
}

/**
 * Every trigonometric function written as a sine or a cosine.
 *
 * The oldest trick in the book and the one that most often turns a refusal into
 * an answer. `secθ/tan²θ` is a quotient with the variable on both sides of the
 * bar and no rule reads it; `cosθ/sin²θ` is the same function, and the
 * substitution `u = sinθ` finishes it in one step. Six identities, no choices,
 * and every one of them is an equality on the whole domain where the left side
 * is defined.
 *
 * Applied only as a last resort, because it is a rewrite that makes an answer
 * *longer* when it does not help: nobody wants `∫tan x dx` reported as a
 * logarithm of a cosine it arrived at through `sin/cos`.
 */
export function asSinesAndCosines(
  node: Node,
  variable: string
): Node | undefined {
  let rewrote = false;
  const rewrite = (child: Node): Node => {
    if (child.type !== "FunctionCall" || child.args.length !== 1) return child;
    const [argument] = child.args;
    if (!dependsOn(argument, variable)) return child;
    const sin = withArg("sin", argument);
    const cos = withArg("cos", argument);
    switch (child.callee.symbol) {
      case "tan":
        rewrote = true;
        return divide(sin, cos);
      case "cot":
        rewrote = true;
        return divide(cos, sin);
      case "sec":
        rewrote = true;
        return divide(one(), cos);
      case "csc":
        rewrote = true;
        return divide(one(), sin);
      default:
        return child;
    }
  };
  const rewritten = mapTree(node, rewrite);
  return rewrote ? rewritten : undefined;
}

function one(): Node {
  return { type: "Constant", value: 1 };
}

function divide(left: Node, right: Node): Node {
  return { type: "BinaryOperator", name: "Divide", left, right };
}

/** Bottom-up rewrite over the shapes an integrand is built from. */
function mapTree(node: Node, on: (child: Node) => Node): Node {
  const rebuilt: Node =
    node.type === "Negative"
      ? { ...node, arg: mapTree(node.arg, on) }
      : node.type === "FunctionCall"
        ? { ...node, args: node.args.map((arg) => mapTree(arg, on)) }
        : node.type === "BinaryOperator"
          ? {
              ...node,
              left: mapTree(node.left, on),
              right: mapTree(node.right, on),
            }
          : node;
  return on(rebuilt);
}
