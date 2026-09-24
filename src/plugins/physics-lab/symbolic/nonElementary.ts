/**
 * The integrals that have no elementary antiderivative, recognised by name.
 *
 * When every technique has failed, the integrator used to say why *it* had
 * failed — "a quotient with the variable above and below the line" — which is
 * a message about the matcher. For `e^x/x` the true answer to the question is
 * different and better: its antiderivative is the exponential integral `Ei`,
 * and no combination of powers, roots, exponentials, logarithms and
 * trigonometric functions differentiates to it. That is a theorem (Liouville's,
 * made effective by Risch), not a gap, and saying so is an answer.
 *
 * ## Conservative on purpose
 *
 * A claim of non-elementarity is a claim, and a wrong one is as bad as a wrong
 * antiderivative: it tells somebody to stop looking for an answer that exists.
 * So every shape here is one where the theorem is textbook, the conditions are
 * checked exactly (a linear argument really is linear, two roots really are
 * different), and anything near but not on a shape is left to the ordinary
 * refusal. It also only ever runs after the whole integrator has failed, so an
 * integrand that happens to match a shape and is elementary anyway — `e^x/x`
 * with the `x` cancelled, say — has already been answered before this looks.
 *
 * ## Sums
 *
 * An elementary function plus a non-elementary one is non-elementary, so a sum
 * with exactly one such term, every other term of which integrates, can be
 * named. Two non-elementary terms cannot: `e^x/x - e^x/x²` is the derivative
 * of `e^x/x`, and the two exponential integrals cancel.
 */
import {
  asRatio,
  constantValue,
  dependsOn,
  fold,
  quotientFactors,
  rationalOf,
  topLevelTerms,
  type Node,
} from "../../../symbolic";
import { coefficientsIn, linearIn } from "./integrate";
import * as Q from "./rational";

/** A non-elementary antiderivative, by the function it is written with. */
export interface NonElementary {
  /** The special function, as it is usually written: `Ei`, `\operatorname{Si}`. */
  name: string;
  /** The sentence the panel shows. */
  message: string;
}

const DESCRIPTION: Record<string, string> = {
  Ei: "the exponential integral Ei",
  li: "the logarithmic integral li",
  Si: "the sine integral Si",
  Ci: "the cosine integral Ci",
  Shi: "the hyperbolic sine integral Shi",
  Chi: "the hyperbolic cosine integral Chi",
  erf: "the error function erf",
  erfi: "the imaginary error function erfi",
  Fresnel: "the Fresnel integrals S and C",
  Li2: "the dilogarithm Li₂",
  elliptic: "an elliptic integral",
};

function named(name: string, what = "This integral"): NonElementary {
  if (name === "power tower") {
    return {
      name,
      message: `${what} has no antiderivative in elementary terms, and none in any standard named function either: x^x is not the derivative of anything a calculator has. It has no power series about zero either, because ln x does not.`,
    };
  }
  if (name === "liouville") {
    return {
      name,
      message: `${what} has no elementary antiderivative. If it had one, it would be y·e^g with y rational and y′ + g′y equal to the factor in front, and that equation has no rational solution — a complete search, not a missed rule (Liouville's theorem).`,
    };
  }
  if (name === "binomial") {
    return {
      name,
      message: `${what} has no elementary antiderivative. By Chebyshev's theorem, ∫x^m(a+bx^n)^p dx is elementary only when p, (m+1)/n or p+(m+1)/n is a whole number, and here none of them is. For a square root of a cubic or quartic like this one, the antiderivative is an elliptic integral.`,
    };
  }
  const verb =
    name === "Fresnel"
      ? "which are not elementary functions"
      : "which is not an elementary function";
  return {
    name,
    message: `${what} is written with ${DESCRIPTION[name]}, ${verb} — no combination of powers, roots, exponentials, logarithms and trigonometric functions differentiates to it. That is a theorem about the function, not a gap here.`,
  };
}

/**
 * The special function behind `node`, when it is one this can name with
 * certainty.
 *
 * `integrates` answers whether a term has an elementary antiderivative, and is
 * the integrator itself; it is passed in rather than imported so the two
 * files do not import each other at load time.
 */
export function nonElementary(
  node: Node,
  variable: string,
  integrates: (term: Node) => boolean
): NonElementary | undefined {
  const terms = topLevelTerms(node);
  if (terms.length === 1) return classifyTerm(node, variable);
  let found: NonElementary | undefined;
  for (const { term } of terms) {
    const which = classifyTerm(term, variable);
    if (which !== undefined) {
      // Two of them could cancel, so a second one ends the claim.
      if (found !== undefined) return undefined;
      found = which;
      continue;
    }
    if (!integrates(term)) return undefined;
  }
  return found === undefined
    ? undefined
    : {
        ...found,
        message: found.message.replace(
          /^This integral/,
          "One term of this integral"
        ),
      };
}

/** The message for a special function, by the name `nonElementary` uses. */
export function namedNonElementary(name: string): NonElementary {
  return named(name);
}

/**
 * A sentence for an integral that is *known* to have an elementary
 * antiderivative this cannot write, or undefined.
 *
 * Refusing one of these in the words used for a non-elementary integral would
 * be a false claim. Every rational function has an elementary antiderivative
 * -- `1/(x³+2)` does, in terms of ∛2 -- and so does every binomial
 * differential that Chebyshev's theorem allows.
 */
export function knownElementary(
  node: Node,
  variable: string
): string | undefined {
  const ratio = asRatio(fold(node));
  const top = coefficientsIn(fold(ratio.numerator), variable, 16);
  const bottom = coefficientsIn(fold(ratio.denominator), variable, 16);
  const numeric = (parts: Node[] | undefined) =>
    parts?.every((part) => constantValue(fold(part)) !== undefined) === true;
  if (numeric(top) && numeric(bottom)) {
    return "Every rational function has an elementary antiderivative, and this one does too — but its denominator does not factor into pieces this can write exactly: the factors it would need involve cube roots or worse. So it is refused rather than shown in an approximate form.";
  }
  const binomial = binomialParts(node, variable);
  if (binomial !== undefined && chebyshevElementary(binomial)) {
    return "By Chebyshev's theorem this binomial differential has an elementary antiderivative, found by a substitution that makes it rational — but this could not carry that substitution through, so it is refused rather than guessed.";
  }
  return undefined;
}

/** The integrand as a constant times variable-carrying factors. */
function factorsOf(node: Node, variable: string) {
  const all: { node: Node; inNumerator: boolean }[] = [];
  quotientFactors(node, true, all);
  return all.filter((factor) => dependsOn(factor.node, variable));
}

/** `ax + b` with a numeric, non-zero slope. */
function isLinear(node: Node, variable: string) {
  const linear = linearIn(node, variable);
  if (linear === undefined) return false;
  const slope = constantValue(fold(linear.a));
  return slope !== undefined ? slope !== 0 : dependsOn(node, variable);
}

/** A quadratic with a non-zero square term, as its three coefficients. */
function quadratic(node: Node, variable: string): number[] | undefined {
  const parts = coefficientsIn(node, variable, 2);
  if (parts === undefined || parts.length !== 3) return undefined;
  const values = parts.map((part) => constantValue(fold(part)));
  if (values.some((value) => value === undefined)) return undefined;
  return values[2] === 0 ? undefined : (values as number[]);
}

/** The exponent of `e^{...}` or `exp(...)`. */
function exponentOf(node: Node): Node | undefined {
  if (
    node.type === "BinaryOperator" &&
    node.name === "Exponent" &&
    node.left.type === "Identifier" &&
    node.left.symbol === "e"
  ) {
    return node.right;
  }
  if (
    node.type === "FunctionCall" &&
    node.callee.symbol === "exp" &&
    node.args.length === 1
  ) {
    return node.args[0];
  }
  return undefined;
}

/** `(linear)^k` for a whole `k >= 1`, as `k`; the bare variable is `k = 1`. */
function linearPower(node: Node, variable: string): number | undefined {
  if (isLinear(node, variable)) return 1;
  if (node.type !== "BinaryOperator" || node.name !== "Exponent")
    return undefined;
  const k = constantValue(fold(node.right));
  if (k === undefined || !Number.isInteger(k) || k < 1) return undefined;
  return isLinear(node.left, variable) ? k : undefined;
}

/** `x^m` for a whole `m >= 0`, as `m`. */
function monomialPower(node: Node, variable: string): number | undefined {
  if (node.type === "Identifier" && node.symbol === variable) return 1;
  if (
    node.type === "BinaryOperator" &&
    node.name === "Exponent" &&
    node.left.type === "Identifier" &&
    node.left.symbol === variable
  ) {
    const m = constantValue(fold(node.right));
    return m !== undefined && Number.isInteger(m) && m >= 0 ? m : undefined;
  }
  return undefined;
}

function classifyTerm(node: Node, variable: string): NonElementary | undefined {
  const factors = factorsOf(fold(node), variable);
  if (factors.length === 0) return undefined;

  // x^x, alone.
  if (factors.length === 1 && factors[0].inNumerator) {
    const [{ node: only }] = factors;
    if (
      only.type === "BinaryOperator" &&
      only.name === "Exponent" &&
      only.left.type === "Identifier" &&
      only.left.symbol === variable &&
      only.right.type === "Identifier" &&
      only.right.symbol === variable
    ) {
      return named("power tower");
    }
  }

  return (
    exponentialOverLinear(factors, variable) ??
    waveOverLinear(factors, variable) ??
    reciprocalLogarithm(factors, variable) ??
    gaussian(factors, variable) ??
    fresnel(factors, variable) ??
    dilogarithm(factors, variable) ??
    binomialDifferential(factors, variable)
  );
}

type Factors = { node: Node; inNumerator: boolean }[];

/** `e^{L} / M^k`: the exponential integral, whatever the shift. */
function exponentialOverLinear(factors: Factors, variable: string) {
  if (factors.length !== 2) return undefined;
  const top = factors.find((factor) => factor.inNumerator);
  const bottom = factors.find((factor) => !factor.inNumerator);
  if (top === undefined || bottom === undefined) return undefined;
  const exponent = exponentOf(top.node);
  if (exponent === undefined || !isLinear(exponent, variable)) return undefined;
  if (linearPower(bottom.node, variable) === undefined) return undefined;
  return named("Ei");
}

/** `sin(L) / M^k` and its three relatives. */
function waveOverLinear(factors: Factors, variable: string) {
  if (factors.length !== 2) return undefined;
  const top = factors.find((factor) => factor.inNumerator);
  const bottom = factors.find((factor) => !factor.inNumerator);
  if (top === undefined || bottom === undefined) return undefined;
  const wave = top.node;
  if (wave.type !== "FunctionCall" || wave.args.length !== 1) return undefined;
  const which: Record<string, string> = {
    sin: "Si",
    cos: "Ci",
    sinh: "Shi",
    cosh: "Chi",
  };
  const name = which[wave.callee.symbol];
  if (name === undefined || !isLinear(wave.args[0], variable)) return undefined;
  if (linearPower(bottom.node, variable) === undefined) return undefined;
  return named(name);
}

/** `x^m / ln(L)` for `m >= 0`: the logarithmic integral. */
function reciprocalLogarithm(factors: Factors, variable: string) {
  const bottom = factors.filter((factor) => !factor.inNumerator);
  const top = factors.filter((factor) => factor.inNumerator);
  if (bottom.length !== 1 || top.length > 1) return undefined;
  const log = bottom[0].node;
  if (
    log.type !== "FunctionCall" ||
    log.callee.symbol !== "ln" ||
    log.args.length !== 1
  ) {
    return undefined;
  }
  const [inside] = log.args;
  // Only ln(x) with a monomial above, or ln(L) with nothing above: `x/ln(x+1)`
  // is non-elementary too, but the argument for it is longer than this check.
  if (top.length === 1) {
    if (inside.type !== "Identifier" || inside.symbol !== variable)
      return undefined;
    if (monomialPower(top[0].node, variable) === undefined) return undefined;
    return named("li");
  }
  return isLinear(inside, variable) ? named("li") : undefined;
}

/** `x^{2k} e^{Q}` with Q a genuine quadratic: the error function. */
function gaussian(factors: Factors, variable: string) {
  let sign: number | undefined;
  for (const factor of factors) {
    if (!factor.inNumerator) return undefined;
    const exponent = exponentOf(factor.node);
    if (exponent !== undefined) {
      if (sign !== undefined) return undefined;
      const q = quadratic(exponent, variable);
      if (q === undefined) return undefined;
      sign = Math.sign(q[2]);
      continue;
    }
    const m = monomialPower(factor.node, variable);
    // An odd power is a substitution away from elementary: x e^{-x^2}.
    if (m === undefined || m % 2 !== 0) return undefined;
  }
  if (sign === undefined) return undefined;
  return named(sign < 0 ? "erf" : "erfi");
}

/** `x^{2k} sin(Q)` or `cos(Q)`: the Fresnel integrals. */
function fresnel(factors: Factors, variable: string) {
  let found = false;
  for (const factor of factors) {
    if (!factor.inNumerator) return undefined;
    const { node } = factor;
    if (
      node.type === "FunctionCall" &&
      (node.callee.symbol === "sin" || node.callee.symbol === "cos") &&
      node.args.length === 1
    ) {
      if (found || quadratic(node.args[0], variable) === undefined)
        return undefined;
      found = true;
      continue;
    }
    const m = monomialPower(node, variable);
    if (m === undefined || m % 2 !== 0) return undefined;
  }
  return found ? named("Fresnel") : undefined;
}

/**
 * The dilogarithm, in its three commonest disguises:
 *
 * - `ln(L₁)/L₂` with the two roots different — `ln(x)/(x+1)`, `ln(1+x)/x`;
 * - `x/(e^{L} + c)` with `c ≠ 0` — the Fermi–Dirac integral `x/(e^x+1)`;
 * - `arctan(L)^2`, whose middle step is `∫θ tan θ dθ`.
 */
function dilogarithm(factors: Factors, variable: string) {
  const top = factors.filter((factor) => factor.inNumerator);
  const bottom = factors.filter((factor) => !factor.inNumerator);

  if (top.length === 1 && bottom.length === 1) {
    const log = top[0].node;
    if (
      log.type === "FunctionCall" &&
      log.callee.symbol === "ln" &&
      log.args.length === 1
    ) {
      const inner = linearIn(log.args[0], variable);
      const outer = linearIn(bottom[0].node, variable);
      if (inner !== undefined && outer !== undefined) {
        const a1 = constantValue(fold(inner.a));
        const b1 = constantValue(fold(inner.b));
        const a2 = constantValue(fold(outer.a));
        const b2 = constantValue(fold(outer.b));
        if (
          a1 !== undefined &&
          b1 !== undefined &&
          a2 !== undefined &&
          b2 !== undefined &&
          a1 !== 0 &&
          a2 !== 0 &&
          // Different roots. The same root is `ln(L)/L`, which is elementary.
          Math.abs(a1 * b2 - a2 * b1) > 1e-12
        ) {
          return named("Li2");
        }
      }
    }
    // x/(e^{L} + c).
    const m = monomialPower(top[0].node, variable);
    const sum = bottom[0].node;
    if (
      m !== undefined &&
      m >= 1 &&
      sum.type === "BinaryOperator" &&
      (sum.name === "Add" || sum.name === "Subtract")
    ) {
      const [expPart, constPart] = dependsOn(sum.left, variable)
        ? [sum.left, sum.right]
        : [sum.right, sum.left];
      const exponent = exponentOf(expPart);
      const c = constantValue(fold(constPart));
      if (
        exponent !== undefined &&
        isLinear(exponent, variable) &&
        c !== undefined &&
        c !== 0
      ) {
        return named("Li2");
      }
    }
  }

  if (top.length === 1 && bottom.length === 0) {
    const [{ node }] = top;
    if (
      node.type === "BinaryOperator" &&
      node.name === "Exponent" &&
      constantValue(fold(node.right)) === 2 &&
      node.left.type === "FunctionCall" &&
      node.left.callee.symbol === "arctan" &&
      node.left.args.length === 1 &&
      isLinear(node.left.args[0], variable)
    ) {
      return named("Li2");
    }
  }
  return undefined;
}

/**
 * `x^m (a + b x^n)^p`, read off the factors, with m, n, p exact rationals.
 *
 * Chebyshev's theorem on binomial differentials (1853) is an *if and only
 * if*: for rational m, n, p with n ≠ 0 and non-zero a, b, the integral is
 * elementary exactly when one of `p`, `(m+1)/n`, `p + (m+1)/n` is an integer.
 * That makes it the right test for a root of a cubic, where a claim from the
 * degree alone would be wrong: `3x²/√(1+x³)` is `(1+x³)^{-1/2}` against
 * `x²`, `(m+1)/n = 1`, and its antiderivative is `2√(1+x³)`.
 */
export function binomialParts(
  node: Node,
  variable: string
): { m: Q.Rational; n: Q.Rational; p: Q.Rational } | undefined {
  const all: { node: Node; inNumerator: boolean }[] = [];
  quotientFactors(fold(node), true, all);
  return readBinomial(
    all.filter((factor) => dependsOn(factor.node, variable)),
    variable
  );
}

function exactRational(node: Node): Q.Rational | undefined {
  const r = rationalOf(fold(node));
  return r === undefined ? undefined : Q.rational(BigInt(r.n), BigInt(r.d));
}

function readBinomial(factors: Factors, variable: string) {
  let m = Q.ZERO;
  let found: { n: Q.Rational; p: Q.Rational } | undefined;
  for (const { node, inNumerator } of factors) {
    const sign = inNumerator ? Q.ONE : Q.rational(-1n);
    // x or x^k.
    if (node.type === "Identifier" && node.symbol === variable) {
      m = Q.add(m, sign);
      continue;
    }
    let base = node;
    let exponent = Q.ONE;
    if (node.type === "FunctionCall" && node.callee.symbol === "sqrt") {
      if (node.args.length !== 1) return undefined;
      [base] = node.args;
      exponent = Q.rational(1n, 2n);
    } else if (node.type === "BinaryOperator" && node.name === "Exponent") {
      const e = exactRational(node.right);
      if (e === undefined) return undefined;
      base = node.left;
      exponent = e;
    }
    if (base.type === "Identifier" && base.symbol === variable) {
      m = Q.add(m, Q.multiply(sign, exponent));
      continue;
    }
    if (found !== undefined) return undefined;
    const n = binomialPower(base, variable);
    if (n === undefined) return undefined;
    found = { n, p: Q.multiply(sign, exponent) };
  }
  if (found === undefined) return undefined;
  return { m, ...found };
}

/** `a + b x^n` with a, b non-zero constants, as n. */
function binomialPower(base: Node, variable: string): Q.Rational | undefined {
  const terms = topLevelTerms(base);
  if (terms.length !== 2) return undefined;
  const constant = terms.filter(({ term }) => !dependsOn(term, variable));
  const varying = terms.filter(({ term }) => dependsOn(term, variable));
  if (constant.length !== 1 || varying.length !== 1) return undefined;
  if (constantValue(fold(constant[0].term)) === 0) return undefined;
  const factors: { node: Node; inNumerator: boolean }[] = [];
  quotientFactors(varying[0].term, true, factors);
  let n: Q.Rational | undefined;
  for (const { node, inNumerator } of factors) {
    if (!dependsOn(node, variable)) continue;
    if (n !== undefined) return undefined;
    let power: Q.Rational | undefined;
    if (node.type === "Identifier" && node.symbol === variable) power = Q.ONE;
    else if (
      node.type === "BinaryOperator" &&
      node.name === "Exponent" &&
      node.left.type === "Identifier" &&
      node.left.symbol === variable
    )
      power = exactRational(node.right);
    if (power === undefined) return undefined;
    n = inNumerator ? power : Q.negate(power);
  }
  return n === undefined || Q.isZero(n) ? undefined : n;
}

/** Whether Chebyshev's theorem says the binomial differential is elementary. */
export function chebyshevElementary(parts: {
  m: Q.Rational;
  n: Q.Rational;
  p: Q.Rational;
}): boolean {
  const { m, n, p } = parts;
  const k = Q.divide(Q.add(m, Q.ONE), n);
  return Q.isInteger(p) || Q.isInteger(k) || Q.isInteger(Q.add(p, k));
}

/** The binomial differential's verdict, when this integrand is one. */
function binomialDifferential(factors: Factors, variable: string) {
  const parts = readBinomial(factors, variable);
  if (parts === undefined) return undefined;
  return chebyshevElementary(parts) ? undefined : named("binomial");
}
