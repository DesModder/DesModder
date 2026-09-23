/**
 * A small numeric evaluator over the same syntax tree the symbolic code works
 * on.
 *
 * It exists to check the symbolic code's claims. An antiderivative is a claim
 * that differentiating it returns the integrand, and a solved differential
 * equation is a claim that substituting it satisfies the equation — both are
 * checkable at a handful of points in a few microseconds, and neither is
 * checkable by looking at the LaTeX.
 *
 * That check is worth having because the failure mode here is not a crash. A
 * wrong antiderivative produces a perfectly plausible curve that quietly
 * disagrees with the slope field it came from, and the reader has no way to
 * tell which of the two is lying.
 *
 * Deliberately not Desmos's evaluator. Desmos has one and it is better than
 * this, but reaching it means creating a `HelperExpression` and waiting for an
 * observer to fire — asynchronous, and far too slow to run over a grid of
 * sample points while somebody is typing.
 */
import type { Node } from "./tree";

export type Bindings = Readonly<Record<string, number>>;

const FUNCTIONS: Record<string, (x: number) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  cot: (x) => 1 / Math.tan(x),
  sec: (x) => 1 / Math.cos(x),
  csc: (x) => 1 / Math.sin(x),
  arcsin: Math.asin,
  arccos: Math.acos,
  arctan: Math.atan,
  arccot: (x) => Math.PI / 2 - Math.atan(x),
  arcsec: (x) => Math.acos(1 / x),
  arccsc: (x) => Math.asin(1 / x),
  sinh: Math.sinh,
  cosh: Math.cosh,
  tanh: Math.tanh,
  // The reciprocal hyperbolics, which the derivative table emits and JavaScript
  // does not provide. Without them a correct derivative of tanh evaluates to
  // NaN and the numeric check passes by never having tested anything.
  coth: (x) => 1 / Math.tanh(x),
  sech: (x) => 1 / Math.cosh(x),
  csch: (x) => 1 / Math.sinh(x),
  arcsinh: Math.asinh,
  arccosh: Math.acosh,
  arctanh: Math.atanh,
  exp: Math.exp,
  ln: Math.log,
  log: Math.log10,
  sqrt: Math.sqrt,
  abs: Math.abs,
  sign: Math.sign,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
};

/**
 * The value of the tree under the given bindings, or `NaN` for anything it
 * cannot evaluate.
 *
 * `NaN` rather than a thrown error because every caller is sampling: a point
 * where the expression is undefined is ordinary — `ln(x)` left of zero, a
 * denominator at its pole — and it should skip that point rather than abandon
 * the check.
 */
export function evaluate(node: Node, bindings: Bindings): number {
  switch (node.type) {
    case "Constant":
      return node.value;
    case "Identifier": {
      if (node.symbol === "pi") return Math.PI;
      if (node.symbol === "e") return Math.E;
      return bindings[node.symbol] ?? NaN;
    }
    case "Negative":
      return -evaluate(node.arg, bindings);
    case "FunctionCall": {
      const fn = FUNCTIONS[node.callee.symbol];
      if (fn === undefined || node.args.length !== 1) return NaN;
      return fn(evaluate(node.args[0], bindings));
    }
    case "BinaryOperator": {
      const left = evaluate(node.left, bindings);
      const right = evaluate(node.right, bindings);
      switch (node.name) {
        case "Add":
          return left + right;
        case "Subtract":
          return left - right;
        case "Multiply":
        case "CrossMultiply":
          return left * right;
        case "Divide":
          return left / right;
        case "Exponent":
          return Math.pow(left, right);
      }
      return NaN;
    }
    default:
      return NaN;
  }
}

/**
 * The derivative of `node` with respect to `variable` at a point, by a central
 * difference.
 *
 * The step is scaled to the point rather than fixed, because a fixed step is
 * both too coarse near zero and too fine far from it. The cube root of machine
 * epsilon is the standard choice for a central difference: it balances the
 * truncation error, which falls as h², against the cancellation error, which
 * grows as 1/h.
 */
export function numericDerivative(
  node: Node,
  variable: string,
  bindings: Bindings
): number {
  const at = bindings[variable];
  const h = 6.06e-6 * Math.max(1, Math.abs(at));
  const forward = evaluate(node, { ...bindings, [variable]: at + h });
  const backward = evaluate(node, { ...bindings, [variable]: at - h });
  return (forward - backward) / (2 * h);
}

/**
 * The second derivative at a point, by the central three-point formula.
 *
 * The step is the fourth root of machine epsilon rather than the cube root the
 * first derivative uses, because cancellation is worse here: the formula
 * subtracts three values of comparable size and divides by h², so too small a
 * step loses more precision than the extra truncation error costs.
 */
export function numericSecondDerivative(
  node: Node,
  variable: string,
  bindings: Bindings
): number {
  const at = bindings[variable];
  const h = 1.22e-4 * Math.max(1, Math.abs(at));
  const forward = evaluate(node, { ...bindings, [variable]: at + h });
  const middle = evaluate(node, bindings);
  const backward = evaluate(node, { ...bindings, [variable]: at - h });
  return (forward - 2 * middle + backward) / (h * h);
}

/**
 * Whether two functions agree at a spread of sample points.
 *
 * Points where either side is undefined are skipped rather than counted as
 * disagreement, and the whole check fails if too few usable points remain —
 * otherwise an expression undefined almost everywhere would pass by never being
 * tested. The tolerance is relative, because these are compared against a
 * central difference whose own error grows with the magnitude of the answer.
 */
export function agreesOnSamples(
  left: (bindings: Bindings) => number,
  right: (bindings: Bindings) => number,
  samples: readonly Bindings[],
  tolerance = 1e-4
): boolean {
  let checked = 0;
  for (const bindings of samples) {
    const a = left(bindings);
    const b = right(bindings);
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    checked += 1;
    const scale = Math.max(1, Math.abs(a), Math.abs(b));
    if (Math.abs(a - b) > tolerance * scale) return false;
  }
  return checked >= Math.ceil(samples.length / 3);
}
