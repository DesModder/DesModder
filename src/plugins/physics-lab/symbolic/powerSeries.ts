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
 * - a known function of an argument that vanishes at zero by composing its own
 *   Maclaurin series with the argument's;
 * - a rational power of something whose leading coefficient has an exact root.
 *
 * ## What it is, and what it is not
 *
 * Every coefficient is exact — `1/24`, never `0.041666` — and the truncation is
 * stated: the answer is the first terms of the series *and* the order they are
 * good to, `+ O(x^N)`. That is a different kind of answer from a closed form
 * and from a general term, and the panel says which one it is showing. What
 * this never does is decide that a pattern in the first few coefficients is
 * the general term; that would be guessing.
 *
 * It expands about zero only, with rational coefficients only. A symbolic
 * constant, `ln x`, `√x`, or `e^{1+x}` (whose coefficients carry `e`) is
 * refused rather than half-handled. A finite number of negative powers is
 * allowed — `e^x/x` starts at `1/x` — and integrates to a logarithm.
 */
import {
  add,
  call,
  constantValue,
  divide,
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
 * `Σ c[i] x^{v+i}`, known for every exponent below `v + c.length`.
 *
 * Carrying the order with the coefficients is the point: a quotient by a
 * series that starts at `x²` loses two orders, and an answer that claimed the
 * lost terms would be claiming coefficients nobody computed.
 */
interface Series {
  v: number;
  c: Q.Rational[];
}

const orderOf = (s: Series) => s.v + s.c.length;

function coefficient(s: Series, exponent: number): Q.Rational {
  return exponent < s.v ? Q.ZERO : (s.c[exponent - s.v] ?? Q.ZERO);
}

/** Leading zeros moved into the valuation, and nothing past `cap` kept. */
function normalise(s: Series, cap: number): Series {
  let { v } = s;
  let c = s.c.slice(0, Math.max(0, cap - v));
  while (c.length > 0 && Q.isZero(c[0])) {
    c = c.slice(1);
    v += 1;
  }
  return { v, c };
}

function constant(value: Q.Rational, cap: number): Series {
  return normalise(
    {
      v: 0,
      c: [value, ...new Array<Q.Rational>(Math.max(0, cap - 1)).fill(Q.ZERO)],
    },
    cap
  );
}

function addSeries(a: Series, b: Series, cap: number, sign = 1): Series {
  const order = Math.min(orderOf(a), orderOf(b), cap);
  const v = Math.min(a.v, b.v);
  const c: Q.Rational[] = [];
  for (let e = v; e < order; e += 1) {
    const right = coefficient(b, e);
    c.push(Q.add(coefficient(a, e), sign < 0 ? Q.negate(right) : right));
  }
  return normalise({ v, c }, cap);
}

function multiplySeries(a: Series, b: Series, cap: number): Series {
  const v = a.v + b.v;
  const order = Math.min(a.v + orderOf(b), b.v + orderOf(a), cap);
  const c: Q.Rational[] = [];
  for (let e = v; e < order; e += 1) {
    let total = Q.ZERO;
    for (let i = 0; i <= e - v; i += 1)
      total = Q.add(
        total,
        Q.multiply(coefficient(a, a.v + i), coefficient(b, b.v + e - v - i))
      );
    c.push(total);
  }
  return normalise({ v, c }, cap);
}

function inverseSeries(a: Series, cap: number): Series {
  if (a.c.length === 0 || Q.isZero(a.c[0])) {
    throw new PowerSeriesError(
      "A quotient by something that vanishes to every order computed has no series here."
    );
  }
  const n = Math.min(a.c.length, cap + a.v);
  const b: Q.Rational[] = [Q.divide(Q.ONE, a.c[0])];
  for (let k = 1; k < n; k += 1) {
    let total = Q.ZERO;
    for (let j = 1; j <= k; j += 1)
      total = Q.add(total, Q.multiply(a.c[j] ?? Q.ZERO, b[k - j]));
    b.push(Q.negate(Q.divide(total, a.c[0])));
  }
  return normalise({ v: -a.v, c: b }, cap);
}

/** `Σ f[k] u^k` for a series `u` that vanishes at zero. */
function compose(f: (k: number) => Q.Rational, u: Series, cap: number): Series {
  if (u.c.length > 0 && u.v < 1) {
    throw new PowerSeriesError(
      "Only a function of something that is zero at x = 0 is expanded here; anything else would put irrational constants like e or ln 2 into every coefficient."
    );
  }
  // u^k starts at x^{k v}, so terms beyond the cap cannot contribute.
  const valuation = u.c.length === 0 ? cap : u.v;
  const maxK = Math.floor(cap / Math.max(1, valuation)) + 1;
  let total = constant(f(0), cap);
  let raised = constant(Q.ONE, cap);
  for (let k = 1; k <= maxK; k += 1) {
    raised = multiplySeries(raised, u, cap);
    const fk = f(k);
    if (Q.isZero(fk)) continue;
    total = addSeries(
      total,
      { v: raised.v, c: raised.c.map((value) => Q.multiply(value, fk)) },
      cap
    );
  }
  // What composing cannot know: the order of u bounds the order of f(u).
  const order = Math.min(
    orderOf(total),
    u.c.length === 0 ? cap : orderOf(u) + 0
  );
  return normalise(
    { v: total.v, c: total.c.slice(0, Math.max(0, order - total.v)) },
    cap
  );
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

/** `s^r` for a rational `r`. */
function powerSeries(s: Series, r: Q.Rational, cap: number): Series {
  if (Q.isInteger(r)) {
    let exponent = Number(r.n);
    let base = s;
    if (exponent < 0) {
      base = inverseSeries(s, cap);
      exponent = -exponent;
    }
    let total = constant(Q.ONE, cap);
    for (let i = 0; i < exponent; i += 1)
      total = multiplySeries(total, base, cap);
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
  const raised = rationalRoot(Q.pow(lead, r.n), Number(r.d));
  if (raised === undefined) {
    throw new PowerSeriesError(
      "The leading coefficient has no exact root, so the series would not have rational coefficients."
    );
  }
  const w: Series = normalise(
    {
      v: 0,
      c: [Q.ZERO, ...s.c.slice(1).map((value) => Q.divide(value, lead))],
    },
    cap - s.v
  );
  const body = compose((k) => binomial(r, k), w, cap);
  return normalise(
    {
      v: body.v + Number(shifted.n),
      c: body.c.map((value) => Q.multiply(value, raised)),
    },
    cap
  );
}

function toSeries(node: Node, variable: string, cap: number): Series {
  switch (node.type) {
    case "Constant": {
      const value = Q.fromNumber(node.value);
      if (value === undefined)
        throw new PowerSeriesError("That number has no exact value.");
      return constant(value, cap);
    }
    case "Identifier":
      if (node.symbol === variable)
        return normalise(
          {
            v: 1,
            c: new Array<Q.Rational>(Math.max(0, cap - 1))
              .fill(Q.ZERO)
              .map((z, i) => (i === 0 ? Q.ONE : z)),
          },
          cap
        );
      throw new PowerSeriesError(
        `${node.symbol} has no rational value, so a series in it would not have exact coefficients.`
      );
    case "Negative": {
      const inner = toSeries(node.arg, variable, cap);
      return { v: inner.v, c: inner.c.map(Q.negate) };
    }
    case "BinaryOperator": {
      if (node.name === "Exponent")
        return exponentSeries(node.left, node.right, variable, cap);
      // A quotient's divisor can start at a negative power and a product's
      // factor at a positive one, so both sides get room to spare.
      const margin = cap + 8;
      const left = toSeries(node.left, variable, margin);
      const right = toSeries(node.right, variable, margin);
      switch (node.name) {
        case "Add":
          return addSeries(left, right, cap);
        case "Subtract":
          return addSeries(left, right, cap, -1);
        case "Multiply":
        case "CrossMultiply":
          return multiplySeries(left, right, cap);
        case "Divide":
          return multiplySeries(left, inverseSeries(right, margin), cap);
      }
      throw new PowerSeriesError("That operation has no series here.");
    }
    case "FunctionCall":
      return functionSeries(node.callee.symbol, node.args, variable, cap);
    default:
      throw new PowerSeriesError("That kind of expression has no series here.");
  }
}

function exponentSeries(
  base: Node,
  exponent: Node,
  variable: string,
  cap: number
): Series {
  if (base.type === "Identifier" && base.symbol === "e")
    return functionSeries("exp", [exponent], variable, cap);
  const value = constantValue(fold(exponent));
  const r =
    value === undefined ? undefined : (Q.fromNumber(value) ?? undefined);
  const exact = rationalOfNode(exponent) ?? r;
  if (exact === undefined) {
    throw new PowerSeriesError(
      "A power whose exponent carries the variable, other than e^{...}, has no rational series."
    );
  }
  return powerSeries(toSeries(base, variable, cap + 8), exact, cap);
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

function functionSeries(
  name: string,
  args: readonly Node[],
  variable: string,
  cap: number
): Series {
  if (args.length !== 1)
    throw new PowerSeriesError(`${name} takes more than one argument.`);
  const inner = toSeries(args[0], variable, cap + 8);
  const shiftedLog = () => {
    // ln(c + u) = ln c + ln(1 + u/c), and only c = 1 keeps ln c rational.
    const c = coefficient(inner, 0);
    if (inner.v < 0 || !Q.equals(c, Q.ONE)) {
      throw new PowerSeriesError(
        "A logarithm is only expanded about a point where its argument is 1; ln x itself has no series about zero."
      );
    }
    return compose(
      MACLAURIN.ln1p,
      addSeries(inner, constant(Q.ONE, cap + 8), cap + 8, -1),
      cap
    );
  };
  switch (name) {
    case "ln":
      return shiftedLog();
    case "sqrt":
      return powerSeries(inner, Q.rational(1n, 2n), cap);
    case "tan":
      return multiplySeries(
        compose(MACLAURIN.sin, inner, cap + 8),
        inverseSeries(compose(MACLAURIN.cos, inner, cap + 8), cap + 8),
        cap
      );
    case "sec":
      return inverseSeries(compose(MACLAURIN.cos, inner, cap + 8), cap);
    case "tanh":
      return multiplySeries(
        compose(MACLAURIN.sinh, inner, cap + 8),
        inverseSeries(compose(MACLAURIN.cosh, inner, cap + 8), cap + 8),
        cap
      );
    case "sech":
      return inverseSeries(compose(MACLAURIN.cosh, inner, cap + 8), cap);
    default: {
      const f = MACLAURIN[name];
      if (f === undefined)
        throw new PowerSeriesError(`There is no series here for ${name}.`);
      return compose(f, inner, cap);
    }
  }
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
 * `x^{order}`, with `order` at least `terms`.
 */
export function truncatedAntiderivative(
  node: Node,
  variable: string,
  terms: number
): TruncatedAntiderivative {
  const cap = Math.max(4, terms);
  const series = toSeries(fold(node), variable, cap);
  if (orderOf(series) < Math.min(cap, 2)) {
    throw new PowerSeriesError(
      "Too few terms of this series could be computed."
    );
  }
  const x = id(variable);
  let logarithm: Node | undefined;
  const pieces: Node[] = [];
  for (let e = series.v; e < orderOf(series); e += 1) {
    const c = coefficient(series, e);
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
 * The first non-zero term of `node`'s series about zero: `c · x^valuation`.
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
  const series = toSeries(fold(node), variable, cap);
  if (series.c.length === 0) return undefined;
  return { valuation: series.v, coefficient: series.c[0] };
}

/** Kept for the tests. */
export const forTesting = { toSeries, divide };
