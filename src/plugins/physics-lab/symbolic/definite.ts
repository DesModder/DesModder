/**
 * Definite integrals, evaluated exactly at their bounds.
 *
 * The antiderivative already exists; what this adds is `F(b) - F(a)` done as
 * exact arithmetic, and the three ways that subtraction can be wrong:
 *
 * - **A bound at infinity, or at a point the integrand is not defined.** Then
 *   `F` is not evaluated there but taken as a limit, which is what an improper
 *   integral is. `∫₀¹ ln x dx` needs `x ln x → 0` as `x → 0⁺`; `∫₀^∞ e^{-x}`
 *   needs `e^{-x} → 0`. If the limit is infinite the integral diverges, and
 *   that is the answer.
 * - **A singularity inside the interval.** `∫₋₁¹ dx/x²` is not `-2` whatever
 *   the arithmetic says: the integrand is not integrable across zero. The
 *   pole is located exactly, the interval is cut there, and each piece is a
 *   one-sided limit — here both run to +∞, so the integral diverges.
 * - **An antiderivative that jumps.** The half-angle substitution answers
 *   `∫dx/(2+sin x)` with a `tan(x/2)` that leaps at `x = π`, so `F(2π) - F(0)`
 *   is `0` for an integral of a positive function. The poles of `tan` are
 *   found exactly too, and the interval is cut at them in the same way, which
 *   gives the true `2π/√3`. Numeric quadrature checks the total afterwards;
 *   a disagreement — a break nothing here located — is a refusal, never a
 *   decimal answer in its place.
 *
 * ## Exact, at the bounds
 *
 * Substituting a bound gives a constant expression — `arctan(1) - arctan(0)` —
 * and turning that into `π/4` needs the special values a course uses: the
 * trigonometric functions at multiples of `π/6` and `π/4`, their inverses at
 * the matching values, `ln` of a rational as logarithms of primes, `e^{ln a}`
 * as `a`. What does not reduce is kept as the expression it is (an opaque atom
 * in `exact.ts`), which is exact and merely unsimplified.
 */
import {
  add as addNodes,
  asRatio,
  call,
  dependsOn,
  divide,
  evaluate,
  fold,
  id,
  identifiersIn,
  multiply,
  number as numberNode,
  power,
  quotientFactors,
  replaceIdentifier,
  topLevelTerms,
  visit,
  type Node,
} from "../../../symbolic";
import * as X from "./exact";
import * as Q from "./rational";
import { coefficientsIn, linearIn } from "./integrate";
import { factorOverQ } from "./factor";
import {
  leadingTerm,
  leadingTermOver,
  PowerSeriesError,
  type CoefficientField,
} from "./powerSeries";

/** Thrown for a definite integral this will not evaluate, with the reason. */
export class DefiniteError extends Error {}

/** A bound: a number written exactly, or one of the two infinities. */
export type Bound =
  | { kind: "finite"; node: Node; value: number }
  | { kind: "infinite"; sign: 1 | -1 };

export interface DefiniteResult {
  /** The exact value; undefined when the integral diverges. */
  exact?: X.ExactValue;
  /** Its decimal value, for showing beside it. */
  value: number;
  /**
   * Set when the integral diverges: to the infinity it diverges to, or 0 when
   * its pieces run off in different directions and it has no sign at all.
   */
  diverges?: 1 | -1 | 0;
  /** Whether a bound was an infinity or a point the integrand blows up at. */
  improper: boolean;
}

// ---- constants, exactly ------------------------------------------------------

const PI_OVER = (n: number, d: number) =>
  X.multiply(X.PI_VALUE, X.fromRational(Q.rational(BigInt(n), BigInt(d))));

const root = (n: number, over: number, times = 1) =>
  X.multiply(
    X.power(X.fromInteger(n), Q.rational(1n, 2n)) ?? X.ZERO,
    X.fromRational(Q.rational(BigInt(times), BigInt(over)))
  );

/** sin at kπ/12 for the twelfths a course uses, in units of the table. */
function sineAt(twelfths: number): X.ExactValue | undefined {
  const k = ((twelfths % 24) + 24) % 24;
  const table: Record<number, X.ExactValue> = {
    0: X.ZERO,
    2: X.fromRational(Q.rational(1n, 2n)),
    3: root(2, 2),
    4: root(3, 2),
    6: X.fromInteger(1),
  };
  const fold180 = k > 12 ? k - 12 : k;
  const sign = k > 12 ? -1 : 1;
  const first = fold180 > 6 ? 12 - fold180 : fold180;
  const value = table[first];
  if (value === undefined) return undefined;
  return sign < 0 ? X.negate(value) : value;
}

const equal = (a: X.ExactValue, b: X.ExactValue) =>
  X.subtract(a, b).length === 0;

/** The inverse sine at the values in the table, as a multiple of π. */
function arcsineOf(value: X.ExactValue): X.ExactValue | undefined {
  for (const [twelfths, sine] of [
    [0, sineAt(0)],
    [2, sineAt(2)],
    [3, sineAt(3)],
    [4, sineAt(4)],
    [6, sineAt(6)],
  ] as const) {
    if (sine === undefined) continue;
    if (equal(value, sine)) return PI_OVER(twelfths, 12);
    if (equal(value, X.negate(sine))) return PI_OVER(-twelfths, 12);
  }
  return undefined;
}

/** The inverse tangent at 0, √3/3, 1 and √3, as a multiple of π. */
function arctangentOf(value: X.ExactValue): X.ExactValue | undefined {
  const table: [X.ExactValue, number][] = [
    [X.ZERO, 0],
    [root(3, 3), 2],
    [X.fromInteger(1), 3],
    [root(3, 1), 4],
  ];
  for (const [tangent, twelfths] of table) {
    if (equal(value, tangent)) return PI_OVER(twelfths, 12);
    if (equal(value, X.negate(tangent))) return PI_OVER(-twelfths, 12);
  }
  return undefined;
}

/** The value as a rational multiple of π, in twelfths, when it is one. */
function twelfthsOfPi(value: X.ExactValue): number | undefined {
  if (value.length === 0) return 0;
  const single = X.atomsOf(value);
  if (single === undefined || single.factors.size !== 1) return undefined;
  const [[atom, exponent]] = [...single.factors];
  if (!X.isPiAtom(atom) || !Q.isOne(exponent)) return undefined;
  const twelfths = Q.multiply(single.coeff, Q.rational(12n));
  return Q.isInteger(twelfths) ? Number(twelfths.n) : undefined;
}

/**
 * A constant expression as an exact value, reducing what the special values
 * reduce and keeping the rest as the expression it is. Undefined only for
 * something that has no real value at all.
 */
export function exactConstant(node: Node): X.ExactValue | undefined {
  const numeric = evaluate(node, {});
  // A pole evaluated in floating point comes back as 1.6e16 rather than as
  // infinity -- tan(π/2) does -- and no exact constant a course produces is
  // anywhere near that size.
  if (!Number.isFinite(numeric) || Math.abs(numeric) > 1e12) return undefined;
  // And not only the whole: `arctan(tan(π/2))` evaluates to a finite π/2 in
  // floating point because the pole inside it is merely enormous. An
  // expression with a pole anywhere inside is not a constant at all, and
  // wrapping it as one would hide a limit that has to be taken.
  if (containsPole(node)) return undefined;
  const reduced = reduce(node);
  if (reduced !== undefined) {
    // Every reduction is checked against the float it claims to be. A wrong
    // entry in a table would otherwise be a wrong answer nobody could see.
    const claimed = X.toNumber(reduced);
    if (Math.abs(claimed - numeric) <= 1e-9 * Math.max(1, Math.abs(numeric)))
      return reduced;
  }
  return X.opaque(fold(node), numeric);
}

/** Whether any sub-expression is infinite, undefined, or pole-sized. */
function containsPole(node: Node): boolean {
  let pole = false;
  visit(node, (child) => {
    if (pole || child.type === "Identifier") return;
    const value = evaluate(child, {});
    if (!Number.isFinite(value) || Math.abs(value) > 1e12) pole = true;
  });
  return pole;
}

function reduce(node: Node): X.ExactValue | undefined {
  switch (node.type) {
    case "Constant":
    case "Identifier":
      return X.evaluateExact(node);
    case "Negative": {
      const inner = exactConstant(node.arg);
      return inner === undefined ? undefined : X.negate(inner);
    }
    case "BinaryOperator": {
      const left = exactConstant(node.left);
      const right = exactConstant(node.right);
      if (left === undefined || right === undefined) return undefined;
      switch (node.name) {
        case "Add":
          return X.add(left, right);
        case "Subtract":
          return X.subtract(left, right);
        case "Multiply":
        case "CrossMultiply":
          return X.multiply(left, right);
        case "Divide":
          return X.divide(left, right);
        case "Exponent": {
          if (node.left.type === "Identifier" && node.left.symbol === "e")
            return exponential(right);
          // 1 to any power is 1, and 1^π is not a new number.
          if (X.subtract(left, X.fromInteger(1)).length === 0)
            return X.fromInteger(1);
          const r = X.asRational(right);
          return r === undefined ? undefined : X.power(left, r);
        }
      }
      return undefined;
    }
    case "FunctionCall": {
      if (node.args.length !== 1) return undefined;
      const inner = exactConstant(node.args[0]);
      if (inner === undefined) return undefined;
      return special(node.callee.symbol, inner);
    }
    default:
      return undefined;
  }
}

/** `e^v`, which reduces when `v` is a rational plus logarithms of primes. */
function exponential(v: X.ExactValue): X.ExactValue | undefined {
  let total = X.fromInteger(1);
  for (const t of v) {
    if (t.factors.size === 0) {
      const raised = X.power(X.E_VALUE, t.coeff);
      if (raised === undefined) return undefined;
      total = X.multiply(total, raised);
      continue;
    }
    // k·ln p: e to it is p^k.
    if (t.factors.size !== 1) return undefined;
    const [[atom, exponent]] = [...t.factors];
    const match = /^@ln:(\d+)$/.exec(atom);
    if (match === null || !Q.isOne(exponent)) return undefined;
    const raised = X.power(X.fromInteger(BigInt(match[1])), t.coeff);
    if (raised === undefined) return undefined;
    total = X.multiply(total, raised);
  }
  return total;
}

/**
 * `name(arg)` as a tree, with the exponential spelled `e^{arg}`.
 *
 * One spelling, because an exponential nothing reduces becomes an opaque atom
 * keyed by its tree: `\exp(π)` and `e^{π}` would be two different atoms for
 * one number, and `e^{π+h} - e^{π}` would never cancel. And `e^{π}` is also
 * how Desmos writes it.
 */
function applied(name: string, arg: Node): Node {
  return name === "exp" ? power(id("e"), arg) : call(name, arg);
}

function special(name: string, v: X.ExactValue): X.ExactValue | undefined {
  switch (name) {
    case "sqrt":
      return X.power(v, Q.rational(1n, 2n));
    case "abs":
      return X.toNumber(v) < 0 ? X.negate(v) : v;
    case "exp":
      return exponential(v);
    case "ln":
      return naturalLog(v);
    case "log": {
      // log v = ln v / ln 10, so log 1 is exactly 0 and log 100 exactly 2.
      const top = naturalLog(v);
      const ten = naturalLog(X.fromInteger(10));
      return top === undefined || ten === undefined
        ? undefined
        : X.divide(top, ten);
    }
    case "sin":
    case "cos":
    case "tan":
    case "sec":
    case "csc":
    case "cot": {
      const k = twelfthsOfPi(v);
      if (k === undefined) return undefined;
      const s = sineAt(k);
      const c = sineAt(k + 6);
      if (s === undefined || c === undefined) return undefined;
      const quotient = (a: X.ExactValue, b: X.ExactValue) =>
        b.length === 0 ? undefined : X.divide(a, b);
      if (name === "sin") return s;
      if (name === "cos") return c;
      if (name === "tan") return quotient(s, c);
      if (name === "cot") return quotient(c, s);
      if (name === "sec") return quotient(X.fromInteger(1), c);
      return quotient(X.fromInteger(1), s);
    }
    case "arcsin":
      return arcsineOf(v);
    case "arccos": {
      const s = arcsineOf(v);
      return s === undefined ? undefined : X.subtract(PI_OVER(1, 2), s);
    }
    case "arctan":
      return arctangentOf(v);
    case "sinh":
    case "tanh":
      return v.length === 0 ? X.ZERO : undefined;
    case "cosh":
      return v.length === 0 ? X.fromInteger(1) : undefined;
    default:
      return undefined;
  }
}

/** `ln v` for a single positive product of rationals, primes, π and e. */
function naturalLog(v: X.ExactValue): X.ExactValue | undefined {
  const single = X.atomsOf(v);
  if (single === undefined || Q.isNegative(single.coeff)) return undefined;
  let total = X.logarithm(single.coeff);
  if (total === undefined) return undefined;
  for (const [atom, exponent] of single.factors) {
    const log = X.logarithmOfAtom(atom);
    if (log === undefined) return undefined;
    total = X.add(total, X.multiply(X.fromRational(exponent), log));
  }
  return total;
}

// ---- limits ------------------------------------------------------------------

export type Limit =
  | { kind: "finite"; value: X.ExactValue }
  | { kind: "infinite"; sign: 1 | -1 };

/** Where a limit is taken: at an infinity, or at a point from one side. */
export type Approach =
  | { kind: "infinite"; sign: 1 | -1 }
  | { kind: "point"; node: Node; value: number; side: 1 | -1 };

/**
 * What decided a limit, recorded by the rule that did it.
 *
 * Recorded rather than inferred for the reason the integrator records its
 * technique: `sin(3x)/sin(5x)` and `(3x²+1)/(2x²-x)` both come out as a
 * fraction, and nothing about the fraction says whether a series or a pair of
 * leading terms produced it.
 */
export type LimitTechnique =
  | "substitution"
  | "leading-terms"
  | "exp-log"
  | "series"
  | "growth"
  | "squeeze"
  | "dominant-term"
  | "one-sided"
  | "end-behaviour";

/** Called with each technique as it decides part of a limit. */
export type LimitRecorder = (technique: LimitTechnique) => void;

const ignore: LimitRecorder = () => {};

/** A point close to the approach, for reading signs off. */
function near(approach: Approach, scale = 1): number {
  return approach.kind === "infinite"
    ? approach.sign * 1e6 * scale
    : approach.value + approach.side * 1e-7 * scale;
}

/**
 * The limit of `node` as the variable approaches, by rules on the tree, or
 * undefined for an indeterminate form this cannot resolve.
 *
 * Signs are read from the expression near the approach, which is a fact about
 * the function there; everything else is structural. The resolved forms are
 * the ones improper integrals in a course produce: a power beating a
 * logarithm at zero, an exponential beating a power at infinity, and a
 * quotient of polynomials.
 */
export function limitOf(
  node: Node,
  variable: string,
  approach: Approach,
  record: LimitRecorder = ignore
): Limit | undefined {
  // Each attempt records into its own list, and only the one that answered
  // passes its list up. The rules try a branch, fail and fall through to the
  // series all the time, and a technique that decided nothing must not end up
  // named as the one that did.
  for (const attempt of [limitByRules, seriesLimit]) {
    const used: LimitTechnique[] = [];
    const found = attempt(node, variable, approach, (t) => used.push(t));
    if (found !== undefined && decided(found)) {
      used.forEach(record);
      return found;
    }
  }
  return undefined;
}

/**
 * Whether an exact value is certainly zero or certainly not.
 *
 * Undefined in between: a value that is not written as zero and is
 * numerically indistinguishable from it. `ln(1)` read through `log` once
 * came back as an opaque atom worth exactly 0 that did not look like 0, and
 * `log(1+x)/x` at 0 was divided by it and answered +∞. An answer that
 * depends on a zero nobody proved is not an answer.
 */
export function certainlyZero(value: X.ExactValue): boolean | undefined {
  if (value.length === 0) return true;
  // Relative, not absolute: (1/π)^{24}/24 is 5·10⁻¹⁴ and perfectly certain.
  // What is uncertain is a term that is itself worth nothing, or terms that
  // cancel to almost nothing against their own size.
  const sizes = value.map((t) => Math.abs(X.toNumber([t])));
  if (sizes.some((s) => !Number.isFinite(s) || s === 0)) return undefined;
  const total = Math.abs(X.toNumber(value));
  if (total <= 1e-12 * Math.max(...sizes)) return undefined;
  return false;
}

/**
 * The sign `node` keeps on a whole one-sided neighbourhood of the approach —
 * `1`, `-1`, `0` for a constant zero — or undefined when that is not proved.
 *
 * Proved, not sampled. A non-zero limit fixes the sign near the point; a zero
 * limit is decided by the leading term `c·h^v` of the exact series in the
 * distance `h > 0`, whose coefficient's sign is the sign of the function for
 * all small enough `h`. `x sin(1/x)` at 0 has neither, and changes sign
 * infinitely often however close you look, so it has no eventual sign and
 * gets none.
 */
export function eventualSign(
  node: Node,
  variable: string,
  approach: Approach
): 1 | -1 | 0 | undefined {
  const signOf = (value: X.ExactValue): 1 | -1 | 0 | undefined => {
    const zero = certainlyZero(value);
    if (zero === undefined) return undefined;
    if (zero) return 0;
    return X.toNumber(value) < 0 ? -1 : 1;
  };
  if (!dependsOn(node, variable)) {
    const value = exactConstant(node);
    return value === undefined ? undefined : signOf(value);
  }
  const found = limitOf(node, variable, approach);
  if (found?.kind === "infinite") return found.sign;
  if (found !== undefined) {
    const sign = signOf(found.value);
    if (sign !== 0) return sign;
  }
  const lead = leadingTermExactly(
    movedToZero(node, variable, approach),
    LIMIT_STEP
  );
  if (lead === undefined) return undefined;
  const sign = signOf(lead.coefficient);
  return sign === 0 ? undefined : sign;
}

/** A limit whose value is certainly zero or certainly not. */
const decided = (found: Limit) =>
  found.kind === "infinite" || certainlyZero(found.value) !== undefined;

/**
 * The limit read off a series, for the indeterminate forms the rules leave:
 * `sin(x)/x` at 0, `(1-cos x)/x²`, `x ln(1 + 1/x)` at infinity.
 *
 * The point is moved to zero — `x = a ± h` at a finite point, `x = ±1/h` at
 * infinity, with `h → 0⁺` — and the first non-zero term `c·h^v` of the exact
 * series decides it: `v > 0` is 0, `v = 0` is `c`, `v < 0` is an infinity with
 * the sign of `c`. A series that vanishes to every order computed decides
 * nothing, and the limit stays unknown rather than being called zero.
 *
 * Rational coefficients are tried first, because they are fast and cover
 * most of what a course writes. When they cannot represent a coefficient —
 * `(1 + π/x)^x` has `π` in every one, and `sin x` about `π/6` has `√3/2` —
 * the same series is taken over the exact constants instead, so the limit is
 * `e^π` and `√3/2` rather than a refusal.
 */
function seriesLimit(
  node: Node,
  variable: string,
  approach: Approach,
  record: LimitRecorder
): Limit | undefined {
  const moved = movedToZero(node, variable, approach);
  const lead = leadingTermExactly(moved, LIMIT_STEP);
  if (lead === undefined) return undefined;
  record("series");
  if (lead.valuation > 0) return { kind: "finite", value: X.ZERO };
  if (lead.valuation === 0) return { kind: "finite", value: lead.coefficient };
  return {
    kind: "infinite",
    sign: X.toNumber(lead.coefficient) < 0 ? -1 : 1,
  };
}

/** A name no Desmos expression can contain, so a substitution is clean. */
export const LIMIT_STEP = "limitStep";

/**
 * The expression with the approach moved to `h → 0⁺`: `x = a ± h` at a
 * point, `x = ±1/h` at an infinity.
 */
export function movedToZero(
  node: Node,
  variable: string,
  approach: Approach
): Node {
  const h = id(LIMIT_STEP);
  if (approach.kind === "infinite")
    return replaceIdentifier(
      node,
      variable,
      divide(numberNode(approach.sign), h)
    );
  const at = X.asRational(exactConstant(approach.node) ?? []);
  const centre =
    at === undefined ? approach.node : X.toNode(X.fromRational(at));
  return replaceIdentifier(
    node,
    variable,
    addNodes(centre, multiply(numberNode(approach.side), h))
  );
}

/**
 * The exact constants as a field of series coefficients.
 *
 * Zero has to be certain. The exact representation is canonical for the
 * atoms it knows, but two opaque atoms that happen to be equal — two
 * spellings of the same number nothing reduced — would subtract to something
 * that is zero and does not look it, and a leading coefficient that is
 * really zero makes a wrong limit rather than an unknown one. So a
 * coefficient that is not structurally zero and is numerically
 * indistinguishable from zero is neither: the expansion stops.
 */
export const EXACT_CONSTANTS: CoefficientField<X.ExactValue> = {
  zero: X.ZERO,
  one: X.fromInteger(1),
  fromRational: X.fromRational,
  add: X.add,
  negate: X.negate,
  multiply: X.multiply,
  inverse: (a) => X.divide(X.fromInteger(1), a),
  isZero: (a) => {
    const zero = certainlyZero(a);
    if (zero === undefined)
      throw new PowerSeriesError(
        "A coefficient could not be decided to be zero or not."
      );
    return zero;
  },
  power: X.power,
  constant: (node) => exactConstant(node),
  apply: (name, c) => exactConstant(applied(name, X.toNode(c))),
};

/**
 * The leading term of a series about zero, over the rationals if they will
 * do and the exact constants if not. Undefined when neither decides it.
 */
export function leadingTermExactly(
  node: Node,
  variable: string
): { valuation: number; coefficient: X.ExactValue } | undefined {
  try {
    const lead = leadingTerm(node, variable);
    if (lead === undefined) return undefined;
    return {
      valuation: lead.valuation,
      coefficient: X.fromRational(lead.coefficient),
    };
  } catch (error) {
    if (!(error instanceof PowerSeriesError)) throw error;
  }
  try {
    return leadingTermOver(EXACT_CONSTANTS, node, variable);
  } catch (error) {
    if (error instanceof PowerSeriesError) return undefined;
    throw error;
  }
}

function limitByRules(
  node: Node,
  variable: string,
  approach: Approach,
  record: LimitRecorder
): Limit | undefined {
  if (!dependsOn(node, variable)) {
    const value = exactConstant(node);
    return value === undefined ? undefined : { kind: "finite", value };
  }
  // Continuous at a finite point: just substitute.
  if (approach.kind === "point") {
    const at = evaluate(node, { [variable]: approach.value });
    const beside = evaluate(node, { [variable]: near(approach) });
    if (
      Number.isFinite(at) &&
      Number.isFinite(beside) &&
      Math.abs(at - beside) < 1e-4 * Math.max(1, Math.abs(at))
    ) {
      const substituted = replaceIdentifier(node, variable, approach.node);
      // Floating point says 0^0 = 1, which is why x^x looks continuous at 0.
      // It is a form, not a value, and substituting into it is not a method.
      const value = zeroToTheZero(substituted)
        ? undefined
        : exactConstant(substituted);
      if (value !== undefined) {
        record("substitution");
        return { kind: "finite", value };
      }
    }
  }
  const sign = (n: Node): 1 | -1 =>
    evaluate(n, { [variable]: near(approach) }) < 0 ? -1 : 1;
  const zero = (l: Limit) => l.kind === "finite" && l.value.length === 0;
  const recurse = (n: Node) => limitOf(n, variable, approach, record);

  switch (node.type) {
    case "Identifier":
      return approach.kind === "infinite"
        ? { kind: "infinite", sign: approach.sign }
        : { kind: "finite", value: exactConstant(approach.node) ?? X.ZERO };
    case "Negative": {
      const inner = recurse(node.arg);
      if (inner === undefined) return undefined;
      return inner.kind === "finite"
        ? { kind: "finite", value: X.negate(inner.value) }
        : { kind: "infinite", sign: inner.sign === 1 ? -1 : 1 };
    }
    case "BinaryOperator": {
      if (node.name === "Exponent")
        return powerLimit(node, variable, approach, record);
      // Before the parts: a quotient of polynomials is decided by its leading
      // terms whatever the parts do, and `2x² - x` on its own is an ∞ - ∞
      // that would otherwise be resolved, and recorded, for nothing.
      if (node.name === "Divide") {
        const ratio = polynomialRatio(node, variable, approach, record);
        if (ratio !== undefined) return ratio;
      }
      const left = recurse(node.left);
      const right = recurse(node.right);
      switch (node.name) {
        case "Add":
        case "Subtract": {
          // Something running off to infinity plus something that stays
          // bounded runs off too: x + sin x → ∞, whatever the sine does.
          if (left === undefined || right === undefined) {
            const [known, other] =
              left === undefined ? [right, node.left] : [left, node.right];
            if (known?.kind !== "infinite" || !isBounded(other))
              return undefined;
            record("squeeze");
            // bounded - B goes where -B goes; A ± bounded goes where A goes.
            const negated = left === undefined && node.name === "Subtract";
            return {
              kind: "infinite",
              sign: negated ? (-known.sign as 1 | -1) : known.sign,
            };
          }
          const flip = node.name === "Subtract" ? -1 : 1;
          if (left.kind === "finite" && right.kind === "finite")
            return {
              kind: "finite",
              value:
                flip === 1
                  ? X.add(left.value, right.value)
                  : X.subtract(left.value, right.value),
            };
          const signs = [
            left.kind === "infinite" ? left.sign : 0,
            right.kind === "infinite" ? right.sign * flip : 0,
          ].filter((s) => s !== 0);
          if (signs.every((s) => s === signs[0]))
            return { kind: "infinite", sign: signs[0] as 1 | -1 };
          return dominantTerm(node, variable, approach, record);
        }
        case "Multiply":
        case "CrossMultiply": {
          if (left === undefined || right === undefined)
            return (
              squeezed(node, left, right, record) ??
              dominated(node, variable, approach, record)
            );
          if (left.kind === "finite" && right.kind === "finite")
            return {
              kind: "finite",
              value: X.multiply(left.value, right.value),
            };
          if (zero(left) || zero(right))
            return dominated(node, variable, approach, record);
          return { kind: "infinite", sign: sign(node) };
        }
        case "Divide": {
          if (left === undefined || right === undefined)
            return (
              squeezed(node, left, right, record) ??
              dominated(node, variable, approach, record)
            );
          if (left.kind === "finite" && right.kind === "finite") {
            if (right.value.length === 0) {
              if (zero(left))
                return dominated(node, variable, approach, record);
              // A non-zero number over something vanishing: the side the
              // denominator vanishes from decides the sign.
              record("one-sided");
              return { kind: "infinite", sign: sign(node) };
            }
            const value = X.divide(left.value, right.value);
            if (value !== undefined) return { kind: "finite", value };
            const direct = exactConstant(
              divide(X.toNode(left.value), X.toNode(right.value))
            );
            return direct === undefined
              ? undefined
              : { kind: "finite", value: direct };
          }
          if (left.kind === "finite" && right.kind === "infinite")
            return { kind: "finite", value: X.ZERO };
          if (left.kind === "infinite" && right.kind === "finite") {
            if (right.value.length === 0) record("one-sided");
            return { kind: "infinite", sign: sign(node) };
          }
          return dominated(node, variable, approach, record);
        }
      }
      return undefined;
    }
    case "FunctionCall":
      return functionLimit(node, variable, approach, record);
    default:
      return undefined;
  }
}

/**
 * `ln A` written as a sum the limit rules can take apart, or undefined when
 * nothing here applies:
 *
 * - `ln(e^u) = u` and `ln(a^u) = u ln a` for a positive constant `a`;
 * - `ln(A + B) = ln B + ln(1 + A/B)` when `A/B → 0`: the dominant term comes
 *   out, and what is left is a logarithm of something tending to 1.
 *
 * Every identity holds exactly wherever both sides are defined, and the
 * caller only asks while `A` is positive near the approach.
 */
function expandedLogarithm(
  node: Node,
  variable: string,
  approach: Approach,
  depth = 0
): Node | undefined {
  if (depth > 3) return undefined;
  if (node.type === "BinaryOperator" && node.name === "Exponent") {
    if (node.left.type === "Identifier" && node.left.symbol === "e")
      return node.right;
    if (!dependsOn(node.left, variable) && evaluate(node.left, {}) > 0)
      return multiply(node.right, call("ln", node.left));
  }
  if (
    node.type === "BinaryOperator" &&
    (node.name === "Add" || node.name === "Subtract")
  ) {
    const other = (
      dominant: Node,
      rest: Node,
      sign: 1 | -1
    ): Node | undefined => {
      const ratio = limitOf(divide(rest, dominant), variable, approach);
      if (ratio?.kind !== "finite" || certainlyZero(ratio.value) !== true)
        return undefined;
      if (!(evaluate(dominant, { [variable]: near(approach) }) > 0))
        return undefined;
      const inner =
        expandedLogarithm(dominant, variable, approach, depth + 1) ??
        call("ln", dominant);
      const small = divide(rest, dominant);
      return addNodes(
        inner,
        call(
          "ln",
          addNodes(
            numberNode(1),
            sign > 0 ? small : multiply(numberNode(-1), small)
          )
        )
      );
    };
    // A + B: either term may dominate. L - R = L(1 - R/L): only the left, since
    // the whole is positive and a dominant subtracted term would make it not.
    return node.name === "Add"
      ? (other(node.right, node.left, 1) ?? other(node.left, node.right, 1))
      : other(node.left, node.right, -1);
  }
  return undefined;
}

/** Whether a constant expression contains `0^0` anywhere inside it. */
function zeroToTheZero(node: Node): boolean {
  let found = false;
  visit(node, (child) => {
    if (
      !found &&
      child.type === "BinaryOperator" &&
      child.name === "Exponent" &&
      evaluate(child.left, {}) === 0 &&
      evaluate(child.right, {}) === 0
    )
      found = true;
  });
  return found;
}

function powerLimit(
  node: Node & { type: "BinaryOperator" },
  variable: string,
  approach: Approach,
  record: LimitRecorder
): Limit | undefined {
  const { left, right } = node;
  if (left.type === "Identifier" && left.symbol === "e")
    return functionLimit(call("exp", right), variable, approach, record);
  if (dependsOn(right, variable)) {
    // A^B with the variable in both: exp(B ln A), which is where 1^∞, 0^0 and
    // ∞^0 stop being forms and become one limit of a product. Only while A is
    // positive near the point, where the logarithm is real.
    if (!(evaluate(left, { [variable]: near(approach) }) > 0)) return undefined;
    // B times each term of the logarithm, so that (1/x)(x ln 2 + …) reaches
    // the rules as ln 2 + … rather than as 0·∞.
    const exponent = (logarithm: Node) =>
      functionLimit(
        call(
          "exp",
          topLevelTerms(logarithm)
            .map(({ term, negated }) => {
              const product = fold(multiply(right, term));
              return negated ? multiply(numberNode(-1), product) : product;
            })
            .reduce((total, term) => addNodes(total, term))
        ),
        variable,
        approach,
        record
      );
    let found = exponent(call("ln", left));
    if (found === undefined) {
      // The logarithm taken apart where it can be: (1 + 2^x)^{1/x} is
      // exp((x ln 2 + ln(1 + 2^{-x}))/x), which is e^{ln 2} = 2 -- and
      // exp(ln(1 + 2^x)/x) on its own is a growth race the rules cannot run.
      const expanded = expandedLogarithm(left, variable, approach);
      if (expanded !== undefined) {
        found = exponent(expanded);
        if (found !== undefined) record("dominant-term");
      }
    }
    if (found !== undefined) record("exp-log");
    return found;
  }
  const r = X.asRational(exactConstant(right) ?? []);
  if (r === undefined) return undefined;
  const base = limitOf(left, variable, approach, record);
  if (base === undefined) return undefined;
  if (base.kind === "infinite") {
    if (Q.isNegative(r)) return { kind: "finite", value: X.ZERO };
    if (base.sign < 0 && r.d !== 1n) return undefined;
    const odd = r.d === 1n && r.n % 2n !== 0n;
    return { kind: "infinite", sign: base.sign < 0 && odd ? -1 : 1 };
  }
  if (base.value.length === 0) {
    if (Q.isNegative(r)) {
      const s = evaluate(node, { [variable]: near(approach) }) < 0 ? -1 : 1;
      record("one-sided");
      return { kind: "infinite", sign: s };
    }
    return { kind: "finite", value: X.ZERO };
  }
  const value = X.power(base.value, r);
  return value === undefined ? undefined : { kind: "finite", value };
}

function functionLimit(
  node: Node & { type: "FunctionCall" },
  variable: string,
  approach: Approach,
  record: LimitRecorder
): Limit | undefined {
  if (node.args.length !== 1) return undefined;
  const name = node.callee.symbol;
  const inner = limitOf(node.args[0], variable, approach, record);
  if (inner === undefined) return undefined;
  if (inner.kind === "infinite") {
    const s = inner.sign;
    const found = ((): Limit | undefined => {
      switch (name) {
        case "exp":
          return s > 0
            ? { kind: "infinite", sign: 1 }
            : { kind: "finite", value: X.ZERO };
        case "ln":
        case "sqrt":
          return s > 0 ? { kind: "infinite", sign: 1 } : undefined;
        case "abs":
        case "cosh":
          return { kind: "infinite", sign: 1 };
        // Within 1 of their argument, so they go where it goes.
        case "floor":
        case "ceil":
        case "round":
          return { kind: "infinite", sign: s };
        case "sign":
          return { kind: "finite", value: X.fromInteger(s) };
        case "sinh":
          return { kind: "infinite", sign: s };
        case "arctan":
          return { kind: "finite", value: PI_OVER(s, 2) };
        case "tanh":
          return { kind: "finite", value: X.fromInteger(s) };
        default:
          // sin and cos at infinity oscillate and have no limit.
          return undefined;
      }
    })();
    if (found !== undefined) record("end-behaviour");
    return found;
  }
  // A pole of a trigonometric function: tan and sec where cos vanishes, cot
  // and csc where sin does. The side decides the sign.
  if (["tan", "sec", "cot", "csc"].includes(name)) {
    const k = twelfthsOfPi(inner.value);
    const cosZero = k !== undefined && ((k % 12) + 12) % 12 === 6;
    const sinZero = k !== undefined && ((k % 12) + 12) % 12 === 0;
    const pole = name === "tan" || name === "sec" ? cosZero : sinZero;
    if (pole) {
      const s = evaluate(node, { [variable]: near(approach) }) < 0 ? -1 : 1;
      record("one-sided");
      return { kind: "infinite", sign: s };
    }
  }
  if (inner.value.length === 0) {
    if (name === "ln") {
      // ln of something tending to zero from above.
      const inside = evaluate(node.args[0], { [variable]: near(approach) });
      if (!(inside > 0)) return undefined;
      record("one-sided");
      return { kind: "infinite", sign: -1 };
    }
  }
  const value = exactConstant(applied(name, X.toNode(inner.value)));
  return value === undefined ? undefined : { kind: "finite", value };
}

/**
 * `P/Q` for two polynomials, at infinity: the leading terms decide it.
 */
function polynomialRatio(
  node: Node & { type: "BinaryOperator" },
  variable: string,
  approach: Approach,
  record: LimitRecorder
): Limit | undefined {
  if (approach.kind !== "infinite") return undefined;
  const top = numericPolynomial(node.left, variable);
  const bottom = numericPolynomial(node.right, variable);
  if (top === undefined || bottom === undefined) return undefined;
  const m = top.length - 1;
  const n = bottom.length - 1;
  record("leading-terms");
  if (m < n) return { kind: "finite", value: X.ZERO };
  if (m === n)
    return {
      kind: "finite",
      value: X.fromRational(Q.divide(top[m], bottom[n])),
    };
  const s = evaluate(node, { [variable]: near(approach) }) < 0 ? -1 : 1;
  return { kind: "infinite", sign: s };
}

export function numericPolynomial(
  node: Node,
  variable: string
): Q.Rational[] | undefined {
  const parts = coefficientsIn(node, variable, 12);
  if (parts === undefined) return undefined;
  const out: Q.Rational[] = [];
  for (const part of parts) {
    const value = X.asRational(exactConstant(fold(part)) ?? []);
    if (value === undefined) return undefined;
    out.push(value);
  }
  while (out.length > 1 && Q.isZero(out[out.length - 1])) out.pop();
  return out;
}

/**
 * Whether a factor stays between two fixed numbers near the approach, however
 * its argument moves: sine and cosine of anything real, the arctangent, the
 * hyperbolic tangent, the sign. `sin(1/x)` has no limit at 0 and is still
 * between -1 and 1 there, which is all the squeeze theorem asks of it.
 */
export function isBounded(node: Node): boolean {
  if (node.type === "Negative") return isBounded(node.arg);
  if (node.type === "FunctionCall" && node.args.length === 1)
    return ["sin", "cos", "arctan", "tanh", "sign"].includes(
      node.callee.symbol
    );
  return false;
}

/**
 * A bounded factor times one that vanishes, or over one that runs off: the
 * squeeze theorem. `x sin(1/x) → 0` at 0 because `-|x| ≤ x sin(1/x) ≤ |x|`,
 * and `cos(x)/x → 0` at infinity the same way. Only reached when one side had
 * no limit, which is exactly when the product rule for limits says nothing.
 */
function squeezed(
  node: Node & { type: "BinaryOperator" },
  left: Limit | undefined,
  right: Limit | undefined,
  record: LimitRecorder
): Limit | undefined {
  const vanishes = (l: Limit | undefined) =>
    l?.kind === "finite" && l.value.length === 0;
  const product = node.name !== "Divide";
  const other = (side: Limit | undefined) =>
    product ? vanishes(side) : side?.kind === "infinite";
  if (left === undefined && isBounded(node.left) && other(right)) {
    record("squeeze");
    return { kind: "finite", value: X.ZERO };
  }
  if (
    product &&
    right === undefined &&
    isBounded(node.right) &&
    vanishes(left)
  ) {
    record("squeeze");
    return { kind: "finite", value: X.ZERO };
  }
  return undefined;
}

/**
 * Infinity minus infinity, when one term is bigger: `A - B = A(1 - B/A)`, and
 * if `B/A` has a limit `c` other than 1 the sum goes where `A` goes, scaled by
 * `1 - c`. `x - ln x → ∞` because `ln(x)/x → 0`.
 *
 * `c = 1` is left alone. `√(x²+x) - x` has `c = 1` and a finite limit that
 * the leading terms know nothing about; the series decides that one.
 */
function dominantTerm(
  node: Node & { type: "BinaryOperator" },
  variable: string,
  approach: Approach,
  record: LimitRecorder
): Limit | undefined {
  const flip = node.name === "Subtract" ? -1 : 1;
  const lead = limitOf(node.left, variable, approach, record);
  if (lead?.kind !== "infinite") return undefined;
  const ratio = limitOf(
    divide(node.right, node.left),
    variable,
    approach,
    record
  );
  if (ratio === undefined) return undefined;
  // (A ± B) = A(1 ± B/A).
  if (ratio.kind === "infinite") {
    // B is the bigger one, so the sum goes where ±B goes.
    const s = evaluate(node, { [variable]: near(approach) }) < 0 ? -1 : 1;
    record("dominant-term");
    return { kind: "infinite", sign: s };
  }
  const factor = X.add(
    X.fromInteger(1),
    flip === 1 ? ratio.value : X.negate(ratio.value)
  );
  if (factor.length === 0) return undefined;
  const size = X.toNumber(factor);
  if (!Number.isFinite(size) || size === 0) return undefined;
  record("dominant-term");
  return {
    kind: "infinite",
    sign: (lead.sign * Math.sign(size)) as 1 | -1,
  };
}

/**
 * The two indeterminate products every improper integral in a course meets,
 * resolved by growth rates rather than guessed:
 *
 * - at a finite point, a positive power of `(x - a)` beats any power of a
 *   logarithm: `x ln x → 0` as `x → 0⁺`;
 * - at infinity, `e^{-kx}` beats any power and any logarithm: `x² e^{-x} → 0`.
 *
 * Anything else stays undefined, and the integral is refused rather than
 * given a limit nobody derived.
 */
function dominated(
  node: Node,
  variable: string,
  approach: Approach,
  record: LimitRecorder
): Limit | undefined {
  // Infinity minus infinity: a sum whose terms run off in opposite directions
  // is genuinely indeterminate, and `ln x - ln(x+1)` at infinity is exactly the
  // kind a rule would get wrong. Only products are resolved here.
  if (
    node.type === "BinaryOperator" &&
    (node.name === "Add" || node.name === "Subtract")
  ) {
    return undefined;
  }
  const factors: { node: Node; inNumerator: boolean }[] = [];
  quotientFactors(node, true, factors);
  let vanishing = false;
  let onlyLogarithmsAbove = true;
  let powerBelow = false;
  let explodingAbove = false;
  let slowBelow = true;
  for (const { node: factor, inNumerator } of factors) {
    if (!dependsOn(factor, variable)) continue;
    const kind = growth(factor, variable, approach, record);
    if (kind === undefined) return undefined;
    if (kind === "exploding-exponential") {
      // Above the bar it wins against anything slower below it; below the
      // bar it is the same fight the other way up, and is not resolved here.
      if (!inNumerator) return undefined;
      explodingAbove = true;
      // Not a logarithm, so the ln(x)/x rule below must not see only
      // logarithms above the bar -- missing this answered e^x/x^10 with 0.
      onlyLogarithmsAbove = false;
      continue;
    }
    if (!inNumerator && kind !== "polynomial" && kind !== "logarithmic")
      slowBelow = false;
    if (inNumerator && kind !== "logarithmic") onlyLogarithmsAbove = false;
    if (!inNumerator && kind === "polynomial") powerBelow = true;
    if (inNumerator ? kind === "vanishing" : kind === "exploding-power") {
      vanishing = true;
      continue;
    }
    if (kind === "logarithmic" || kind === "polynomial") continue;
    return undefined;
  }
  // At infinity, any positive power beats any power of a logarithm:
  // `ln(x)/x → 0`, which is what `x^{1/x} → 1` comes down to.
  if (approach.kind === "infinite" && onlyLogarithmsAbove && powerBelow)
    vanishing = true;
  // And e^{g} with g → +∞ beats any power or logarithm: `e^x/x^10 → +∞`.
  if (explodingAbove && slowBelow && !vanishing) {
    const s = evaluate(node, { [variable]: near(approach, 1e-4) }) < 0 ? -1 : 1;
    record("growth");
    return { kind: "infinite", sign: s };
  }
  if (!vanishing) return undefined;
  record("growth");
  return { kind: "finite", value: X.ZERO };
}

type Growth =
  | "vanishing"
  | "logarithmic"
  | "polynomial"
  | "exploding-power"
  | "exploding-exponential";

function growth(
  factor: Node,
  variable: string,
  approach: Approach,
  record: LimitRecorder
): Growth | undefined {
  const isLog = (n: Node): boolean =>
    (n.type === "FunctionCall" && n.callee.symbol === "ln") ||
    (n.type === "BinaryOperator" && n.name === "Exponent" && isLog(n.left));
  if (isLog(factor)) {
    // A logarithm is slow only of something that grows like a power. ln(2^x)
    // is x ln 2, a power, and treating ln(1 + 2^x) as slow once answered
    // (1 + 2^x)^{1/x} at infinity with 1 instead of 2.
    let inside: Node = factor;
    while (inside.type === "BinaryOperator" && inside.name === "Exponent")
      inside = inside.left;
    if (inside.type !== "FunctionCall") return undefined;
    const kind = growth(inside.args[0], variable, approach, record);
    return kind === "polynomial" ||
      kind === "vanishing" ||
      kind === "exploding-power" ||
      kind === "logarithmic"
      ? "logarithmic"
      : undefined;
  }
  // A root is a power: √x is x^{1/2}, and ln(x)/√x is the ln(x)/x rule.
  if (factor.type === "FunctionCall" && factor.callee.symbol === "sqrt")
    return growth(
      power(factor.args[0], divide(numberNode(1), numberNode(2))),
      variable,
      approach,
      record
    );
  if (approach.kind === "point") {
    // (x - a)^k with k > 0 vanishes; the bare variable at zero is the case.
    const at = evaluate(factor, { [variable]: approach.value });
    const exponent =
      factor.type === "BinaryOperator" && factor.name === "Exponent"
        ? X.asRational(exactConstant(factor.right) ?? [])
        : Q.ONE;
    const base =
      factor.type === "BinaryOperator" && factor.name === "Exponent"
        ? factor.left
        : factor;
    if (exponent === undefined) return undefined;
    const baseAt = evaluate(base, { [variable]: approach.value });
    if (baseAt === 0 && coefficientsIn(base, variable, 1) !== undefined)
      return Q.isNegative(exponent) ? "exploding-power" : "vanishing";
    return Number.isFinite(at) && at !== 0 ? "polynomial" : undefined;
  }
  // At infinity: e^{g} with g → -∞ vanishes faster than anything else here.
  const exponent =
    factor.type === "BinaryOperator" &&
    factor.name === "Exponent" &&
    factor.left.type === "Identifier" &&
    factor.left.symbol === "e"
      ? factor.right
      : factor.type === "FunctionCall" && factor.callee.symbol === "exp"
        ? factor.args[0]
        : undefined;
  if (exponent !== undefined) {
    const inner = limitOf(exponent, variable, approach, record);
    if (inner?.kind !== "infinite") return undefined;
    return inner.sign < 0 ? "vanishing" : "exploding-exponential";
  }
  if (coefficientsIn(factor, variable, 12) !== undefined) return "polynomial";
  if (
    factor.type === "BinaryOperator" &&
    factor.name === "Exponent" &&
    coefficientsIn(factor.left, variable, 12) !== undefined
  )
    return "polynomial";
  return undefined;
}

// ---- checking ----------------------------------------------------------------

/**
 * `∫_a^b f`, numerically, by the tanh-sinh rule, or undefined if it will not
 * settle.
 *
 * Used only to check the exact answer, never as one. Tanh-sinh because its
 * nodes crowd toward the ends of the interval, which is exactly where an
 * improper integrand is difficult, and an infinite interval is mapped onto a
 * finite one first.
 */
export function quadrature(
  f: (x: number) => number,
  lower: number,
  upper: number
): number | undefined {
  let g = f;
  let a = lower;
  let b = upper;
  if (!Number.isFinite(lower) && !Number.isFinite(upper)) {
    const left = quadrature(f, -Infinity, 0);
    const right = quadrature(f, 0, Infinity);
    return left === undefined || right === undefined ? undefined : left + right;
  }
  if (!Number.isFinite(upper)) {
    // x = a + t/(1-t) on t in [0, 1).
    g = (t) => f(lower + t / (1 - t)) / ((1 - t) * (1 - t));
    a = 0;
    b = 1;
  } else if (!Number.isFinite(lower)) {
    g = (t) => f(upper - t / (1 - t)) / ((1 - t) * (1 - t));
    a = 0;
    b = 1;
  }
  const half = (b - a) / 2;
  const middle = (a + b) / 2;
  let previous: number | undefined;
  for (let level = 0; level <= 7; level += 1) {
    const h = Math.pow(2, -level);
    let total = 0;
    for (let k = -Math.ceil(4 / h); k <= Math.ceil(4 / h); k += 1) {
      const t = k * h;
      const u = (Math.PI / 2) * Math.sinh(t);
      const weight = ((Math.PI / 2) * Math.cosh(t)) / Math.pow(Math.cosh(u), 2);
      if (weight < 1e-300) continue;
      const x = middle + half * Math.tanh(u);
      if (x <= a || x >= b) continue;
      const y = g(x);
      if (!Number.isFinite(y)) continue;
      total += weight * y;
    }
    const estimate = total * h * half;
    if (
      previous !== undefined &&
      Math.abs(estimate - previous) <= 1e-10 * Math.max(1, Math.abs(estimate))
    ) {
      return estimate;
    }
    previous = estimate;
  }
  return undefined;
}

/** Points inside the interval where the integrand has no finite value. */
function interiorSingularity(
  f: (x: number) => number,
  lower: number,
  upper: number
): boolean {
  const map = (t: number) =>
    Number.isFinite(lower) && Number.isFinite(upper)
      ? lower + (upper - lower) * t
      : Number.isFinite(lower)
        ? lower + t / (1 - t)
        : Number.isFinite(upper)
          ? upper - t / (1 - t)
          : Math.tan(Math.PI * (t - 0.5));
  const count = 2000;
  let last = f(map(0.5 / count));
  for (let i = 1; i < count; i += 1) {
    const y = f(map((i + 0.5) / count));
    if (!Number.isFinite(y)) return true;
    // A sign change through an enormous value is a pole the grid stepped over.
    if (
      Math.abs(y) > 1e8 &&
      Math.abs(last) > 1e8 &&
      Math.sign(y) !== Math.sign(last)
    )
      return true;
    last = y;
  }
  return false;
}

// ---- the whole thing ---------------------------------------------------------

/**
 * `∫_lower^upper integrand d(variable)`, given an antiderivative already
 * checked against the integrand.
 */
export function definiteIntegral(
  integrand: Node,
  antiderivative: Node,
  variable: string,
  lower: Bound,
  upper: Bound
): DefiniteResult {
  // Names of functions being called are not parameters.
  const callees = new Set<string>();
  for (const tree of [integrand, antiderivative])
    visit(tree, (child) => {
      if (child.type === "FunctionCall") callees.add(child.callee.symbol);
    });
  const free = [
    ...identifiersIn(integrand),
    ...identifiersIn(antiderivative),
  ].filter(
    (name) =>
      name !== variable && name !== "e" && name !== "pi" && !callees.has(name)
  );
  if (free.length > 0) {
    throw new DefiniteError(
      `An exact value needs numbers, and ${free[0]} has none here.`
    );
  }
  const f = (x: number) => evaluate(integrand, { [variable]: x });
  const a = lower.kind === "finite" ? lower.value : lower.sign * Infinity;
  const b = upper.kind === "finite" ? upper.value : upper.sign * Infinity;
  if (a === b) return { exact: X.ZERO, value: 0, improper: false };
  if (a > b) {
    const swapped = definiteIntegral(
      integrand,
      antiderivative,
      variable,
      upper,
      lower
    );
    return {
      exact: swapped.exact === undefined ? undefined : X.negate(swapped.exact),
      value: -swapped.value,
      diverges:
        swapped.diverges === undefined || swapped.diverges === 0
          ? swapped.diverges
          : swapped.diverges === 1
            ? -1
            : 1,
      improper: swapped.improper,
    };
  }
  // Where the interval has to be cut: poles of the integrand, and points
  // where the antiderivative's formula jumps although the integrand does not.
  // Found exactly, so the one-sided limits below are taken at the right place;
  // a singularity the sampling sees and nothing here explains is refused.
  const breaks = breakPoints(integrand, antiderivative, variable, a, b);
  if (breaks === undefined) {
    throw new DefiniteError(
      "The integrand or its antiderivative has a break inside the interval that this cannot locate exactly, so it is not evaluated."
    );
  }
  const edges: Bound[] = [
    lower,
    ...breaks.map(
      (point): Bound => ({
        kind: "finite",
        node: point.node,
        value: point.value,
      })
    ),
    upper,
  ];
  const valueOf = (bound: Bound) =>
    bound.kind === "finite" ? bound.value : bound.sign * Infinity;
  for (let i = 0; i + 1 < edges.length; i += 1) {
    if (interiorSingularity(f, valueOf(edges[i]), valueOf(edges[i + 1]))) {
      throw new DefiniteError(
        "The integrand has no value somewhere inside the interval at a point this cannot locate exactly, so it is not evaluated."
      );
    }
  }

  let improper =
    breaks.length > 0 &&
    breaks.some((point) => !Number.isFinite(f(point.value)));
  const limitAt = (bound: Bound, side: 1 | -1): Limit | undefined => {
    if (bound.kind === "infinite") {
      improper = true;
      return limitOf(antiderivative, variable, {
        kind: "infinite",
        sign: bound.sign,
      });
    }
    if (!Number.isFinite(f(bound.value))) improper = true;
    return limitOf(antiderivative, variable, {
      kind: "point",
      node: bound.node,
      value: bound.value,
      side,
    });
  };

  // Each cell is lim F(right end, from the left) - lim F(left end, from the
  // right). A jump in the formula is crossed by this without being mistaken
  // for part of the integral; a pole makes one of the limits infinite.
  let exact: X.ExactValue = X.ZERO;
  const infinities: number[] = [];
  let numeric = 0;
  for (let i = 0; i + 1 < edges.length; i += 1) {
    const left = edges[i];
    const right = edges[i + 1];
    const top = limitAt(right, -1);
    const bottom = limitAt(left, 1);
    if (top === undefined || bottom === undefined) {
      throw new DefiniteError(
        "The antiderivative has no limit here that this can work out exactly."
      );
    }
    if (top.kind === "infinite") infinities.push(top.sign);
    if (bottom.kind === "infinite") infinities.push(-bottom.sign);
    if (top.kind === "finite" && bottom.kind === "finite") {
      exact = X.add(exact, X.subtract(top.value, bottom.value));
      const piece = quadrature(f, valueOf(left), valueOf(right));
      if (piece === undefined) {
        throw new DefiniteError(
          "The exact value could not be confirmed numerically, so it is not shown."
        );
      }
      numeric += piece;
    }
  }
  if (infinities.length > 0) {
    // An ordinary improper integral converges only if every piece does. One
    // that does not is the answer: it diverges, and with a sign only when
    // every infinity points the same way.
    const sign = infinities.every((s) => s === infinities[0])
      ? (infinities[0] as 1 | -1)
      : 0;
    return {
      value: sign === 0 ? NaN : sign * Infinity,
      diverges: sign,
      improper: true,
    };
  }

  const value = X.toNumber(exact);
  // The check that catches anything the exact reasoning missed: a jump not in
  // the list above would put the sum of the cells out by its size.
  if (Math.abs(numeric - value) > 1e-6 * Math.max(1, Math.abs(value))) {
    throw new DefiniteError(
      "The antiderivative found is not continuous across the whole interval — it jumps somewhere inside it that this could not locate — so F(b) − F(a) would be wrong, and it is not shown."
    );
  }
  return { exact, value, improper };
}

/** A point where the interval is cut, exactly and as a number. */
interface BreakPoint {
  node: Node;
  value: number;
}

/** How many break points are worth finding before the interval is too long. */
const MAX_BREAKS = 40;

/**
 * The points strictly inside (a, b) where the integrand or its antiderivative
 * breaks, in increasing order, or undefined if there are too many.
 *
 * - The poles of `tan`, `sec`, `cot` and `csc` of a linear argument, in either
 *   the integrand or the antiderivative: `tan(x/2)` from the half-angle
 *   substitution jumps at every odd multiple of π, and that is where
 *   `∫₀^{2π} dx/(2 + sin x)` has to be cut.
 * - The rational roots of the denominator of a rational integrand, found by
 *   factoring over Q.
 */
function breakPoints(
  integrand: Node,
  antiderivative: Node,
  variable: string,
  a: number,
  b: number
): BreakPoint[] | undefined {
  const found: { exact: X.ExactValue; value: number }[] = [];
  const consider = (exact: X.ExactValue) => {
    const value = X.toNumber(exact);
    if (!(value > a && value < b)) return;
    if (found.some((other) => Math.abs(other.value - value) < 1e-12)) return;
    found.push({ exact, value });
  };

  for (const tree of [integrand, antiderivative]) {
    let giveUp = false;
    visit(tree, (child) => {
      if (giveUp || child.type !== "FunctionCall" || child.args.length !== 1)
        return;
      const name = child.callee.symbol;
      // Where cos is zero for tan and sec, where sin is zero for cot and csc.
      const offset =
        name === "tan" || name === "sec"
          ? Q.rational(1n, 2n)
          : name === "cot" || name === "csc"
            ? Q.ZERO
            : undefined;
      if (offset === undefined) return;
      const linear = linearIn(child.args[0], variable);
      if (linear === undefined) return;
      const slope = X.asRational(exactConstant(linear.a) ?? []);
      const shift = exactConstant(linear.b);
      if (slope === undefined || Q.isZero(slope) || shift === undefined) {
        giveUp = true;
        return;
      }
      // u = slope·x + shift = π(offset + k), so x = (π(offset + k) - shift)/slope.
      const s = Q.toNumber(slope);
      const shiftValue = X.toNumber(shift);
      const u1 = s * a + shiftValue;
      const u2 = s * b + shiftValue;
      const low = Math.min(u1, u2);
      const high = Math.max(u1, u2);
      if (!Number.isFinite(low) || !Number.isFinite(high)) {
        giveUp = true;
        return;
      }
      const o = Q.toNumber(offset);
      const kFrom = Math.ceil(low / Math.PI - o) - 1;
      const kTo = Math.floor(high / Math.PI - o) + 1;
      if (kTo - kFrom > MAX_BREAKS) {
        giveUp = true;
        return;
      }
      for (let k = kFrom; k <= kTo; k += 1) {
        const angle = X.multiply(
          X.PI_VALUE,
          X.fromRational(Q.add(offset, Q.rational(BigInt(k))))
        );
        const x = X.divide(X.subtract(angle, shift), X.fromRational(slope));
        if (x !== undefined) consider(x);
      }
    });
    if (giveUp) {
      // A pole family over an infinite interval has infinitely many members;
      // the sampling below decides whether any of them matter.
      break;
    }
  }

  // Rational roots of a rational integrand's denominator.
  const ratio = asRatio(fold(integrand));
  const bottom = numericPolynomial(fold(ratio.denominator), variable);
  const top = numericPolynomial(fold(ratio.numerator), variable);
  if (bottom !== undefined && top !== undefined && bottom.length > 1) {
    const factors = factorOverQ(bottom);
    for (const factor of factors ?? []) {
      if (factor.length !== 2) continue;
      consider(X.fromRational(Q.negate(Q.divide(factor[0], factor[1]))));
    }
  }
  if (found.length > MAX_BREAKS) return undefined;
  return found
    .sort((p, q) => p.value - q.value)
    .map(({ exact, value }) => ({ node: X.toNode(exact), value }));
}
