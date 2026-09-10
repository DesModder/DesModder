/**
 * Exact rational arithmetic over `bigint`.
 *
 * This exists because the thing it supports — exact constants — is worthless
 * the moment it is approximate. `(\sqrt2)^3` becomes `2\sqrt2` only if the
 * exponent 3/2 is carried as 3/2 and never as 1.5, and 1/3 + 1/6 is 1/2 only
 * if neither of them was ever a float. `bigint` rather than `number` because
 * the coefficient of an exact constant can grow while the constant stays
 * perfectly ordinary: taking the twelfth power of 7/5 is exact and does not
 * fit comfortably in a double.
 *
 * Invariant, held by every constructor here: the denominator is positive and
 * shares no factor with the numerator. Two rationals are therefore equal
 * exactly when their fields are equal, which is what lets the exact-constant
 * layer use them as part of a canonical key.
 */

export interface Rational {
  readonly n: bigint;
  readonly d: bigint;
}

function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) [x, y] = [y, x % y];
  return x;
}

/** A rational in lowest terms with a positive denominator. */
export function rational(n: bigint, d: bigint = 1n): Rational {
  if (d === 0n) throw new Error("A rational cannot have a zero denominator.");
  // The sign lives on the numerator alone, so -1/2 and 1/-2 are one value.
  if (d < 0n) [n, d] = [-n, -d];
  const g = gcd(n, d);
  return g === 0n ? { n: 0n, d: 1n } : { n: n / g, d: d / g };
}

export const ZERO = rational(0n);
export const ONE = rational(1n);

export const isZero = (q: Rational) => q.n === 0n;
export const isOne = (q: Rational) => q.n === 1n && q.d === 1n;
export const isInteger = (q: Rational) => q.d === 1n;
export const isNegative = (q: Rational) => q.n < 0n;

export const add = (a: Rational, b: Rational) =>
  rational(a.n * b.d + b.n * a.d, a.d * b.d);

export const subtract = (a: Rational, b: Rational) =>
  rational(a.n * b.d - b.n * a.d, a.d * b.d);

export const multiply = (a: Rational, b: Rational) =>
  rational(a.n * b.n, a.d * b.d);

export const negate = (a: Rational): Rational => ({ n: -a.n, d: a.d });

export function divide(a: Rational, b: Rational): Rational {
  if (isZero(b)) throw new Error("Division by zero.");
  return rational(a.n * b.d, a.d * b.n);
}

/**
 * The greatest integer not exceeding the value, and what is left over.
 *
 * This is the split that turns `2^{3/2}` into `2 · 2^{1/2}`, and so the reason
 * `(\sqrt2)^3` can be shown as `2\sqrt2` rather than as `2^{3/2}`. The
 * remainder is always in [0, 1), including for negative values: `2^{-1/2}`
 * splits as floor -1 and remainder 1/2, which is the rationalised `\sqrt2/2`
 * rather than a radical in a denominator.
 */
export function floorSplit(q: Rational): { whole: bigint; frac: Rational } {
  // BigInt division truncates toward zero, which is not the floor for a
  // negative value with a remainder — the case that decides whether a
  // reciprocal radical comes out rationalised.
  let whole = q.n / q.d;
  if (q.n < 0n && whole * q.d !== q.n) whole -= 1n;
  return { whole, frac: subtract(q, rational(whole)) };
}

/** Exact integer power. Negative exponents invert, as they must stay exact. */
export function pow(base: Rational, exponent: bigint): Rational {
  if (exponent < 0n) return pow(divide(ONE, base), -exponent);
  let result = ONE;
  let acc = base;
  // Exponentiation by squaring: the exponent is a bigint and a naive loop over
  // a large one would not finish.
  for (let e = exponent; e > 0n; e >>= 1n) {
    if (e & 1n) result = multiply(result, acc);
    acc = multiply(acc, acc);
  }
  return result;
}

export const equals = (a: Rational, b: Rational) => a.n === b.n && a.d === b.d;

export const compare = (a: Rational, b: Rational) => {
  const left = a.n * b.d;
  const right = b.n * a.d;
  return left < right ? -1 : left > right ? 1 : 0;
};

export const toNumber = (q: Rational) => Number(q.n) / Number(q.d);

/**
 * A rational from a decimal literal, exactly as written.
 *
 * Desmos hands us a `number` for a typed constant, so `0.1` arrives as the
 * double nearest 0.1. Reading it back through its own shortest decimal
 * representation recovers the 1/10 the user typed, where reading the double's
 * true binary value would give 3602879701896397/36028797018963968 and make
 * every later comparison useless.
 *
 * Undefined for anything with no finite decimal form — an infinity, a NaN, or
 * a value in exponent notation too extreme to expand — because a wrong exact
 * value is worse than an admitted absence of one.
 */
export function fromNumber(value: number): Rational | undefined {
  if (!Number.isFinite(value)) return undefined;
  if (Number.isInteger(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER)
    return rational(BigInt(value));
  const text = String(value);
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) return undefined;
  const [, sign, whole, decimals = ""] = match;
  const scale = 10n ** BigInt(decimals.length);
  const magnitude = BigInt(whole) * scale + BigInt(decimals || "0");
  return rational(sign === "-" ? -magnitude : magnitude, scale);
}

export function toLatex(q: Rational): string {
  if (isInteger(q)) return String(q.n);
  const sign = q.n < 0n ? "-" : "";
  const magnitude = q.n < 0n ? -q.n : q.n;
  return `${sign}\\frac{${magnitude}}{${q.d}}`;
}
