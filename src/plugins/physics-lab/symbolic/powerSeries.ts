/**
 * Power series computed from the expression itself, to a stated order.
 *
 * `series.ts` knows a closed general term for one function of a monomial —
 * `x^m f(a x^k)` — and that is the best answer there is when it applies: the
 * sum *is* the function. Everything else it refuses. `e^{sin x}` has no
 * general term anybody writes down, and neither does `sin(x)e^{x²}`, and both
 * have Maclaurin series whose coefficients are perfectly exact rationals. This
 * computes those coefficients by arithmetic on truncated series:
 *
 * - sums and products term by term, quotients by the usual recurrence;
 * - a known function of an argument by composing its own Maclaurin series
 *   with the argument's, after moving the argument's constant term out with
 *   the addition formulas: `e^{c+w} = e^c e^w`, `sin(c+w) = sin c cos w +
 *   cos c sin w`, `ln(c+w) = ln c + ln(1 + w/c)`;
 * - a rational power of something whose leading coefficient has an exact root.
 *
 * ## Over which numbers
 *
 * Generic over the field the coefficients live in. Over the rationals it is
 * fast and is all the integrator's series fallback needs. Over the exact
 * constants of `exact.ts` — π, e, square roots, logarithms of primes, and the
 * special values of the functions at them — it expands what the rationals
 * cannot: `(1 + π/x)^x` has `π` in its coefficients and tends to `e^π`, and
 * `sin x` about `π/6` has `1/2` and `√3/2` in its. The exact field is built
 * by the caller, which is what keeps this module free of `definite.ts`.
 *
 * ## What it is, and what it is not
 *
 * Every coefficient is exact — `1/24`, never `0.041666` — and the truncation is
 * stated: the answer is the first terms of the series *and* the order they are
 * good to, `+ O(x^N)`. What this never does is decide that a pattern in the
 * first few coefficients is the general term; that would be guessing. A
 * coefficient the field cannot represent exactly — a root of `1 + π`, say — is
 * a refusal, never an approximation.
 */
import {
  add,
  call,
  dependsOn,
  divide,
  evaluate,
  fold,
  id,
  multiply,
  number,
  power,
  type Node,
} from "../../../symbolic";
import * as Q from "./rational";
import { rationalNode } from "./field";

/** Thrown for an expression this cannot expand. */
export class PowerSeriesError extends Error {}

/**
 * The numbers the coefficients are drawn from.
 *
 * `isZero` must be *certified*: a coefficient that is zero and is not
 * recognised as zero would be taken as a leading term, and the limit read off
 * it would be wrong rather than merely unknown.
 */
export interface CoefficientField<T> {
  zero: T;
  one: T;
  fromRational: (q: Q.Rational) => T;
  add: (a: T, b: T) => T;
  negate: (a: T) => T;
  multiply: (a: T, b: T) => T;
  /** `1/a`, or undefined when it has no exact form here. */
  inverse: (a: T) => T | undefined;
  isZero: (a: T) => boolean;
  /** `a^r` for a rational `r`, or undefined when not exact here. */
  power: (a: T, r: Q.Rational) => T | undefined;
  /** A constant sub-expression — `π`, `√2`, `ln 3` — as a coefficient. */
  constant: (node: Node) => T | undefined;
  /** `f(c)` for a function this knows, when it is exact here. */
  apply: (name: string, c: T) => T | undefined;
}

/** The rationals: the fast field, and the one every antiderivative uses. */
export const RATIONALS: CoefficientField<Q.Rational> = {
  zero: Q.ZERO,
  one: Q.ONE,
  fromRational: (q) => q,
  add: Q.add,
  negate: Q.negate,
  multiply: Q.multiply,
  inverse: (a) => (Q.isZero(a) ? undefined : Q.divide(Q.ONE, a)),
  isZero: Q.isZero,
  power: (a, r) => {
    if (Q.isInteger(r)) {
      if (Q.isZero(a) && Q.isNegative(r)) return undefined;
      return Q.pow(a, r.n);
    }
    return rationalRoot(Q.pow(a, r.n), Number(r.d));
  },
  constant: (node) => rationalOfNode(node),
  // Only the values that are themselves rational: ln 1 = 0.
  apply: (name, c) =>
    name === "ln" && Q.equals(c, Q.ONE) ? Q.ZERO : undefined,
};

/**
 * `Σ c[i] x^{v+i}`, known for every exponent below `v + c.length`.
 *
 * Carrying the order with the coefficients is the point: a quotient by a
 * series that starts at `x²` loses two orders, and an answer that claimed the
 * lost terms would be claiming coefficients nobody computed.
 */
interface Series<T> {
  v: number;
  c: T[];
}

const orderOf = <T>(s: Series<T>) => s.v + s.c.length;

/**
 * The arithmetic on series, over one field. A class so that the field is
 * fixed once rather than threaded through every call.
 */
class Expander<T> {
  constructor(
    private readonly F: CoefficientField<T>,
    private readonly variable: string
  ) {}

  coefficient(s: Series<T>, exponent: number): T {
    return exponent < s.v ? this.F.zero : (s.c[exponent - s.v] ?? this.F.zero);
  }

  /** Leading zeros moved into the valuation, and nothing past `cap` kept. */
  normalise(s: Series<T>, cap: number): Series<T> {
    let { v } = s;
    let c = s.c.slice(0, Math.max(0, cap - v));
    while (c.length > 0 && this.F.isZero(c[0])) {
      c = c.slice(1);
      v += 1;
    }
    return { v, c };
  }

  constant(value: T, cap: number): Series<T> {
    return this.normalise(
      {
        v: 0,
        c: [value, ...new Array<T>(Math.max(0, cap - 1)).fill(this.F.zero)],
      },
      cap
    );
  }

  scale(s: Series<T>, by: T): Series<T> {
    return { v: s.v, c: s.c.map((value) => this.F.multiply(value, by)) };
  }

  add(a: Series<T>, b: Series<T>, cap: number, sign = 1): Series<T> {
    const order = Math.min(orderOf(a), orderOf(b), cap);
    const v = Math.min(a.v, b.v);
    const c: T[] = [];
    for (let e = v; e < order; e += 1) {
      const right = this.coefficient(b, e);
      c.push(
        this.F.add(
          this.coefficient(a, e),
          sign < 0 ? this.F.negate(right) : right
        )
      );
    }
    return this.normalise({ v, c }, cap);
  }

  multiply(a: Series<T>, b: Series<T>, cap: number): Series<T> {
    const v = a.v + b.v;
    const order = Math.min(a.v + orderOf(b), b.v + orderOf(a), cap);
    const c: T[] = [];
    for (let e = v; e < order; e += 1) {
      let total = this.F.zero;
      for (let i = 0; i <= e - v; i += 1)
        total = this.F.add(
          total,
          this.F.multiply(
            this.coefficient(a, a.v + i),
            this.coefficient(b, b.v + e - v - i)
          )
        );
      c.push(total);
    }
    return this.normalise({ v, c }, cap);
  }

  inverse(a: Series<T>, cap: number): Series<T> {
    if (a.c.length === 0) {
      throw new PowerSeriesError(
        "A quotient by something that vanishes to every order computed has no series here."
      );
    }
    const lead = this.F.inverse(a.c[0]);
    if (lead === undefined)
      throw new PowerSeriesError(
        "The leading coefficient of a divisor has no exact reciprocal here."
      );
    const n = Math.min(a.c.length, cap + a.v);
    const b: T[] = [lead];
    for (let k = 1; k < n; k += 1) {
      let total = this.F.zero;
      for (let j = 1; j <= k; j += 1)
        total = this.F.add(
          total,
          this.F.multiply(a.c[j] ?? this.F.zero, b[k - j])
        );
      b.push(this.F.negate(this.F.multiply(total, lead)));
    }
    return this.normalise({ v: -a.v, c: b }, cap);
  }

  /** `Σ f[k] u^k` for a series `u` that vanishes at zero. */
  compose(f: (k: number) => Q.Rational, u: Series<T>, cap: number): Series<T> {
    if (u.c.length > 0 && u.v < 1) {
      throw new PowerSeriesError(
        "Only a function of something that is zero at the point is composed directly."
      );
    }
    // u^k starts at x^{k v}, so terms beyond the cap cannot contribute.
    const valuation = u.c.length === 0 ? cap : u.v;
    const maxK = Math.floor(cap / Math.max(1, valuation)) + 1;
    let total = this.constant(this.F.fromRational(f(0)), cap);
    let raised = this.constant(this.F.one, cap);
    for (let k = 1; k <= maxK; k += 1) {
      raised = this.multiply(raised, u, cap);
      const fk = f(k);
      if (Q.isZero(fk)) continue;
      total = this.add(total, this.scale(raised, this.F.fromRational(fk)), cap);
    }
    // What composing cannot know: the order of u bounds the order of f(u).
    const order = Math.min(orderOf(total), u.c.length === 0 ? cap : orderOf(u));
    return this.normalise(
      { v: total.v, c: total.c.slice(0, Math.max(0, order - total.v)) },
      cap
    );
  }

  /** `s^r` for a rational `r`. */
  power(s: Series<T>, r: Q.Rational, cap: number): Series<T> {
    if (Q.isInteger(r)) {
      let exponent = Number(r.n);
      let base = s;
      if (exponent < 0) {
        base = this.inverse(s, cap);
        exponent = -exponent;
      }
      let total = this.constant(this.F.one, cap);
      for (let i = 0; i < exponent; i += 1)
        total = this.multiply(total, base, cap);
      return total;
    }
    if (s.c.length === 0) {
      throw new PowerSeriesError("A fractional power of zero has no series.");
    }
    // s = a x^v (1 + w), so s^r = a^r x^{vr} (1 + w)^r, which needs both a^r and
    // v r to be exact.
    const shifted = Q.multiply(Q.rational(BigInt(s.v)), r);
    if (!Q.isInteger(shifted)) {
      throw new PowerSeriesError(
        "A fractional power of x, like √x, is not a power series; it has no expansion in whole powers about zero."
      );
    }
    const [lead] = s.c;
    const raised = this.F.power(lead, r);
    const reciprocal = this.F.inverse(lead);
    if (raised === undefined || reciprocal === undefined) {
      throw new PowerSeriesError(
        "The leading coefficient has no exact root here, so the series would not have exact coefficients."
      );
    }
    const w: Series<T> = this.normalise(
      {
        v: 0,
        c: [
          this.F.zero,
          ...s.c.slice(1).map((value) => this.F.multiply(value, reciprocal)),
        ],
      },
      cap - s.v
    );
    const body = this.compose((k) => binomial(r, k), w, cap);
    return this.normalise(
      { v: body.v + Number(shifted.n), c: this.scale(body, raised).c },
      cap
    );
  }

  series(node: Node, cap: number): Series<T> {
    switch (node.type) {
      case "Constant": {
        const value = Q.fromNumber(node.value);
        if (value === undefined)
          throw new PowerSeriesError("That number has no exact value.");
        return this.constant(this.F.fromRational(value), cap);
      }
      case "Identifier": {
        if (node.symbol === this.variable)
          return this.normalise(
            {
              v: 1,
              c: new Array<T>(Math.max(0, cap - 1))
                .fill(this.F.zero)
                .map((z, i) => (i === 0 ? this.F.one : z)),
            },
            cap
          );
        const value = this.F.constant(node);
        if (value === undefined)
          throw new PowerSeriesError(
            `${node.symbol} has no exact value here, so a series in it would not have exact coefficients.`
          );
        return this.constant(value, cap);
      }
      case "Negative": {
        const inner = this.series(node.arg, cap);
        return { v: inner.v, c: inner.c.map((c) => this.F.negate(c)) };
      }
      case "BinaryOperator": {
        if (node.name === "Exponent")
          return this.exponent(node.left, node.right, cap);
        // A quotient's divisor can start at a negative power and a product's
        // factor at a positive one, so both sides get room to spare.
        const margin = cap + 8;
        const left = this.series(node.left, margin);
        const right = this.series(node.right, margin);
        switch (node.name) {
          case "Add":
            return this.add(left, right, cap);
          case "Subtract":
            return this.add(left, right, cap, -1);
          case "Multiply":
          case "CrossMultiply":
            return this.multiply(left, right, cap);
          case "Divide":
            return this.multiply(left, this.inverse(right, margin), cap);
        }
        throw new PowerSeriesError("That operation has no series here.");
      }
      case "FunctionCall":
        return this.function(node.callee.symbol, node.args, cap);
      default:
        throw new PowerSeriesError(
          "That kind of expression has no series here."
        );
    }
  }

  exponent(base: Node, exponent: Node, cap: number): Series<T> {
    if (base.type === "Identifier" && base.symbol === "e")
      return this.function("exp", [exponent], cap);
    // A rational exponent written as one: powers, roots, and the binomial
    // series. Only as written. The exponent's floating-point value is never
    // read back as a rational — π would come back as 3141592653589793/10¹⁵,
    // an approximation passed off as exact.
    const exact = rationalOfNode(exponent);
    if (exact !== undefined)
      return this.power(this.series(base, cap + 8), exact, cap);
    // Anything else: b^u = e^{u ln b}. That covers 2^x and π^x, whose
    // coefficients carry ln 2 and ln π, and x^π about 1. The logarithm
    // refuses a base that vanishes or is negative at the point, which is
    // where this stops being real.
    if (!dependsOn(base, this.variable) && !(evaluate(base, {}) > 0))
      throw new PowerSeriesError(
        "A power of a base that is not positive has no real logarithm to expand with."
      );
    return this.function("exp", [multiply(exponent, call("ln", base))], cap);
  }

  function(name: string, args: readonly Node[], cap: number): Series<T> {
    if (args.length !== 1)
      throw new PowerSeriesError(`${name} takes more than one argument.`);
    const wide = cap + 8;
    const inner = this.series(args[0], wide);
    // A root takes the leading power out itself: √(x^{-2} + …) is x^{-1}(…).
    if (name === "sqrt") return this.power(inner, Q.rational(1n, 2n), cap);
    if (inner.v < 0)
      throw new PowerSeriesError(
        `${name} of something that blows up at the point has no power series.`
      );
    // The argument's value at the point, moved out with the function's own
    // addition formula so that what is composed vanishes there.
    const c = this.coefficient(inner, 0);
    const w = this.add(inner, this.constant(c, wide), wide, -1);
    const shifted = !this.F.isZero(c);
    const at = (fn: string) => {
      const value = this.F.apply(fn, c);
      if (value === undefined)
        throw new PowerSeriesError(
          `${fn} of the value there has no exact form, so neither does its series.`
        );
      return value;
    };
    const composed = (fn: string) => this.compose(MACLAURIN[fn], w, wide);
    // f(c + w) = f(c)·g(w) ± f'(c)·h(w), for the pairs the addition formulas
    // pair up.
    const pair = (
      first: string,
      second: string,
      a: T,
      b: T,
      sign: 1 | -1
    ): Series<T> =>
      this.add(
        this.scale(composed(first), a),
        this.scale(composed(second), b),
        cap,
        sign
      );
    switch (name) {
      case "exp":
        return shifted
          ? this.normalise(this.scale(composed("exp"), at("exp")), cap)
          : this.compose(MACLAURIN.exp, inner, cap);
      case "sin":
        return shifted
          ? pair("cos", "sin", at("sin"), at("cos"), 1)
          : this.compose(MACLAURIN.sin, inner, cap);
      case "cos":
        return shifted
          ? pair("cos", "sin", at("cos"), at("sin"), -1)
          : this.compose(MACLAURIN.cos, inner, cap);
      case "sinh":
        return shifted
          ? pair("cosh", "sinh", at("sinh"), at("cosh"), 1)
          : this.compose(MACLAURIN.sinh, inner, cap);
      case "cosh":
        return shifted
          ? pair("cosh", "sinh", at("cosh"), at("sinh"), 1)
          : this.compose(MACLAURIN.cosh, inner, cap);
      case "ln": {
        // ln(c + w) = ln c + ln(1 + w/c).
        if (!shifted)
          throw new PowerSeriesError(
            "ln of something that vanishes at the point has no power series; ln x itself has none about zero."
          );
        const reciprocal = this.F.inverse(c);
        if (reciprocal === undefined)
          throw new PowerSeriesError(
            "The logarithm's argument has no exact reciprocal here."
          );
        return this.add(
          this.constant(at("ln"), cap),
          this.compose(MACLAURIN.ln1p, this.scale(w, reciprocal), wide),
          cap
        );
      }
      case "tan":
        return this.multiply(
          this.function("sin", args, wide),
          this.inverse(this.function("cos", args, wide), wide),
          cap
        );
      case "log": {
        // log u = ln u / ln 10.
        // As the constant 1/ln 10 itself: ln 10 is ln 2 + ln 5, and a sum
        // has no reciprocal in the exact representation.
        const reciprocal = this.F.constant(
          divide(number(1), call("ln", number(10)))
        );
        if (reciprocal === undefined)
          throw new PowerSeriesError("ln 10 has no exact form here.");
        return this.normalise(
          this.scale(this.function("ln", args, cap), reciprocal),
          cap
        );
      }
      case "sec":
        return this.inverse(this.function("cos", args, wide), cap);
      case "csc":
        return this.inverse(this.function("sin", args, wide), cap);
      case "cot":
        return this.multiply(
          this.function("cos", args, wide),
          this.inverse(this.function("sin", args, wide), wide),
          cap
        );
      case "tanh":
        return this.multiply(
          this.function("sinh", args, wide),
          this.inverse(this.function("cosh", args, wide), wide),
          cap
        );
      case "sech":
        return this.inverse(this.function("cosh", args, wide), cap);
      default: {
        const f = MACLAURIN[name];
        if (f === undefined)
          throw new PowerSeriesError(`There is no series here for ${name}.`);
        if (shifted)
          throw new PowerSeriesError(
            `${name} is only expanded where its argument is zero.`
          );
        return this.compose(f, inner, cap);
      }
    }
  }
}

const factorialCache: bigint[] = [1n];
function factorial(k: number): bigint {
  for (let i = factorialCache.length; i <= k; i += 1)
    factorialCache.push(factorialCache[i - 1] * BigInt(i));
  return factorialCache[k];
}

const alternate = (m: number) => (m % 2 === 0 ? 1n : -1n);

/** `(r choose k)` for a rational `r`. */
function binomial(r: Q.Rational, k: number): Q.Rational {
  let total = Q.ONE;
  for (let i = 0; i < k; i += 1)
    total = Q.multiply(total, Q.subtract(r, Q.rational(BigInt(i))));
  return Q.divide(total, Q.rational(factorial(k)));
}

/** Maclaurin coefficients of the functions this knows. */
const MACLAURIN: Record<string, (k: number) => Q.Rational> = {
  exp: (k) => Q.rational(1n, factorial(k)),
  sin: (k) =>
    k % 2 === 1 ? Q.rational(alternate((k - 1) / 2), factorial(k)) : Q.ZERO,
  cos: (k) =>
    k % 2 === 0 ? Q.rational(alternate(k / 2), factorial(k)) : Q.ZERO,
  sinh: (k) => (k % 2 === 1 ? Q.rational(1n, factorial(k)) : Q.ZERO),
  cosh: (k) => (k % 2 === 0 ? Q.rational(1n, factorial(k)) : Q.ZERO),
  arctan: (k) =>
    k % 2 === 1 ? Q.rational(alternate((k - 1) / 2), BigInt(k)) : Q.ZERO,
  arctanh: (k) => (k % 2 === 1 ? Q.rational(1n, BigInt(k)) : Q.ZERO),
  arcsin: (k) => {
    if (k % 2 === 0) return Q.ZERO;
    const m = (k - 1) / 2;
    return Q.rational(
      factorial(2 * m),
      4n ** BigInt(m) * factorial(m) * factorial(m) * BigInt(2 * m + 1)
    );
  },
  arcsinh: (k) => {
    if (k % 2 === 0) return Q.ZERO;
    const m = (k - 1) / 2;
    return Q.rational(
      alternate(m) * factorial(2 * m),
      4n ** BigInt(m) * factorial(m) * factorial(m) * BigInt(2 * m + 1)
    );
  },
  /** ln(1 + u). */
  ln1p: (k) => (k === 0 ? Q.ZERO : Q.rational(alternate(k + 1), BigInt(k))),
};

/** The exact rational `q`-th root of a rational, where there is one. */
function rationalRoot(value: Q.Rational, q: number): Q.Rational | undefined {
  if (q === 1) return value;
  const negative = Q.isNegative(value);
  if (negative && q % 2 === 0) return undefined;
  const root = (n: bigint) => {
    const guess = BigInt(Math.round(Math.pow(Number(n), 1 / q)));
    for (const candidate of [guess - 1n, guess, guess + 1n])
      if (candidate >= 0n && candidate ** BigInt(q) === n) return candidate;
    return undefined;
  };
  const magnitude = negative ? Q.negate(value) : value;
  const n = root(magnitude.n);
  const d = root(magnitude.d);
  if (n === undefined || d === undefined) return undefined;
  return Q.rational(negative ? -n : n, d);
}

/** `p/q` written as a quotient of integers, read exactly. */
function rationalOfNode(node: Node): Q.Rational | undefined {
  const folded = fold(node);
  if (folded.type === "Constant") return Q.fromNumber(folded.value);
  if (folded.type === "Negative") {
    const inner = rationalOfNode(folded.arg);
    return inner === undefined ? undefined : Q.negate(inner);
  }
  if (folded.type === "BinaryOperator" && folded.name === "Divide") {
    const top = rationalOfNode(folded.left);
    const bottom = rationalOfNode(folded.right);
    if (top === undefined || bottom === undefined || Q.isZero(bottom))
      return undefined;
    return Q.divide(top, bottom);
  }
  return undefined;
}

export interface TruncatedAntiderivative {
  /** The logarithm a `1/x` term integrates to, if there is one. */
  logarithm?: Node;
  /** Every computed term of the antiderivative, as one expression. */
  polynomial: Node;
  /** The first few non-zero terms, for reading. */
  partial: Node;
  /** The antiderivative is exact below `x^order`. */
  order: number;
}

/** How many non-zero terms the written-out form shows. */
const PARTIAL_TERMS = 4;

/**
 * The antiderivative of `node` as a truncated series about zero, exact below
 * `x^{order}`, with `order` at least `terms`. Rational coefficients only: an
 * antiderivative is written into the graph, and its coefficients have to be
 * numbers a reader can check.
 */
export function truncatedAntiderivative(
  node: Node,
  variable: string,
  terms: number
): TruncatedAntiderivative {
  const cap = Math.max(4, terms);
  const series = new Expander(RATIONALS, variable).series(fold(node), cap);
  if (orderOf(series) < Math.min(cap, 2)) {
    throw new PowerSeriesError(
      "Too few terms of this series could be computed."
    );
  }
  const x = id(variable);
  let logarithm: Node | undefined;
  const pieces: Node[] = [];
  for (let e = series.v; e < orderOf(series); e += 1) {
    const c = series.c[e - series.v] ?? Q.ZERO;
    if (Q.isZero(c)) continue;
    if (e === -1) {
      logarithm = fold(multiply(rationalNode(c), call("ln", call("abs", x))));
      continue;
    }
    const raised = Q.divide(c, Q.rational(BigInt(e + 1)));
    pieces.push(fold(multiply(rationalNode(raised), power(x, number(e + 1)))));
  }
  if (pieces.length === 0 && logarithm === undefined) {
    throw new PowerSeriesError("Every computed term of this series is zero.");
  }
  const sum = (list: Node[]) =>
    list.reduce<Node | undefined>(
      (total, piece) => (total === undefined ? piece : add(total, piece)),
      undefined
    ) ?? number(0);
  const withLog = (list: Node[]) =>
    logarithm === undefined ? list : [logarithm, ...list];
  return {
    logarithm,
    polynomial: fold(sum(withLog(pieces))),
    partial: fold(sum(withLog(pieces).slice(0, PARTIAL_TERMS))),
    order: orderOf(series) + 1,
  };
}

/**
 * The first non-zero term of `node`'s series about zero: `c · x^valuation`,
 * over the rationals.
 *
 * Undefined when every coefficient computed is zero. That is **not** a claim
 * that the expression is zero — only that nothing was found below `x^cap` —
 * and a limit read off it would be a guess.
 */
export function leadingTerm(
  node: Node,
  variable: string,
  cap = 16
): { valuation: number; coefficient: Q.Rational } | undefined {
  return leadingTermOver(RATIONALS, node, variable, cap);
}

/** {@link leadingTerm} over any field: the exact constants, in practice. */
export function leadingTermOver<T>(
  field: CoefficientField<T>,
  node: Node,
  variable: string,
  cap = 16
): { valuation: number; coefficient: T } | undefined {
  const series = new Expander(field, variable).series(fold(node), cap);
  if (series.c.length === 0) return undefined;
  return { valuation: series.v, coefficient: series.c[0] };
}

/** Kept for the tests. */
export const forTesting = {
  toSeries: (node: Node, variable: string, cap: number) =>
    new Expander(RATIONALS, variable).series(node, cap),
  divide,
};
