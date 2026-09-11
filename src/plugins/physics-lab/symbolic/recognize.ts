/**
 * Reading a decimal back into the constant it came from.
 *
 * Desmos answers `\pi^2` with `9.86960440109`, and that number is the only
 * thing a student ends up with — copied off the screen, written down, carried
 * to the next line. This turns it back: given those digits, it finds `\pi^2`.
 *
 * ## This one guesses, and says so
 *
 * Everything else in `symbolic/` refuses rather than approximates, because an
 * exact answer derived from an expression is a claim that can be checked.
 * This is the opposite direction and cannot be: infinitely many constants
 * agree with any finite decimal, so a match here is a *candidate*, not a
 * derivation. `9.86960440109` really is π² to every digit given, and it is also
 * 986960440109/100000000000 exactly, and nothing in the number itself says
 * which was meant.
 *
 * Two things keep that honest. The tolerance is half a unit in the last place
 * the user actually typed, so a match has to agree with every digit they have
 * rather than merely being close. And the caller is told it was a match, so the
 * panel can say "matches" instead of claiming the value *is* that constant.
 *
 * ## How it searches
 *
 * For each atom — 1, powers of π, powers of e, a square root — the value is
 * divided by the atom and what is left is fitted as a rational with a small
 * denominator, by continued fractions. A hit means the value is
 * (small rational) × (atom), which is the shape essentially every constant in a
 * course takes. The atoms are tried simplest first, so a number that is merely
 * rational is reported as a fraction rather than as some baroque multiple of π.
 */
import {
  fromRational,
  multiply,
  PI_VALUE,
  E_VALUE,
  power,
  toNumber,
  type ExactValue,
} from "./exact";
import * as Q from "./rational";

/**
 * The largest denominator a fitted rational may have.
 *
 * Large enough for the fractions a course produces — sixths, twelfths,
 * sixty-fourths — and small enough that it cannot absorb an arbitrary decimal.
 * Without a cap, continued fractions reproduce *any* input exactly and every
 * atom would "match", which would make the whole search meaningless.
 */
const MAX_DENOMINATOR = 10_000n;

/**
 * Below this many significant digits, only a plain rational is offered.
 *
 * Three digits of agreement is not evidence: `3.14` is π to the digits given
 * and is also 157/50, and at that length half the atom list would match
 * something. Requiring real precision before naming an irrational constant is
 * what stops this being a random-number generator with a radical sign.
 */
const DIGITS_FOR_IRRATIONAL = 6;

export interface Recognition {
  value: ExactValue;
  /** Significant digits the input carried, which is what was matched against. */
  digits: number;
}

/** The atoms a constant is searched for as a rational multiple of. */
function atoms(): { value: ExactValue; numeric: number }[] {
  const list: ExactValue[] = [fromRational(Q.ONE)];
  const half = Q.rational(1n, 2n);

  // Powers of pi, including reciprocals: areas and periods give pi, pi squared
  // turns up in energy and in series, and 1/pi in normalisations.
  for (const exponent of [1n, 2n, 3n, -1n, -2n]) {
    const raised = power(PI_VALUE, Q.rational(exponent));
    if (raised !== undefined) list.push(raised);
  }
  for (const exponent of [1n, 2n, -1n]) {
    const raised = power(E_VALUE, Q.rational(exponent));
    if (raised !== undefined) list.push(raised);
  }
  // Square roots of the squarefree integers. A non-squarefree one reduces to a
  // multiple of a smaller root, which the rational factor already covers.
  for (let n = 2n; n <= 50n; n++) {
    if (!isSquarefree(n)) continue;
    const root = power(fromRational(Q.rational(n)), half);
    if (root !== undefined) list.push(root);
  }
  // Pi times a small root, which is what a half-period of a pendulum looks
  // like: 2*pi*sqrt(l/g).
  for (const n of [2n, 3n, 5n, 6n, 10n]) {
    const root = power(fromRational(Q.rational(n)), half);
    if (root !== undefined) list.push(multiply(PI_VALUE, root));
  }

  return list.map((value) => ({ value, numeric: toNumber(value) }));
}

function isSquarefree(n: bigint) {
  for (let d = 2n; d * d <= n; d++) if (n % (d * d) === 0n) return false;
  return true;
}

const ATOMS = atoms();

/**
 * The number of significant digits in a decimal as written.
 *
 * Leading zeros do not count, a trailing zero after the point does — somebody
 * who wrote `2.50` is claiming three digits — and the count is what sets how
 * closely a candidate has to agree.
 */
export function significantDigits(text: string): number {
  const match = /^-?0*(\d*)(?:\.(\d*))?$/.exec(text.trim());
  if (!match) return 0;
  const [, whole, decimals = ""] = match;
  if (whole === "" || whole === "0") {
    // 0.00123 has three significant digits, not five.
    const stripped = decimals.replace(/^0+/, "");
    return stripped.length;
  }
  return whole.length + decimals.length;
}

/**
 * The best rational approximation to `value` with a bounded denominator, by
 * continued fractions.
 */
function bestRational(value: number): Q.Rational | undefined {
  if (!Number.isFinite(value)) return undefined;
  const negative = value < 0;
  let x = Math.abs(value);
  let previousNumerator = 0n;
  let numerator = 1n;
  let previousDenominator = 1n;
  let denominator = 0n;
  for (let i = 0; i < 40; i++) {
    const whole = Math.floor(x);
    if (!Number.isFinite(whole) || Math.abs(whole) > 1e15) break;
    const nextNumerator = BigInt(whole) * numerator + previousNumerator;
    const nextDenominator = BigInt(whole) * denominator + previousDenominator;
    if (nextDenominator > MAX_DENOMINATOR) break;
    [previousNumerator, numerator] = [numerator, nextNumerator];
    [previousDenominator, denominator] = [denominator, nextDenominator];
    const remainder = x - whole;
    if (remainder < 1e-15) break;
    x = 1 / remainder;
  }
  if (denominator === 0n) return undefined;
  return Q.rational(negative ? -numerator : numerator, denominator);
}

/**
 * The exact constant a decimal appears to be, or `undefined` when nothing
 * simple agrees with every digit given.
 *
 * `text` is the decimal as the user wrote it, because how many digits they
 * wrote is the whole basis of the test — the same number at four digits and at
 * twelve deserves completely different confidence.
 */
export function recognizeDecimal(text: string): Recognition | undefined {
  const digits = significantDigits(text);
  const value = Number(text);
  if (!Number.isFinite(value) || value === 0 || digits === 0) return undefined;

  // Half a unit in the last place shown: a candidate has to round to exactly
  // what the user wrote, not merely to be nearby.
  const magnitude = Math.floor(Math.log10(Math.abs(value)));
  const tolerance = 0.5 * Math.pow(10, magnitude - digits + 1);

  for (const atom of ATOMS) {
    const isPlainRational = atom.numeric === 1;
    if (!isPlainRational && digits < DIGITS_FOR_IRRATIONAL) continue;
    const ratio = bestRational(value / atom.numeric);
    if (ratio === undefined || Q.isZero(ratio)) continue;
    const candidate = multiply(fromRational(ratio), atom.value);
    if (Math.abs(toNumber(candidate) - value) <= tolerance)
      return { value: candidate, digits };
  }
  return undefined;
}
