/**
 * Evaluation to many digits, for when sixteen are not enough.
 *
 * {@link evaluate} works in doubles, which carry about sixteen significant
 * digits and lose some at every step. That is plenty for plotting and not
 * enough for two jobs here: showing an exact answer's decimal to twelve
 * places with digits to spare, and checking a limit close to its point, where
 * a double rounds the answer away entirely — `1 − cos(10⁻⁸)` is exactly 0 in
 * floating point, and a check sampled there sees nothing but rounding.
 *
 * `decimal.js` does the arithmetic, correctly rounded at a stated precision.
 * The tree walk mirrors `evaluate`'s, node for node, so the two cannot mean
 * different things by the same expression; anything this cannot evaluate is
 * NaN, as it is there.
 */
import Decimal from "decimal.js";
import type { Node } from "./tree";

/** Significant digits worked in: far past what is shown, so none is lost. */
export const WORKING_DIGITS = 60;

const contexts = new Map<number, typeof Decimal>();

/** A `Decimal` constructor working at `digits` significant digits. */
export function decimalContext(digits = WORKING_DIGITS): typeof Decimal {
  let context = contexts.get(digits);
  if (context === undefined) {
    context = Decimal.clone({
      precision: digits,
      rounding: Decimal.ROUND_HALF_EVEN,
      // toExpPos and toExpNeg stay at their defaults. They only choose when a
      // string uses exponent notation, not the range, which is maxE, but
      // decimal.js goes through strings inside `pow`. Set to 9e15, raising
      // e^{10⁸} to a power wrote out a hundred-million-digit string, and a
      // limit at infinity that sampled there ran out of memory.
    });
    contexts.set(digits, context);
  }
  return context;
}

export type PreciseBindings = Readonly<Record<string, Decimal>>;

type Unary = (D: typeof Decimal, x: Decimal) => Decimal;

/*
 * The hyperbolic functions through `exp`, not decimal.js's own: those sum a
 * series in the argument itself and did not finish for x = 10⁶, which is
 * where a limit at infinity samples. `exp` reduces its argument first.
 */
const sinh: Unary = (D, x) => {
  // Near zero the difference of exponentials cancels, so the series instead.
  if (x.abs().lt(0.5)) return D.sinh(x);
  const e = D.exp(x);
  return e.minus(new D(1).div(e)).div(2);
};

const cosh: Unary = (D, x) => {
  const e = D.exp(x.abs());
  return e.plus(new D(1).div(e)).div(2);
};

// Written with e^{−2|x|}, which only shrinks, so a huge x gives ±1 and not
// ∞/∞.
const tanh: Unary = (D, x) => {
  if (x.abs().lt(0.5)) return D.tanh(x);
  const e = D.exp(x.abs().times(-2));
  const t = new D(1).minus(e).div(new D(1).plus(e));
  return x.isNegative() ? t.neg() : t;
};

const FUNCTIONS: Record<string, Unary> = {
  sin: (D, x) => D.sin(x),
  cos: (D, x) => D.cos(x),
  tan: (D, x) => D.tan(x),
  cot: (D, x) => new D(1).div(D.tan(x)),
  sec: (D, x) => new D(1).div(D.cos(x)),
  csc: (D, x) => new D(1).div(D.sin(x)),
  arcsin: (D, x) => D.asin(x),
  arccos: (D, x) => D.acos(x),
  arctan: (D, x) => D.atan(x),
  arccot: (D, x) => D.acos(-1).div(2).minus(D.atan(x)),
  arcsec: (D, x) => D.acos(new D(1).div(x)),
  arccsc: (D, x) => D.asin(new D(1).div(x)),
  sinh,
  cosh,
  tanh,
  coth: (D, x) => new D(1).div(tanh(D, x)),
  sech: (D, x) => new D(1).div(cosh(D, x)),
  csch: (D, x) => new D(1).div(sinh(D, x)),
  arcsinh: (D, x) => D.asinh(x),
  arccosh: (D, x) => D.acosh(x),
  arctanh: (D, x) => D.atanh(x),
  exp: (D, x) => D.exp(x),
  ln: (D, x) => D.ln(x),
  log: (D, x) => D.log10(x),
  sqrt: (D, x) => D.sqrt(x),
  abs: (D, x) => D.abs(x),
  sign: (D, x) => new D(D.sign(x)),
  floor: (D, x) => D.floor(x),
  ceil: (D, x) => D.ceil(x),
  // JavaScript's and Desmos's rounding: halves go up.
  round: (D, x) => x.toDecimalPlaces(0, D.ROUND_HALF_CEIL),
};

const COMPARE: Record<string, (a: Decimal, b: Decimal) => boolean> = {
  "<": (a, b) => a.lt(b),
  "<=": (a, b) => a.lte(b),
  "=": (a, b) => a.eq(b),
  ">=": (a, b) => a.gte(b),
  ">": (a, b) => a.gt(b),
};

/**
 * The value of the tree at `digits` significant digits, NaN for anything it
 * cannot evaluate. A zero or negative argument to a logarithm is NaN, not an
 * error, for the reason `evaluate` gives: callers are sampling, and a point
 * outside the domain is ordinary.
 */
export function evaluatePrecise(
  node: Node,
  bindings: PreciseBindings,
  digits = WORKING_DIGITS
): Decimal {
  const D = decimalContext(digits);
  const walk = (n: Node): Decimal => {
    switch (n.type) {
      case "Constant":
        return new D(n.value);
      case "Identifier":
        if (n.symbol === "pi") return D.acos(-1);
        if (n.symbol === "e") return D.exp(1);
        return bindings[n.symbol] === undefined
          ? new D(NaN)
          : new D(bindings[n.symbol]);
      case "Negative":
        return walk(n.arg).neg();
      case "FunctionCall": {
        const fn = FUNCTIONS[n.callee.symbol];
        if (fn === undefined || n.args.length !== 1) return new D(NaN);
        const x = walk(n.args[0]);
        if (x.isNaN()) return x;
        try {
          return fn(D, x);
        } catch {
          return new D(NaN);
        }
      }
      case "Piecewise": {
        const holds = n.condition === true || conditionHolds(n.condition);
        return walk(holds ? n.consequent : n.alternate);
      }
      case "BinaryOperator": {
        const left = walk(n.left);
        const right = walk(n.right);
        switch (n.name) {
          case "Add":
            return left.plus(right);
          case "Subtract":
            return left.minus(right);
          case "Multiply":
          case "CrossMultiply":
            return left.times(right);
          case "Divide":
            return left.div(right);
          case "Exponent":
            return power(D, left, right);
        }
        return new D(NaN);
      }
      default:
        return new D(NaN);
    }
  };
  const conditionHolds = (condition: Node): boolean => {
    const links: [Node, string, Node][] =
      condition.type === "Comparator"
        ? [[condition.left, condition.operator, condition.right]]
        : condition.type === "ComparatorChain"
          ? condition.symbols.map((symbol, i) => [
              condition.args[i],
              symbol,
              condition.args[i + 1],
            ])
          : [];
    if (links.length === 0) return false;
    return links.every(([left, operator, right]) => {
      const a = walk(left);
      const b = walk(right);
      if (a.isNaN() || b.isNaN()) return false;
      return (COMPARE[operator] ?? (() => false))(a, b);
    });
  };
  return walk(node);
}

/**
 * `base^exponent` as `Math.pow` means it: a negative base only to an
 * integer power, where the answer is real.
 */
function power(D: typeof Decimal, base: Decimal, exponent: Decimal): Decimal {
  if (base.isNaN() || exponent.isNaN()) return new D(NaN);
  if (base.isNegative() && !base.isZero() && !exponent.isInteger())
    return new D(NaN);
  if (base.isZero() && exponent.isNegative()) return new D(Infinity);
  return D.pow(base, exponent);
}

/** A decimal as a number, for the callers that only need a double. */
export const toDouble = (value: Decimal) => value.toNumber();

export type { Decimal };
