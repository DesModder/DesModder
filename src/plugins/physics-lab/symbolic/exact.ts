/**
 * Exact real constants, in the form a student writes them.
 *
 * Desmos evaluates. Type `\sqrt2^3` and it answers `2.82842712475`, which is
 * the right number and the wrong object: the answer to that question is
 * `2\sqrt2`, and no amount of decimal places is it. Nothing in Desmos will
 * ever show the exact form, so this is where it has to come from.
 *
 * The representation is a **sum of products**:
 *
 *     Σ  q · π^a · e^b · Π p_i^{c_i}
 *
 * where q is rational, a and b are rational, and each p_i is a prime with a
 * rational exponent. That one shape covers everything an AP course produces —
 * `\frac{\pi^2}{2}`, `2\sqrt2`, `\frac{\sqrt3}{3}`, `e^2`, `\frac{5\sqrt6}{4}`
 * — and it is closed under the operations that build them.
 *
 * Two normalisations do all the visible work:
 *
 * - **Prime exponents are folded into [0, 1).** `2^{3/2}` becomes `2 · 2^{1/2}`,
 *   which is what makes `(\sqrt2)^3` display as `2\sqrt2` rather than as a
 *   fractional power. It also rationalises denominators for free: `1/\sqrt2`
 *   is `2^{-1/2}`, which folds to `\frac{1}{2} · 2^{1/2}` — `\frac{\sqrt2}{2}`.
 * - **The coefficient is factored into primes before any root is taken**, so
 *   `\sqrt{8}` finds `2^3` and returns `2\sqrt2`, and `\sqrt{4/9}` returns
 *   `\frac{2}{3}` with no radical left at all.
 *
 * π and e are *not* folded, because there is nothing to fold them into: they
 * are irrational and independent, and `\pi^2` is already the form a person
 * writes. Holding them as opaque atoms beside the primes is what keeps
 * `\frac{\pi^2}{2}` intact instead of collapsing to 4.9348.
 *
 * Everything here refuses rather than approximates. A value this cannot
 * represent exactly comes back `undefined`, and the caller shows Desmos's
 * decimal instead. That follows `symbolic.ts`'s rule for derivatives and it
 * matters more here: an exact answer is a claim, and a claim that is nearly
 * true is worse than no claim.
 */
import { Aug, AugBuilders } from "../../../../text-mode-core";
import * as Q from "./rational";
import type { Rational } from "./rational";

const { number, binop, functionCall, id, negative } = AugBuilders;

/**
 * The transcendental atoms, keyed by the symbol Desmos's parser produces.
 * Primes are keyed by their decimal representation, which cannot collide with
 * these because a prime never starts with a letter.
 */
const PI = "pi";
const E = "e";

/** One product term: a rational coefficient times atoms raised to exponents. */
export interface ExactTerm {
  readonly coeff: Rational;
  /**
   * Atom key to exponent. Prime exponents lie strictly inside (0, 1) — the
   * whole part has been folded into `coeff` — and no exponent is ever zero.
   */
  readonly factors: ReadonlyMap<string, Rational>;
}

/**
 * A sum of terms, in canonical order, with no two terms sharing a factor map
 * and no zero coefficients. The empty array is exactly zero.
 *
 * A sum is needed because this set is closed under multiplication but not
 * under addition: `\sqrt2 + \sqrt3` is a perfectly ordinary exact constant and
 * is not a single product. Keeping it as two terms is what lets `\sqrt2` and
 * `\sqrt2` add to `2\sqrt2` while `\sqrt2` and `\sqrt3` simply stay put.
 */
export type ExactValue = readonly ExactTerm[];

export const ZERO: ExactValue = [];

// ---- construction --------------------------------------------------------

function term(coeff: Rational, factors: Map<string, Rational>): ExactTerm {
  return { coeff, factors };
}

export function fromRational(q: Rational): ExactValue {
  return Q.isZero(q) ? ZERO : [term(q, new Map())];
}

export const fromInteger = (n: bigint | number) =>
  fromRational(Q.rational(BigInt(n)));

export const PI_VALUE: ExactValue = [term(Q.ONE, new Map([[PI, Q.ONE]]))];
export const E_VALUE: ExactValue = [term(Q.ONE, new Map([[E, Q.ONE]]))];

// ---- prime factorisation -------------------------------------------------

/**
 * Trial division is enough and its limit is deliberate. Every constant an AP
 * problem produces is built from small numbers, and a coefficient large enough
 * to defeat this is a coefficient nobody wanted an exact root of. Refusing
 * costs a decimal; grinding costs the tab.
 */
const TRIAL_DIVISION_LIMIT = 1_000_000n;

/**
 * The prime factorisation of a positive integer, or `undefined` if a factor
 * resists trial division.
 */
function factorize(value: bigint): Map<string, bigint> | undefined {
  const factors = new Map<string, bigint>();
  let remaining = value;
  const bump = (p: bigint, by: bigint) =>
    factors.set(String(p), (factors.get(String(p)) ?? 0n) + by);
  for (let p = 2n; p * p <= remaining && p <= TRIAL_DIVISION_LIMIT; p++) {
    while (remaining % p === 0n) {
      bump(p, 1n);
      remaining /= p;
    }
  }
  if (remaining > 1n) {
    // What is left is prime if trial division ran to its square root; past the
    // limit it may be composite, and treating a composite as prime would give
    // a wrong root rather than none.
    if (remaining > TRIAL_DIVISION_LIMIT * TRIAL_DIVISION_LIMIT)
      return undefined;
    bump(remaining, 1n);
  }
  return factors;
}

// ---- normalisation -------------------------------------------------------

/**
 * Restores the invariants after any operation: prime exponents folded into
 * [0, 1) with the whole part moved into the coefficient, zero exponents
 * dropped, and the whole term collapsed to nothing if the coefficient is zero.
 */
function normalize(
  coeff: Rational,
  raw: Map<string, Rational>
): ExactTerm | undefined {
  if (Q.isZero(coeff)) return undefined;
  let scale = Q.ONE;
  const factors = new Map<string, Rational>();
  for (const [atom, exponent] of raw) {
    if (Q.isZero(exponent)) continue;
    if (atom === PI || atom === E) {
      factors.set(atom, exponent);
      continue;
    }
    const { whole, frac } = Q.floorSplit(exponent);
    if (whole !== 0n)
      scale = Q.multiply(scale, Q.pow(Q.rational(BigInt(atom)), whole));
    if (!Q.isZero(frac)) factors.set(atom, frac);
  }
  return term(Q.multiply(coeff, scale), factors);
}

/** A canonical string for a factor map, so like terms can be found by key. */
function factorKey(factors: ReadonlyMap<string, Rational>): string {
  return [...factors]
    .map(([atom, e]) => `${atom}^${e.n}/${e.d}`)
    .sort()
    .join(",");
}

/** Merges like terms, drops zeroes, and fixes an order so output is stable. */
function collect(terms: readonly (ExactTerm | undefined)[]): ExactValue {
  const merged = new Map<string, ExactTerm>();
  for (const t of terms) {
    if (t === undefined || Q.isZero(t.coeff)) continue;
    const key = factorKey(t.factors);
    const existing = merged.get(key);
    merged.set(
      key,
      existing === undefined
        ? t
        : term(Q.add(existing.coeff, t.coeff), new Map(t.factors))
    );
  }
  return (
    [...merged]
      .filter(([, t]) => !Q.isZero(t.coeff))
      // Plain rational terms sort last, so `x + 1` style sums read the way they
      // are written rather than leading with the constant.
      .sort(
        (a, b) =>
          (a[1].factors.size === 0 ? 1 : 0) -
            (b[1].factors.size === 0 ? 1 : 0) || a[0].localeCompare(b[0])
      )
      .map(([, t]) => t)
  );
}

// ---- arithmetic ----------------------------------------------------------

export const add = (a: ExactValue, b: ExactValue): ExactValue =>
  collect([...a, ...b]);

export const negate = (a: ExactValue): ExactValue =>
  a.map((t) => term(Q.negate(t.coeff), new Map(t.factors)));

export const subtract = (a: ExactValue, b: ExactValue) => add(a, negate(b));

function multiplyTerms(a: ExactTerm, b: ExactTerm): ExactTerm | undefined {
  const factors = new Map(a.factors);
  for (const [atom, exponent] of b.factors)
    factors.set(atom, Q.add(factors.get(atom) ?? Q.ZERO, exponent));
  return normalize(Q.multiply(a.coeff, b.coeff), factors);
}

export function multiply(a: ExactValue, b: ExactValue): ExactValue {
  const products: (ExactTerm | undefined)[] = [];
  for (const left of a)
    for (const right of b) products.push(multiplyTerms(left, right));
  return collect(products);
}

/**
 * Division, exactly, when the divisor is a single product.
 *
 * A sum in the denominator is refused rather than attempted. `1/(1+\sqrt2)` is
 * exactly `\sqrt2-1`, but reaching it means multiplying by a conjugate, and
 * conjugates only exist for the quadratic cases — the general one is a field
 * inversion this representation cannot express. Refusing is honest; a partial
 * rationalisation that silently fails on three-term denominators is not.
 */
export function divide(a: ExactValue, b: ExactValue): ExactValue | undefined {
  if (b.length === 0) return undefined;
  if (b.length > 1) return undefined;
  const [divisor] = b;
  const inverse = new Map<string, Rational>();
  for (const [atom, exponent] of divisor.factors)
    inverse.set(atom, Q.negate(exponent));
  const reciprocal = normalize(Q.divide(Q.ONE, divisor.coeff), inverse);
  return reciprocal === undefined ? undefined : multiply(a, [reciprocal]);
}

/** How many times a sum may be multiplied out before we decline the work. */
const MAX_EXPANSION = 12n;

/**
 * A rational power, exactly, or `undefined` where the result is not a real
 * constant this can hold.
 *
 * The interesting case is a fractional exponent, which is where the
 * coefficient must be factored: `\sqrt{8}` is only `2\sqrt2` if the 8 is first
 * seen as `2^3`. A negative base under an even root has no real value and is
 * refused; under an odd root it does, and the sign is carried out.
 */
export function power(
  base: ExactValue,
  exponent: Rational
): ExactValue | undefined {
  if (Q.isZero(exponent)) return fromInteger(1);
  if (base.length === 0) return Q.isNegative(exponent) ? undefined : ZERO;

  if (Q.isInteger(exponent)) {
    const { n } = exponent;
    if (n < 0n) {
      const positive = power(base, Q.negate(exponent));
      return positive === undefined
        ? undefined
        : divide(fromInteger(1), positive);
    }
    if (base.length > 1 && n > MAX_EXPANSION) return undefined;
    let result = fromInteger(1);
    for (let i = 0n; i < n; i++) result = multiply(result, base);
    return result;
  }

  // A fractional power of a sum is not a sum of this shape — `\sqrt{1+\sqrt2}`
  // is a real number with no expression in these atoms.
  if (base.length > 1) return undefined;
  const [single] = base;

  const negativeBase = Q.isNegative(single.coeff);
  // An even root of a negative number is not real. An odd one is, and the sign
  // comes back out front.
  //
  // This deliberately disagrees with Desmos, which was checked: it gives
  // `(-8)^{1/3}` no value at all, not even an error row. The real cube root of
  // -8 is -2, that is the convention an AP course teaches, and answering -2
  // where the calculator answers nothing is the more useful of the two. It is
  // recorded here because it is the one place an exact answer appears beside a
  // blank evaluation box rather than beside a decimal.
  if (negativeBase && exponent.d % 2n === 0n) return undefined;

  const magnitude = negativeBase ? Q.negate(single.coeff) : single.coeff;
  const numerator = factorize(magnitude.n);
  const denominator = factorize(magnitude.d);
  if (numerator === undefined || denominator === undefined) return undefined;

  const factors = new Map<string, Rational>();
  const contribute = (atom: string, e: Rational) =>
    factors.set(atom, Q.add(factors.get(atom) ?? Q.ZERO, e));
  for (const [p, e] of numerator) contribute(p, Q.rational(e));
  for (const [p, e] of denominator) contribute(p, Q.rational(-e));
  for (const [atom, e] of single.factors) contribute(atom, e);

  const raised = new Map<string, Rational>();
  for (const [atom, e] of factors) raised.set(atom, Q.multiply(e, exponent));

  // The sign survives an odd root: (-8)^{1/3} is -2.
  const sign = negativeBase && exponent.n % 2n !== 0n ? Q.rational(-1n) : Q.ONE;
  const result = normalize(sign, raised);
  return result === undefined ? ZERO : [result];
}

// ---- inspection ----------------------------------------------------------

/** Whether this is a plain rational with no irrational atoms left in it. */
export function asRational(value: ExactValue): Rational | undefined {
  if (value.length === 0) return Q.ZERO;
  if (value.length > 1) return undefined;
  const [only] = value;
  return only.factors.size === 0 ? only.coeff : undefined;
}

/** The floating-point value, for cross-checking an exact answer against Desmos. */
export function toNumber(value: ExactValue): number {
  let total = 0;
  for (const t of value) {
    let product = Q.toNumber(t.coeff);
    for (const [atom, e] of t.factors) {
      const base = atom === PI ? Math.PI : atom === E ? Math.E : Number(atom);
      product *= Math.pow(base, Q.toNumber(e));
    }
    total += product;
  }
  return total;
}

// ---- rendering -----------------------------------------------------------

function atomLatex(atom: string) {
  return atom === PI ? "\\pi" : atom === E ? "e" : atom;
}

/**
 * Renders the atoms on one side of a fraction.
 *
 * Radicals are grouped by the denominator of their exponent, so `2^{1/2}` and
 * `3^{1/2}` come back as one `\sqrt6` rather than as `\sqrt2\sqrt3`. That is
 * not cosmetic: `\sqrt2\sqrt3` invites the reader to check whether it was meant
 * to be a product of two separate quantities, and `\sqrt6` cannot be misread.
 */
function atomsLatex(entries: [string, Rational][]): string {
  const plain: string[] = [];
  const radicals = new Map<bigint, bigint>();
  for (const [atom, exponent] of entries) {
    if (Q.isInteger(exponent)) {
      const e = exponent.n;
      plain.push(e === 1n ? atomLatex(atom) : `${atomLatex(atom)}^{${e}}`);
      continue;
    }
    if (atom === PI || atom === E) {
      plain.push(`${atomLatex(atom)}^{${Q.toLatex(exponent)}}`);
      continue;
    }
    // A prime with a fractional exponent joins the radical of that index:
    // p^{a/k} contributes p^a to the radicand under a k-th root.
    const index = exponent.d;
    const contribution = Q.pow(Q.rational(BigInt(atom)), exponent.n);
    radicals.set(index, (radicals.get(index) ?? 1n) * contribution.n);
  }
  const roots = [...radicals]
    .sort((a, b) => Number(a[0] - b[0]))
    .map(([index, radicand]) =>
      index === 2n ? `\\sqrt{${radicand}}` : `\\sqrt[${index}]{${radicand}}`
    );
  return concat([...plain, ...roots]);
}

/**
 * Joins LaTeX fragments by juxtaposition, which is multiplication, inserting a
 * space only where the join would otherwise change what is written.
 *
 * `\pi` beside `e` is the case: written `\pie` it is no longer pi times e but
 * an undefined command named `\pie`, and Desmos renders nothing at all. A
 * command name ends at the first non-letter, so a single space is the whole
 * fix — and it is only needed when a fragment ending in a letter is followed
 * by one starting with a letter. `2\sqrt{2}` and `\pi^{2}` need nothing.
 */
function concat(parts: string[]): string {
  return parts.reduce((acc, part) => {
    if (acc === "" || part === "") return acc + part;
    const glues = /[A-Za-z]$/.test(acc) && /^[A-Za-z]/.test(part);
    return acc + (glues ? " " : "") + part;
  }, "");
}

function termLatex(t: ExactTerm, isFirst: boolean): string {
  const positive: [string, Rational][] = [];
  const negative: [string, Rational][] = [];
  for (const [atom, e] of t.factors)
    (Q.isNegative(e) ? negative : positive).push([
      atom,
      Q.isNegative(e) ? Q.negate(e) : e,
    ]);

  const negativeTerm = Q.isNegative(t.coeff);
  const magnitude = negativeTerm ? Q.negate(t.coeff) : t.coeff;

  const above = atomsLatex(positive);
  const below = atomsLatex(negative);

  // The coefficient's own denominator joins the atoms below the bar, so
  // `\frac{1}{2}\sqrt2` is written `\frac{\sqrt2}{2}` the way a person would.
  // The coefficient's numerator is written only when it says something: `1`
  // in front of a radical is noise, but `1` alone is the whole value.
  const numeratorParts: string[] = [];
  if (magnitude.n !== 1n || above === "")
    numeratorParts.push(String(magnitude.n));
  numeratorParts.push(above);
  const numerator = concat(numeratorParts) || "1";
  const denominatorParts: string[] = [];
  if (magnitude.d !== 1n) denominatorParts.push(String(magnitude.d));
  denominatorParts.push(below);
  const denominator = concat(denominatorParts);

  const body =
    denominator === "" ? numerator : `\\frac{${numerator}}{${denominator}}`;

  if (isFirst) return negativeTerm ? `-${body}` : body;
  return negativeTerm ? `-${body}` : `+${body}`;
}

/**
 * The constant as LaTeX Desmos itself parses, so the result can be put into
 * the expression list rather than only shown.
 */
export function toLatex(value: ExactValue): string {
  if (value.length === 0) return "0";
  return value.map((t, i) => termLatex(t, i === 0)).join("");
}

/**
 * The same value as a syntax tree rather than as a string.
 *
 * Needed because an exact constant is not only something to display. A
 * second-order equation's characteristic roots are exact — `y'' = 2y` has roots
 * ±√2 — and they have to be built into a solution that then gets differentiated
 * numerically and checked against the equation. A string cannot be checked.
 */
export function toNode(value: ExactValue): Node {
  if (value.length === 0) return number(0);
  return value
    .map((t) => termNode(t))
    .reduce((sum, term) => binop("Add", sum, term));
}

/**
 * Builds the atoms on one side of the bar, grouping radicals exactly the way
 * {@link atomsLatex} does.
 *
 * The grouping is not cosmetic here either. `√3·√5` and `√15` are the same
 * number, and only one of them is an answer — a characteristic root of
 * `y'' = -v - 4y` comes out of the discriminant as 3 and 5 separately, and
 * leaving them apart puts two radicals in an exponent where a reader expects
 * one.
 */
function atomsNode(entries: [string, Rational][]): Node | undefined {
  const plain: Node[] = [];
  const radicals = new Map<bigint, bigint>();
  for (const [atom, exponent] of entries) {
    const base: Node =
      atom === PI ? id("pi") : atom === E ? id("e") : number(Number(atom));
    if (Q.isInteger(exponent)) {
      plain.push(
        exponent.n === 1n
          ? base
          : binop("Exponent", base, number(Number(exponent.n)))
      );
      continue;
    }
    if (atom === PI || atom === E) {
      plain.push(
        binop(
          "Exponent",
          base,
          binop(
            "Divide",
            number(Number(exponent.n)),
            number(Number(exponent.d))
          )
        )
      );
      continue;
    }
    const index = exponent.d;
    const contribution = Q.pow(Q.rational(BigInt(atom)), exponent.n);
    radicals.set(index, (radicals.get(index) ?? 1n) * contribution.n);
  }
  for (const [index, radicand] of [...radicals].sort((a, b) =>
    Number(a[0] - b[0])
  )) {
    const inner = number(Number(radicand));
    plain.push(
      index === 2n
        ? functionCall(id("sqrt"), [inner])
        : binop(
            "Exponent",
            inner,
            binop("Divide", number(1), number(Number(index)))
          )
    );
  }
  if (plain.length === 0) return undefined;
  return plain.reduce((left, right) => binop("Multiply", left, right));
}

function termNode(t: ExactTerm): Node {
  const positive: [string, Rational][] = [];
  const negativeExponents: [string, Rational][] = [];
  for (const [atom, exponent] of t.factors)
    (Q.isNegative(exponent) ? negativeExponents : positive).push([
      atom,
      Q.isNegative(exponent) ? Q.negate(exponent) : exponent,
    ]);

  const magnitude = Q.isNegative(t.coeff) ? Q.negate(t.coeff) : t.coeff;
  const above = atomsNode(positive);
  const below = atomsNode(negativeExponents);

  let numerator: Node;
  if (above === undefined) numerator = number(Number(magnitude.n));
  else if (magnitude.n === 1n) numerator = above;
  else numerator = binop("Multiply", number(Number(magnitude.n)), above);

  let denominator: Node | undefined;
  if (magnitude.d !== 1n && below !== undefined)
    denominator = binop("Multiply", number(Number(magnitude.d)), below);
  else if (magnitude.d !== 1n) denominator = number(Number(magnitude.d));
  else denominator = below;

  const body =
    denominator === undefined
      ? numerator
      : binop("Divide", numerator, denominator);
  return Q.isNegative(t.coeff) ? negative(body) : body;
}

// ---- reading a Desmos expression -----------------------------------------

type Node = Aug.Latex.AnyChild;

/**
 * Reads an exact constant out of a parsed Desmos expression, or `undefined` if
 * the expression is not a constant this can hold exactly.
 *
 * This is the half that turns what the user typed into something to reason
 * about: `\sqrt2^3` arrives as a power of a square root and leaves as `2\sqrt2`.
 * Anything with a variable in it, or any function whose exact value is not
 * available, is refused here rather than guessed at further down.
 */
export function evaluateExact(node: Node): ExactValue | undefined {
  switch (node.type) {
    case "Constant": {
      const q = Q.fromNumber(node.value);
      return q === undefined ? undefined : fromRational(q);
    }
    case "Identifier":
      if (node.symbol === PI) return PI_VALUE;
      if (node.symbol === E) return E_VALUE;
      // Any other name is a variable, and a variable has no exact value here.
      return undefined;
    case "Negative": {
      const inner = evaluateExact(node.arg);
      return inner === undefined ? undefined : negate(inner);
    }
    case "BinaryOperator":
      return binaryExact(node);
    case "FunctionCall":
      return functionExact(node);
    default:
      return undefined;
  }
}

function binaryExact(node: Aug.Latex.BinaryOperator): ExactValue | undefined {
  const left = evaluateExact(node.left);
  if (left === undefined) return undefined;
  const right = evaluateExact(node.right);
  if (right === undefined) return undefined;
  switch (node.name) {
    case "Add":
      return add(left, right);
    case "Subtract":
      return subtract(left, right);
    case "Multiply":
    case "CrossMultiply":
      return multiply(left, right);
    case "Divide":
      return divide(left, right);
    case "Exponent": {
      // Only a rational exponent keeps the result inside this representation.
      // `2^\pi` is a perfectly good real number and not one of these.
      const exponent = asRational(right);
      return exponent === undefined ? undefined : power(left, exponent);
    }
  }
}

function functionExact(node: Aug.Latex.FunctionCall): ExactValue | undefined {
  const name = node.callee.symbol;
  if (node.args.length !== 1) return undefined;
  const [argument] = node.args;
  const inner = evaluateExact(argument);
  if (inner === undefined) return undefined;
  switch (name) {
    case "sqrt":
      return power(inner, Q.rational(1n, 2n));
    case "exp": {
      // `\exp(2)` is `e^2`, which this holds exactly; `\exp(\sqrt2)` is not of
      // that shape and is refused.
      const exponent = asRational(inner);
      return exponent === undefined ? undefined : power(E_VALUE, exponent);
    }
    default:
      return undefined;
  }
}
