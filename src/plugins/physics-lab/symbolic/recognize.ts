/**
 * Reading a decimal back into the constant it came from.
 *
 * Desmos answers `\pi^2` with `9.86960440109`, and that number is the only
 * thing a student ends up with — copied off the screen, written down, carried
 * to the next line. This turns it back: given those digits, it finds `\pi^2`.
 * Given more digits it finds more: `(1 + √5)/2`, `π²e/√2`, `π^{e√2}`.
 *
 * ## This one guesses, and says so
 *
 * Everything else in `symbolic/` refuses rather than approximates, because an
 * exact answer derived from an expression is a claim that can be checked.
 * This is the opposite direction and cannot be: infinitely many formulas agree
 * with any finite decimal, so a match here is a *candidate*, not a derivation.
 * The panel says "matches", never "is".
 *
 * ## What makes a match evidence
 *
 * Two tests, and a candidate must pass both.
 *
 * - **It reproduces every digit given.** The tolerance is half a unit in the
 *   last place typed, so the candidate rounds to exactly what was written.
 * - **It is much shorter than what it explains.** A formula is information
 *   too: `7π/12` costs about two digits to write down, `π^{e√2}` about four.
 *   Any string of digits can be matched by a formula as long as itself, so a
 *   match only counts when the digits it explains exceed the digits it costs
 *   by a margin. Twelve digits of `π²` explained by a one-digit formula is
 *   overwhelming; twelve digits "explained" by an eleven-digit relation is
 *   coincidence, and is refused. This is what lets the search grow without
 *   becoming a random-number generator with a radical sign.
 *
 * ## How it searches
 *
 * Four shapes, simplest first, the cheapest passing candidate winning:
 *
 * 1. **A fraction times one constant** — `7π/12`, `3√2/4`, `e²` — by
 *    continued fractions. The shape essentially every course answer takes.
 * 2. **A sum** — `(1 + √5)/2`, `1 + π²/6` — by PSLQ on the decimal beside a
 *    few constants.
 * 3. **A product of powers** — `π² e^{1/3}/√2` — by PSLQ on logarithms,
 *    where a product becomes a sum.
 * 4. **A tower** — `π^{e√2}`, `e^{π√2}`, `2^{√2}` — by taking the logarithm
 *    in a base and recognising the exponent with the shapes above.
 *
 * The later shapes need more digits, and are only tried when there are
 * enough for a match to mean something. Every constant is one Desmos can
 * write, so anything found can go straight into the graph.
 *
 * The arithmetic is at a precision set by the input — twice its digits and
 * then some — so a hundred pasted digits are all used.
 */
import {
  add,
  call,
  decimalContext,
  divide,
  evaluatePrecise,
  fold,
  id,
  multiply,
  negative,
  number,
  power,
  subtract,
  type Decimal,
  type Node,
} from "../../../symbolic";
import { evaluateExact, opaque, toNumber, type ExactValue } from "./exact";
import * as Q from "./rational";
import { rationalNode } from "./field";
import { integerRelation } from "./pslq";

/**
 * The largest denominator the fraction-times-constant shape may use.
 *
 * Large enough for the fractions a course produces, and small enough that it
 * cannot absorb an arbitrary decimal: without a cap, continued fractions
 * reproduce any input exactly.
 */
const MAX_DENOMINATOR = 10_000n;

/**
 * Below this many significant digits, only a plain rational is offered.
 * `3.14` is π to the digits given and also 157/50; three digits are not
 * evidence for the first.
 */
const DIGITS_FOR_IRRATIONAL = 6;

/**
 * How many more digits a match must explain than it costs to write. Six
 * digits spare means a random decimal would pass by chance about once in a
 * million formulas of that size — and the searches here try far fewer.
 */
const MARGIN = 6;

export interface Recognition {
  value: ExactValue;
  /**
   * The formula as found, written the way a textbook writes it. The exact
   * value above is for arithmetic and may be arranged differently.
   */
  node: Node;
  /** Significant digits the input carried, which is what was matched against. */
  digits: number;
  /** How many digits the match explains beyond what the formula costs. */
  spare: number;
}

/** A formula that might be the decimal, and what it costs to write down. */
interface Candidate {
  node: Node;
  cost: number;
}

const log10 = (n: bigint | number) => Math.log10(Math.abs(Number(n)) + 1);

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
 * The exact constant a decimal appears to be, or `undefined` when nothing
 * short enough agrees with every digit given.
 *
 * `text` is the decimal as the user wrote it, because how many digits they
 * wrote is the whole basis of the test — the same number at four digits and at
 * forty deserves completely different confidence.
 */
export function recognizeDecimal(text: string): Recognition | undefined {
  const trimmed = text.trim();
  if (!/^-?\d*\.?\d+$/.test(trimmed) && !/^-?\d+\.$/.test(trimmed))
    return undefined;
  const digits = significantDigits(trimmed);
  if (digits === 0) return undefined;
  const precision = Math.max(60, 2 * digits + 30);
  const D = decimalContext(precision);
  const value = new D(trimmed);
  if (!value.isFinite() || value.isZero()) return undefined;

  // Half a unit in the last place shown: a candidate has to round to exactly
  // what the user wrote, not merely be nearby.
  const tolerance = new D(10).pow(value.e - digits + 1).times(0.5);
  const found = identify(value, tolerance, digits, precision, true);
  if (found === undefined) return undefined;
  const node = fold(found.node);
  const exact =
    evaluateExact(node) ??
    opaque(node, evaluatePrecise(node, {}, precision).toNumber());
  return {
    value: exact,
    node: found.node,
    digits,
    spare: Math.max(0, Math.floor(digits - found.cost)),
  };
}

/**
 * The cheapest candidate for `value` that matches within `tolerance` and,
 * past the plain shapes, is short enough for `digits` of evidence.
 */
function identify(
  value: Decimal,
  tolerance: Decimal,
  digits: number,
  precision: number,
  towers: boolean
): Candidate | undefined {
  const sign = value.isNegative() ? -1 : 1;
  const size = value.abs();
  const matches = (candidate: Candidate) => {
    const got = evaluatePrecise(candidate.node, {}, precision);
    return got.isFinite() && got.minus(size).abs().lte(tolerance);
  };
  const found: Candidate[] = [];

  for (const candidate of multiples(size, digits, precision))
    if (matches(candidate)) found.push(candidate);

  const earned = (candidate: Candidate) =>
    candidate.cost <= digits - MARGIN && matches(candidate);
  if (digits >= 12)
    for (const candidate of sums(size, digits, precision))
      if (earned(candidate)) found.push(candidate);
  if (digits >= 15) {
    const product = products(size, digits, precision);
    if (product !== undefined && earned(product)) found.push(product);
  }
  if (towers && digits >= 12 && found.length === 0)
    for (const candidate of towersOf(size, tolerance, precision))
      if (earned(candidate)) found.push(candidate);

  if (found.length === 0) return undefined;
  const best = found.reduce((a, b) => (b.cost < a.cost ? b : a));
  return sign < 0 ? { ...best, node: negative(best.node) } : best;
}

// ---- 1. a fraction times one constant --------------------------------------

/** The constants the first shape multiplies, simplest first, with their cost. */
function atoms(): { node: Node; cost: number }[] {
  const pi = id("pi");
  const e = id("e");
  const list: { node: Node; cost: number }[] = [{ node: number(1), cost: 0 }];
  // Powers of pi, including reciprocals: areas and periods give pi, pi squared
  // turns up in energy and in series, and 1/pi in normalisations.
  list.push({ node: pi, cost: 1 });
  for (const k of [2, 3]) list.push({ node: power(pi, number(k)), cost: 1.5 });
  for (const k of [1, 2])
    list.push({
      node: divide(number(1), k === 1 ? pi : power(pi, number(k))),
      cost: 1.5,
    });
  list.push({ node: e, cost: 1 });
  list.push({ node: power(e, number(2)), cost: 1.5 });
  list.push({ node: divide(number(1), e), cost: 1.5 });
  // Square roots of the squarefree integers. A non-squarefree one reduces to a
  // multiple of a smaller root, which the rational factor already covers.
  for (let n = 2; n <= 50; n++)
    if (isSquarefree(n))
      list.push({ node: call("sqrt", number(n)), cost: 1 + log10(n) / 2 });
  // Pi times a small root, which is what a pendulum's period looks like.
  for (const n of [2, 3, 5, 6, 10])
    list.push({ node: multiply(pi, call("sqrt", number(n))), cost: 2 });
  return list;
}

function isSquarefree(n: number) {
  for (let d = 2; d * d <= n; d++) if (n % (d * d) === 0) return false;
  return true;
}

const ATOMS = atoms();

function* multiples(
  size: Decimal,
  digits: number,
  precision: number
): Generator<Candidate> {
  for (const atom of ATOMS) {
    const plain = atom.cost === 0;
    if (!plain && digits < DIGITS_FOR_IRRATIONAL) continue;
    const base = valueOf(atom.node, precision);
    const ratio = bestRational(size.div(base), digits);
    if (ratio === undefined || Q.isZero(ratio)) continue;
    // Written the way the fraction reads: π²/6 and 3π/4, not (1/6)π².
    const top =
      ratio.n === 1n ? atom.node : multiply(number(Number(ratio.n)), atom.node);
    const scaled = plain
      ? rationalNode(ratio)
      : ratio.d === 1n
        ? top
        : divide(top, number(Number(ratio.d)));
    yield { node: scaled, cost: log10(ratio.n) + log10(ratio.d) + atom.cost };
  }
}

/**
 * The best rational approximation with a bounded denominator, by continued
 * fractions, stopping once a convergent reproduces the value to the digits
 * given.
 */
function bestRational(value: Decimal, digits: number): Q.Rational | undefined {
  if (!value.isFinite()) return undefined;
  const D = decimalContext(Math.max(60, 2 * digits + 30));
  let x = new D(value.abs());
  const enough = new D(10).pow(-digits - 2);
  let [p0, p1] = [0n, 1n];
  let [q0, q1] = [1n, 0n];
  for (let i = 0; i < 60; i++) {
    const whole = x.floor();
    if (whole.gt(1e15)) break;
    const a = BigInt(whole.toFixed(0));
    const [p, q] = [a * p1 + p0, a * q1 + q0];
    if (q > MAX_DENOMINATOR) break;
    [p0, p1] = [p1, p];
    [q0, q1] = [q1, q];
    const remainder = x.minus(whole);
    if (remainder.lt(enough)) break;
    x = new D(1).div(remainder);
  }
  if (q1 === 0n) return undefined;
  return Q.rational(value.isNegative() ? -p1 : p1, q1);
}

// ---- 2. a sum --------------------------------------------------------------

/**
 * The small bases a sum is searched over. Small on purpose: each constant
 * added to a basis costs digits of evidence, and a basis of three is enough
 * for the sums a course and most tables produce.
 */
function sumBases(digits: number): Node[][] {
  const pi = id("pi");
  const e = id("e");
  const one = number(1);
  const root = (n: number) => call("sqrt", number(n));
  const bases: Node[][] = [
    ...[2, 3, 5, 6, 7].map((n) => [one, root(n)]),
    [one, pi],
    [one, power(pi, number(2))],
    [one, e],
    [one, call("ln", number(2))],
    [one, call("ln", number(3))],
    [pi, power(pi, number(2))],
  ];
  if (digits >= 20)
    bases.push(
      [one, root(2), root(3)],
      [one, pi, power(pi, number(2))],
      [one, e, power(e, number(2))],
      [one, pi, e]
    );
  return bases;
}

function* sums(
  size: Decimal,
  digits: number,
  precision: number
): Generator<Candidate> {
  for (const basis of sumBases(digits)) {
    const values = basis.map((node) => valueOf(node, precision));
    const relation = integerRelation([size, ...values], {
      digits,
      maxCoefficient: 10 ** Math.min(6, digits - MARGIN),
    });
    if (relation === undefined || relation[0] === 0n) continue;
    const [a0, ...rest] = relation;
    const used = rest.filter((a) => a !== 0n).length;
    // One constant on its own is the first shape's job, and cheaper there.
    if (used < 2) continue;
    yield {
      node: sumNode(a0, rest, basis),
      cost: relation.reduce((total, a) => total + log10(a), 0) + used,
    };
  }
}

/**
 * `v = Σ (−aᵢ/a₀) bᵢ` written as a textbook writes it: over one common
 * denominator, `(1 + √5)/2`, unless the constant term comes out whole, when
 * it stands in front: `1 + π²/6`.
 */
function sumNode(a0: bigint, rest: readonly bigint[], basis: Node[]): Node {
  const gcd = (a: bigint, b: bigint): bigint => (b === 0n ? a : gcd(b, a % b));
  const abs = (a: bigint) => (a < 0n ? -a : a);
  let divisor = a0;
  let top = rest.map((a) => -a);
  const common = top.reduce((g, a) => gcd(g, abs(a)), abs(divisor));
  divisor /= common;
  top = top.map((a) => a / common);
  const isOne = (n: Node) => n.type === "Constant" && n.value === 1;
  // The constant term first, the way a sum is read.
  const order = basis
    .map((node, i) => ({ node, coefficient: top[i] }))
    .filter((t) => t.coefficient !== 0n)
    .sort((a, b) => Number(isOne(b.node)) - Number(isOne(a.node)));
  const termOf = (coefficient: bigint, node: Node): Node =>
    isOne(node)
      ? number(Number(abs(coefficient)))
      : abs(coefficient) === 1n
        ? node
        : multiply(number(Number(abs(coefficient))), node);
  const join = (terms: typeof order): Node | undefined =>
    terms.reduce<Node | undefined>((total, { node, coefficient }) => {
      const term = termOf(coefficient, node);
      if (total === undefined) return coefficient < 0n ? negative(term) : term;
      return coefficient < 0n ? subtract(total, term) : add(total, term);
    }, undefined);

  const constant = order.find((t) => isOne(t.node));
  if (
    divisor !== 1n &&
    constant !== undefined &&
    constant.coefficient % divisor === 0n
  ) {
    const whole = constant.coefficient / divisor;
    const others = join(order.filter((t) => t !== constant));
    const fraction =
      others === undefined
        ? number(0)
        : divide(others, number(Number(divisor)));
    return whole < 0n
      ? subtract(fraction, number(Number(-whole)))
      : add(number(Number(whole)), fraction);
  }
  const numerator = join(order) ?? number(0);
  return divisor === 1n
    ? numerator
    : divide(numerator, number(Number(divisor)));
}

// ---- 3. a product of powers ------------------------------------------------

/** The bases of the product shape, in the order a product is read. */
const PRODUCT_BASES: { node: Node; prime?: bigint }[] = [
  { node: id("pi") },
  { node: id("e") },
  { node: number(2), prime: 2n },
  { node: number(3), prime: 3n },
  { node: number(5), prime: 5n },
  { node: number(7), prime: 7n },
];

/**
 * A product of powers of π, e, 2, 3, 5 and 7, found as a sum of their
 * logarithms. `ln e = 1`, so `e` is the constant term of the relation.
 */
function products(
  size: Decimal,
  digits: number,
  precision: number
): Candidate | undefined {
  const D = decimalContext(precision);
  const logs = PRODUCT_BASES.map(({ node }) =>
    node.type === "Identifier" && node.symbol === "e"
      ? new D(1)
      : D.ln(valueOf(node, precision))
  );
  const relation = integerRelation([D.ln(size), ...logs], {
    digits: digits - 1,
    maxCoefficient: 10 ** Math.min(4, (digits - MARGIN) / 2),
  });
  if (relation === undefined || relation[0] === 0n) return undefined;
  const [a0, ...rest] = relation;
  // a0·ln v + Σ aᵢ ln bᵢ = 0, so v = Π bᵢ^(−aᵢ/a0).
  const exponents = rest.map((a) => Q.rational(-a, a0));
  const used = exponents.filter((q) => !Q.isZero(q));
  // A rational, or one constant to a whole power, is the first shape's job.
  if (used.length === 0) return undefined;
  if (used.length === 1 && Q.isInteger(used[0])) return undefined;
  return {
    node: productNode(exponents),
    cost: relation.reduce((total, a) => total + log10(a), 0) + used.length,
  };
}

/**
 * `Π bᵢ^{qᵢ}` written as a textbook writes it: whole powers of the primes
 * gathered into a fraction in front, half powers under one square root,
 * everything with a negative exponent below the line. `π² e / √2`, not
 * `e·2^{-1/2}·π²`.
 */
function productNode(exponents: readonly Q.Rational[]): Node {
  const above: Node[] = [];
  const below: Node[] = [];
  let coefficient = Q.ONE;
  let rootAbove = 1n;
  let rootBelow = 1n;
  exponents.forEach((q, i) => {
    if (Q.isZero(q)) return;
    const { node, prime } = PRODUCT_BASES[i];
    const side = Q.isNegative(q) ? below : above;
    const size = Q.isNegative(q) ? Q.negate(q) : q;
    if (prime === undefined) {
      side.push(Q.equals(size, Q.ONE) ? node : power(node, rationalNode(size)));
      return;
    }
    // p^{k + r}: p^k into the fraction, √p for r = ½, p^r otherwise.
    const whole = size.n / size.d;
    const part = Q.subtract(size, Q.rational(whole));
    const raised = Q.rational(prime ** whole);
    coefficient = Q.isNegative(q)
      ? Q.divide(coefficient, raised)
      : Q.multiply(coefficient, raised);
    if (Q.isZero(part)) return;
    if (Q.equals(part, Q.rational(1n, 2n))) {
      if (Q.isNegative(q)) rootBelow *= prime;
      else rootAbove *= prime;
      return;
    }
    side.push(power(node, rationalNode(part)));
  });
  if (coefficient.n !== 1n) above.unshift(number(Number(coefficient.n)));
  if (coefficient.d !== 1n) below.unshift(number(Number(coefficient.d)));
  if (rootAbove !== 1n) above.push(call("sqrt", number(Number(rootAbove))));
  if (rootBelow !== 1n) below.push(call("sqrt", number(Number(rootBelow))));
  const product = (list: Node[]) =>
    list.length === 0 ? number(1) : list.reduce((t, f) => multiply(t, f));
  return below.length === 0
    ? product(above)
    : divide(product(above), product(below));
}

// ---- 4. a tower --------------------------------------------------------------

/**
 * `b^y` for a few bases `b`, with the exponent `y = ln v / ln b` recognised
 * by the other shapes. `π^{e√2}` is `π` to an exponent whose logarithm is
 * `1 + ½ ln 2` — a product, once it is looked at the right way up.
 */
function* towersOf(
  size: Decimal,
  tolerance: Decimal,
  precision: number
): Generator<Candidate> {
  const D = decimalContext(precision);
  const logOfValue = D.ln(size);
  for (const base of [id("pi"), id("e"), number(2), number(3), number(10)]) {
    const logOfBase = D.ln(valueOf(base, precision));
    const exponent = logOfValue.div(logOfBase);
    if (exponent.abs().lt("1e-6")) continue;
    // What the exponent is good to: the value's relative error, carried
    // through the logarithm.
    const exponentTolerance = tolerance.div(size).div(logOfBase.abs());
    const exponentDigits = Math.floor(
      exponent.abs().div(exponentTolerance).log(10).toNumber()
    );
    if (exponentDigits < 10) continue;
    const inner = identify(
      exponent,
      exponentTolerance,
      exponentDigits,
      precision,
      false
    );
    if (inner === undefined) continue;
    // A rational exponent is a product of powers, which is cheaper there.
    if (isRational(inner.node)) continue;
    yield { node: power(base, inner.node), cost: inner.cost + 1.5 };
  }
}

/** Whether a tree is just a rational number. */
function isRational(node: Node): boolean {
  if (node.type === "Constant") return true;
  if (node.type === "Negative") return isRational(node.arg);
  return (
    node.type === "BinaryOperator" &&
    node.name === "Divide" &&
    isRational(node.left) &&
    isRational(node.right)
  );
}

const cache = new Map<string, Decimal>();

/** A constant's value at a precision, computed once. */
function valueOf(node: Node, precision: number): Decimal {
  const key = `${precision} ${JSON.stringify(node)}`;
  let value = cache.get(key);
  if (value === undefined) {
    value = evaluatePrecise(node, {}, precision);
    cache.set(key, value);
  }
  return value;
}

/** Kept for the tests: a value's double, for comparing with the input. */
export const forTesting = { toNumber };
