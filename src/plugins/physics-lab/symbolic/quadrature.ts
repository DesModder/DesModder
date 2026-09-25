/**
 * Definite integrals to thirty-odd digits, for the ones with no antiderivative.
 *
 * `∫₋∞^∞ e^{−x²} dx` has no elementary antiderivative and is exactly √π.
 * There is no `F(b) − F(a)` to evaluate, but there is the number, and with
 * enough of its digits the recogniser can say which constant it is. So the
 * integral is computed to more digits than a double holds, by the
 * double-exponential rules of Takahasi and Mori (1974), in decimal
 * arithmetic:
 *
 * - `[a, b]`, tanh-sinh: `x = c + r·tanh(π/2 · sinh t)`. The nodes crowd into
 *   the ends double-exponentially, so a singularity there — `ln x` at 0,
 *   `1/√(1 − x²)` at ±1 — costs almost nothing.
 * - `[a, ∞)`, exp-sinh: `x = a + e^{π/2 · sinh t}`.
 * - `(−∞, ∞)`, sinh-sinh: `x = sinh(π/2 · sinh t)`.
 *
 * Near an endpoint the node is written as the endpoint plus a gap, and the
 * integrand is evaluated with enough extra digits to hold that gap: at
 * `x = 1 − 10⁻⁶⁰`, `1 − x²` in fifty digits is 0, and the true term is not.
 *
 * Each halving of the step roughly doubles the digits, and the answer is the
 * one two successive steps agree on, to the digits they agree on. An integral
 * that never settles — a divergent one, or an oscillation these rules are not
 * built for, `sin x / x` out to infinity — is reported as not settling, never
 * as a number.
 */
import {
  decimalContext,
  evaluatePrecise,
  type Decimal,
  type Node,
} from "../../../symbolic";
import { exactConstant, type Bound } from "./definite";
import * as X from "./exact";

/** Digits carried in the arithmetic; the answer is trusted to fewer. */
const WORKING = 50;
/** The finest step tried is 2^-MAX_LEVEL. */
const MAX_LEVEL = 8;
/** A gap smaller than this is past anything the sum can feel. */
const SMALLEST_GAP_DIGITS = 300;

export interface QuadratureResult {
  value: Decimal;
  /** Significant digits on which the last two steps agree. */
  digits: number;
}

/** A node: where it is (as an endpoint plus a gap, or outright) and its weight. */
interface Node0 {
  /** The finite endpoint the node is near, or undefined for a plain point. */
  from?: Bound;
  /** Distance from that endpoint, signed toward the interior. */
  offset: Decimal;
  weight: Decimal;
}

/** {@link quadratureSteps}, run to the end. */
export function preciseIntegral(
  node: Node,
  variable: string,
  lower: Bound,
  upper: Bound,
  target = 32
): QuadratureResult | undefined {
  const steps = quadratureSteps(node, variable, lower, upper, target);
  for (;;) {
    const next = steps.next();
    if (next.done === true) return next.value;
  }
}

/**
 * The integral, computed a node at a time: it yields after every evaluation
 * of the integrand, so a caller can spread a second of arithmetic across
 * frames instead of freezing the panel while it runs.
 */
export function* quadratureSteps(
  node: Node,
  variable: string,
  lower: Bound,
  upper: Bound,
  target = 32
): Generator<void, QuadratureResult | undefined> {
  const D = decimalContext(WORKING);
  const valueOf = (b: Bound, digits: number): Decimal => {
    const Dd = decimalContext(digits);
    if (b.kind === "infinite") return new Dd(NaN);
    const exact = exactConstant(b.node);
    return exact === undefined
      ? new Dd(b.value)
      : new Dd(X.toDecimal(exact, digits));
  };
  const halfPi = D.acos(-1).div(2);

  let rule: (t: Decimal) => Node0;
  let sign = 1;
  let lo = lower;
  let hi = upper;
  // Written in increasing order, with the sign of the swap kept aside.
  const order = (b: Bound) =>
    b.kind === "infinite" ? b.sign * Infinity : b.value;
  if (order(lo) > order(hi)) {
    [lo, hi] = [hi, lo];
    sign = -1;
  }
  if (order(lo) === order(hi)) return { value: new D(0), digits: target };

  if (lo.kind === "finite" && hi.kind === "finite") {
    const half = valueOf(hi, WORKING).minus(valueOf(lo, WORKING)).div(2);
    rule = (t) => {
      const u = halfPi.times(sinh(D, t));
      // 1 − tanh|u| = 2/(e^{2|u|} + 1), which does not cancel.
      const gap = half.times(2).div(D.exp(u.abs().times(2)).plus(1));
      const c = cosh(D, u);
      const weight = half.times(halfPi).times(cosh(D, t)).div(c.times(c));
      return t.isNegative()
        ? { from: lo, offset: gap, weight }
        : { from: hi, offset: gap.neg(), weight };
    };
  } else if (lo.kind === "finite" || hi.kind === "finite") {
    // [a, ∞): x = a + e^u; (−∞, b]: x = b − e^u.
    const end = lo.kind === "finite" ? lo : hi;
    const towards = lo.kind === "finite" ? 1 : -1;
    rule = (t) => {
      const u = halfPi.times(sinh(D, t));
      const e = D.exp(u);
      return {
        from: end,
        offset: e.times(towards),
        weight: halfPi.times(cosh(D, t)).times(e),
      };
    };
  } else {
    rule = (t) => {
      const u = halfPi.times(sinh(D, t));
      return {
        offset: sinh(D, u),
        weight: halfPi.times(cosh(D, t)).times(cosh(D, u)),
      };
    };
  }

  // The integrand at a node, with the digits the node needs.
  const term = (t: Decimal): Decimal | undefined => {
    const { from, offset, weight } = rule(t);
    if (!offset.isFinite() || !weight.isFinite() || weight.isZero())
      return new D(0);
    let x: Decimal;
    let digits = WORKING;
    if (from === undefined) x = offset;
    else {
      // The gap's own exponent is how many digits below the endpoint it sits.
      const below = Math.max(0, -offset.abs().e);
      if (below > SMALLEST_GAP_DIGITS) return new D(0);
      digits = WORKING + below;
      x = valueOf(from, digits).plus(offset);
    }
    let y: Decimal;
    try {
      y = evaluatePrecise(node, { [variable]: x }, digits);
    } catch {
      return undefined;
    }
    if (!y.isFinite()) return undefined;
    return new D(y).times(weight);
  };

  const negligible = new D(10).pow(-(WORKING - 5));
  function* sideSum(
    h: Decimal,
    start: number,
    step: number
  ): Generator<void, Decimal | undefined> {
    let total = new D(0);
    for (const direction of [1, -1]) {
      let small = 0;
      for (let k = start; ; k += step) {
        const t = h.times(k * direction);
        // The transformations are past every representable node by here.
        if (t.abs().gt(6.5)) break;
        const value = term(t);
        yield;
        if (value === undefined) return undefined;
        total = total.plus(value);
        if (value.abs().lte(negligible.times(total.abs().plus(1)))) {
          small += 1;
          if (small >= 3) break;
        } else small = 0;
      }
    }
    return total;
  }

  let h = new D(1);
  const centre = term(new D(0));
  const first = yield* sideSum(h, 1, 1);
  if (centre === undefined || first === undefined) return undefined;
  let sum = centre.plus(first);
  let estimate = sum.times(h);
  let previousDifference: Decimal | undefined;
  for (let level = 1; level <= MAX_LEVEL; level++) {
    h = h.div(2);
    // The new nodes are the odd multiples of the new step.
    const odd = yield* sideSum(h, 1, 2);
    if (odd === undefined) return undefined;
    sum = sum.plus(odd);
    const next = sum.times(h);
    const difference = next.minus(estimate).abs();
    estimate = next;
    const scale = D.max(estimate.abs(), new D(10).pow(-WORKING));
    const relative = difference.div(scale);
    const digits = relative.isZero()
      ? WORKING - 10
      : Math.floor(-relative.log(10).toNumber());
    // Converged, and converging: the difference fell on the last step too,
    // which is what separates settling from creeping.
    if (
      digits >= target &&
      previousDifference !== undefined &&
      difference.lte(previousDifference)
    )
      return {
        value: sign < 0 ? estimate.neg() : estimate,
        digits: Math.min(digits, WORKING - 10),
      };
    previousDifference = difference;
  }
  return undefined;
}

function sinh(D: typeof Decimal, x: Decimal): Decimal {
  if (x.abs().lt(0.5)) return D.sinh(x);
  const e = D.exp(x);
  return e.minus(new D(1).div(e)).div(2);
}

function cosh(D: typeof Decimal, x: Decimal): Decimal {
  const e = D.exp(x.abs());
  return e.plus(new D(1).div(e)).div(2);
}
