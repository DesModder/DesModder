/**
 * Exact arithmetic in the two number systems partial fractions needs: the
 * rationals, and the rationals with one square root adjoined.
 *
 * The second exists for one reason. `x⁴ + 1` has no rational root and no
 * rational quadratic factor, and it still factors over the reals, exactly:
 *
 *     x⁴ + 1 = (x² + √2·x + 1)(x² - √2·x + 1)
 *
 * Every coefficient there is `a + b√2` for rationals `a` and `b`, and numbers of
 * that shape are closed under all four operations — dividing by `a + b√2` is
 * multiplying by `(a - b√2)/(a² - 2b²)`. So Gaussian elimination, polynomial
 * division and the rest of the decomposition work over them unchanged, provided
 * they are written against an interface rather than against `Rational`. That
 * interface is {@link Field}, and the decomposition in `partialFractions.ts`
 * never learns which of the two it was given.
 *
 * The alternative was to carry the coefficients as trees and let the fold
 * simplify them. That fails in the way that matters: a tree cannot be asked
 * whether it is zero, and the elimination has to choose a pivot that is not.
 * `√2·√2 - 2` is zero, and nothing structural says so.
 *
 * ## Signs, exactly
 *
 * A discriminant's sign decides between an arctangent and a logarithm, so it has
 * to be decided without a float. `a + b√d` with `a` and `b` of opposite signs
 * has the sign of whichever of `a²` and `d·b²` is larger, and those are
 * rationals.
 */
import * as Q from "./rational";
import {
  add,
  call,
  divide,
  multiply,
  negative,
  number,
  subtract,
  type Node,
} from "../../../symbolic";

export interface Field<T> {
  /** Which field this is, so values from two factorings can be told apart. */
  readonly key: string;
  readonly zero: T;
  readonly one: T;
  of: (value: Q.Rational) => T;
  add: (a: T, b: T) => T;
  subtract: (a: T, b: T) => T;
  multiply: (a: T, b: T) => T;
  /** `b` must not be zero. */
  divide: (a: T, b: T) => T;
  negate: (a: T) => T;
  isZero: (a: T) => boolean;
  equals: (a: T, b: T) => boolean;
  sign: (a: T) => -1 | 0 | 1;
  /** The positive square root *inside this field*, where there is one. */
  sqrt: (a: T) => T | undefined;
  /** The value as a plain rational, when it is one. */
  asRational: (a: T) => Q.Rational | undefined;
  toNode: (a: T) => Node;
  toNumber: (a: T) => number;
}

// ---- the rationals ---------------------------------------------------------

export const RATIONALS: Field<Q.Rational> = {
  key: "Q",
  zero: Q.ZERO,
  one: Q.ONE,
  of: (value) => value,
  add: Q.add,
  subtract: Q.subtract,
  multiply: Q.multiply,
  divide: Q.divide,
  negate: Q.negate,
  isZero: Q.isZero,
  equals: Q.equals,
  sign: (a) => (a.n < 0n ? -1 : a.n > 0n ? 1 : 0),
  sqrt: exactSquareRoot,
  asRational: (a) => a,
  toNode: rationalNode,
  toNumber: Q.toNumber,
};

/** A rational as a node, exactly. */
export function rationalNode(value: Q.Rational): Node {
  const magnitude = value.n < 0n ? -value.n : value.n;
  const body =
    value.d === 1n
      ? number(Number(magnitude))
      : divide(number(Number(magnitude)), number(Number(value.d)));
  return value.n < 0n ? negative(body) : body;
}

/** The exact square root of a rational, where there is one. */
export function exactSquareRoot(value: Q.Rational): Q.Rational | undefined {
  if (Q.isNegative(value)) return undefined;
  const n = integerSquareRoot(value.n);
  const d = integerSquareRoot(value.d);
  if (n === undefined || d === undefined) return undefined;
  return Q.rational(n, d);
}

export function integerSquareRoot(value: bigint): bigint | undefined {
  if (value < 0n) return undefined;
  if (value < 2n) return value;
  let low = 1n;
  let high = value;
  while (low <= high) {
    const middle = (low + high) / 2n;
    const square = middle * middle;
    if (square === value) return middle;
    if (square < value) low = middle + 1n;
    else high = middle - 1n;
  }
  return undefined;
}

// ---- square roots of rationals, written the way a person writes them -------

/** Beyond this the squarefree part is not worth finding by trial division. */
const SQUAREFREE_LIMIT = 10n ** 12n;

/**
 * `√q` for a positive rational, as `(m/k)·√s` with `s` squarefree.
 *
 * `√(3/4)` is `√3/2` and `√(1/2)` is `√2/2`, and those are the forms anybody
 * writes; the radical of a fraction is correct and is not an answer. Undefined
 * when the numbers are too large to factor, which the caller treats as a reason
 * to leave the radical as it is rather than to approximate it.
 */
export function surd(
  value: Q.Rational
): { outside: Q.Rational; inside: bigint } | undefined {
  if (!(value.n > 0n)) return undefined;
  // √(n/d) = √(n·d)/d, which puts everything under one integer radical.
  const radicand = value.n * value.d;
  if (radicand > SQUAREFREE_LIMIT) return undefined;
  let inside = radicand;
  let outside = 1n;
  for (let p = 2n; p * p <= inside; p += 1n) {
    while (inside % (p * p) === 0n) {
      inside /= p * p;
      outside *= p;
    }
  }
  return { outside: Q.rational(outside, value.d), inside };
}

/** `√q` as a node: `√3/2` for three quarters, `2` for four. */
export function surdNode(value: Q.Rational): Node {
  const found = surd(value);
  if (found === undefined) return call("sqrt", rationalNode(value));
  return scaledRoot(found.outside, found.inside);
}

/** `c·√s` as a node, with the coefficient's denominator under the bar. */
export function scaledRoot(coefficient: Q.Rational, inside: bigint): Node {
  if (inside === 1n) return rationalNode(coefficient);
  const root = call("sqrt", number(Number(inside)));
  const magnitude = coefficient.n < 0n ? -coefficient.n : coefficient.n;
  const top =
    magnitude === 1n ? root : multiply(number(Number(magnitude)), root);
  const body =
    coefficient.d === 1n ? top : divide(top, number(Number(coefficient.d)));
  return coefficient.n < 0n ? negative(body) : body;
}

// ---- one square root adjoined ----------------------------------------------

/** `a + b√d`, with `d` fixed by the field it belongs to. */
export interface Surd {
  readonly a: Q.Rational;
  readonly b: Q.Rational;
}

/**
 * The field of `a + b√d` for a squarefree integer `d > 1`.
 *
 * Squarefree is not a nicety. With `d = 8` the element `√8` would be `0 + 1√8`
 * and `2√2` would not be expressible at all, and two spellings of one number is
 * exactly what an exact equality test cannot survive.
 */
export function quadraticField(d: bigint): Field<Surd> {
  if (d < 2n) throw new Error("A quadratic field needs a squarefree d > 1.");
  const D = Q.rational(d);
  const make = (a: Q.Rational, b: Q.Rational): Surd => ({ a, b });
  const zero = make(Q.ZERO, Q.ZERO);
  const one = make(Q.ONE, Q.ZERO);
  const isZero = (x: Surd) => Q.isZero(x.a) && Q.isZero(x.b);
  const qSign = (q: Q.Rational) => (q.n < 0n ? -1 : q.n > 0n ? 1 : 0);

  const sign = (x: Surd): -1 | 0 | 1 => {
    const sa = qSign(x.a);
    const sb = qSign(x.b);
    if (sb === 0) return sa;
    if (sa === 0 || sa === sb) return sb;
    // Opposite signs: whichever of a² and d·b² is larger wins.
    const compare = Q.compare(
      Q.multiply(x.a, x.a),
      Q.multiply(D, Q.multiply(x.b, x.b))
    );
    return compare > 0 ? sa : sb;
  };

  const field: Field<Surd> = {
    key: `Q(sqrt ${d})`,
    zero,
    one,
    of: (value) => make(value, Q.ZERO),
    add: (x, y) => make(Q.add(x.a, y.a), Q.add(x.b, y.b)),
    subtract: (x, y) => make(Q.subtract(x.a, y.a), Q.subtract(x.b, y.b)),
    multiply: (x, y) =>
      make(
        Q.add(Q.multiply(x.a, y.a), Q.multiply(D, Q.multiply(x.b, y.b))),
        Q.add(Q.multiply(x.a, y.b), Q.multiply(x.b, y.a))
      ),
    divide: (x, y) => {
      // Multiplied through by the conjugate, whose product with y is rational
      // and is zero only when y is, because d is not a square.
      const norm = Q.subtract(
        Q.multiply(y.a, y.a),
        Q.multiply(D, Q.multiply(y.b, y.b))
      );
      const top = field.multiply(x, make(y.a, Q.negate(y.b)));
      return make(Q.divide(top.a, norm), Q.divide(top.b, norm));
    },
    negate: (x) => make(Q.negate(x.a), Q.negate(x.b)),
    isZero,
    equals: (x, y) => Q.equals(x.a, y.a) && Q.equals(x.b, y.b),
    sign,
    sqrt: (x) => {
      if (isZero(x)) return zero;
      if (sign(x) < 0) return undefined;
      if (Q.isZero(x.b)) {
        // A rational: either its root is rational, or it is a rational
        // multiple of √d, or it is not in this field at all.
        const plain = exactSquareRoot(x.a);
        if (plain !== undefined) return make(plain, Q.ZERO);
        const over = exactSquareRoot(Q.divide(x.a, D));
        return over === undefined ? undefined : make(Q.ZERO, over);
      }
      // (p + q√d)² = p² + d q² + 2pq√d, so p² is a root of
      // P² - aP + d b²/4 = 0, and both of those have to come out rational.
      const disc = exactSquareRoot(
        Q.subtract(Q.multiply(x.a, x.a), Q.multiply(D, Q.multiply(x.b, x.b)))
      );
      if (disc === undefined) return undefined;
      const half = Q.rational(1n, 2n);
      for (const P of [
        Q.multiply(half, Q.add(x.a, disc)),
        Q.multiply(half, Q.subtract(x.a, disc)),
      ]) {
        const p = exactSquareRoot(P);
        if (p === undefined || Q.isZero(p)) continue;
        const root = make(p, Q.divide(x.b, Q.multiply(Q.rational(2n), p)));
        if (!field.equals(field.multiply(root, root), x)) continue;
        return sign(root) < 0 ? field.negate(root) : root;
      }
      return undefined;
    },
    asRational: (x) => (Q.isZero(x.b) ? x.a : undefined),
    toNode: (x) => {
      if (Q.isZero(x.b)) return rationalNode(x.a);
      const irrational = scaledRoot(x.b, d);
      if (Q.isZero(x.a)) return irrational;
      // Written `a - |b|√d` rather than `a + -|b|√d`.
      return Q.isNegative(x.b)
        ? subtract(rationalNode(x.a), scaledRoot(Q.negate(x.b), d))
        : add(rationalNode(x.a), irrational);
    },
    toNumber: (x) => Q.toNumber(x.a) + Q.toNumber(x.b) * Math.sqrt(Number(d)),
  };
  return field;
}
