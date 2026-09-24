/**
 * `∫ f(x) e^{g(x)} dx` for rational `f` and polynomial `g`, decided.
 *
 * Liouville's theorem says that if this has an elementary antiderivative at
 * all, it has one of the form `y(x) e^{g(x)}` with `y` rational — and
 * differentiating that, `y` must satisfy
 *
 *     y' + g'y = f.
 *
 * So the question "is this elementary?" becomes "does this equation have a
 * rational solution?", and for polynomial `g` that is a finite search:
 *
 * - **Poles.** `g'` is a polynomial, so it has no poles, and a pole of `y` of
 *   order `k` makes a pole of `y'` of order `k + 1` that nothing can cancel.
 *   So `y` can only have poles where `f` does, one order lower. With Yun's
 *   squarefree layers `B = ∏ Bₖ^k` of `f`'s denominator, the denominator of `y`
 *   divides `D = ∏ Bₖ^{k-1}` — no factoring needed.
 * - **Degree.** `g'` has degree `m = deg g - 1 ≥ 0` and leads everything at
 *   infinity: `y' + g'y` has degree exactly `deg y + m`. So the numerator's
 *   degree is forced, and the unknowns are finitely many.
 * - **Solve.** The coefficients satisfy a linear system over Q, and either it
 *   has a solution or it does not.
 *
 * A solution is an antiderivative — `∫(e^x/x - e^x/x²)dx = e^x/x`, which the
 * rest of the integrator refused because each term alone is non-elementary.
 * No solution is a **proof** that none exists: `e^x/x` and `e^{x²}` are
 * non-elementary because this search was exhaustive, not because a rule
 * failed to match.
 *
 * Scope, stated exactly: `g` a polynomial of degree at least 1 with rational
 * coefficients; `f` rational with rational coefficients; one exponential,
 * shared by every term. Anything else is not this module's to decide.
 */
import {
  add,
  asRatio,
  constantValue,
  dependsOn,
  divide,
  fold,
  id,
  multiply,
  number,
  power,
  quotientFactors,
  sameTree,
  subtract,
  topLevelTerms,
  type Node,
} from "../../../symbolic";
import * as Q from "./rational";
import { squarefree, type QPoly } from "./factor";
import { coefficientsIn } from "./integrate";
import { rationalNode } from "./field";

export type ExpRationalResult =
  | { kind: "integrated"; value: Node }
  | {
      kind: "non-elementary";
      degree: number;
      hasPoles: boolean;
      /** Sign of g's leading coefficient: a Gaussian that grows or decays. */
      grows: boolean;
    };

/** Degree cap on everything, so the linear system stays small. */
const MAX_DEGREE = 16;

function trim(p: QPoly): QPoly {
  const out = [...p];
  while (out.length > 1 && Q.isZero(out[out.length - 1])) out.pop();
  return out.length === 0 ? [Q.ZERO] : out;
}
const degree = (p: QPoly) => {
  const t = trim(p);
  return t.length === 1 && Q.isZero(t[0]) ? -Infinity : t.length - 1;
};
function mul(a: QPoly, b: QPoly): QPoly {
  const out = new Array<Q.Rational>(a.length + b.length - 1).fill(Q.ZERO);
  for (let i = 0; i < a.length; i += 1)
    for (let j = 0; j < b.length; j += 1)
      out[i + j] = Q.add(out[i + j], Q.multiply(a[i], b[j]));
  return trim(out);
}
function addP(a: QPoly, b: QPoly, sign = 1): QPoly {
  const out: QPoly = [];
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const right = b[i] ?? Q.ZERO;
    out.push(Q.add(a[i] ?? Q.ZERO, sign < 0 ? Q.negate(right) : right));
  }
  return trim(out);
}
function derivative(p: QPoly): QPoly {
  const out = p
    .slice(1)
    .map((c, i) => Q.multiply(c, Q.rational(BigInt(i + 1))));
  return out.length === 0 ? [Q.ZERO] : trim(out);
}
function powP(p: QPoly, k: number): QPoly {
  let out: QPoly = [Q.ONE];
  for (let i = 0; i < k; i += 1) out = mul(out, p);
  return out;
}

/** A node as a polynomial with rational coefficients, or undefined. */
function asQPoly(node: Node, variable: string): QPoly | undefined {
  const parts = coefficientsIn(node, variable, MAX_DEGREE);
  if (parts === undefined) return undefined;
  const out: QPoly = [];
  for (const part of parts) {
    const value = constantValue(fold(part));
    if (value === undefined) return undefined;
    const exact = Q.fromNumber(value);
    if (exact === undefined) return undefined;
    out.push(exact);
  }
  return trim(out);
}

/** The exponent of `e^{...}` or `exp(...)`. */
function exponentOf(node: Node): Node | undefined {
  if (
    node.type === "BinaryOperator" &&
    node.name === "Exponent" &&
    node.left.type === "Identifier" &&
    node.left.symbol === "e"
  )
    return node.right;
  if (
    node.type === "FunctionCall" &&
    node.callee.symbol === "exp" &&
    node.args.length === 1
  )
    return node.args[0];
  return undefined;
}

/**
 * The integrand as `f · e^g`, or undefined if it is not one: every term must
 * carry the same exponential exactly once, and what is left must be rational.
 */
function split(
  node: Node,
  variable: string
): { f: Node; exponential: Node; g: Node } | undefined {
  let exponential: Node | undefined;
  let g: Node | undefined;
  const rests: { value: Node; negated: boolean }[] = [];
  for (const { term, negated } of topLevelTerms(node)) {
    const factors: { node: Node; inNumerator: boolean }[] = [];
    quotientFactors(term, true, factors);
    let found = -1;
    factors.forEach((factor, index) => {
      if (!factor.inNumerator) return;
      const exponent = exponentOf(factor.node);
      if (exponent === undefined || !dependsOn(exponent, variable)) return;
      if (found >= 0) found = -2;
      else found = index;
    });
    if (found < 0) return undefined;
    const exponent = exponentOf(factors[found].node);
    if (exponent === undefined) return undefined;
    if (g === undefined) {
      g = fold(exponent);
      exponential = factors[found].node;
    } else if (!sameTree(fold(exponent), g)) {
      return undefined;
    }
    const rest = factors.reduce<Node>(
      (product, factor, index) =>
        index === found
          ? product
          : factor.inNumerator
            ? multiply(product, factor.node)
            : divide(product, factor.node),
      number(1)
    );
    rests.push({ value: rest, negated });
  }
  if (g === undefined || exponential === undefined) return undefined;
  const f = rests.reduce<Node>(
    (sum, { value, negated }) =>
      negated ? subtract(sum, value) : add(sum, value),
    number(0)
  );
  return { f: fold(f), exponential, g };
}

/** Gaussian elimination over Q for an overdetermined system; undefined if inconsistent. */
function solveLinear(
  rows: Q.Rational[][],
  unknowns: number
): Q.Rational[] | undefined {
  const m = rows.map((row) => [...row]);
  let r = 0;
  const pivotColumn: number[] = [];
  for (let c = 0; c < unknowns && r < m.length; c += 1) {
    const p = m.findIndex((row, i) => i >= r && !Q.isZero(row[c]));
    if (p < 0) continue;
    [m[r], m[p]] = [m[p], m[r]];
    const lead = m[r][c];
    m[r] = m[r].map((v) => Q.divide(v, lead));
    for (let i = 0; i < m.length; i += 1) {
      if (i === r || Q.isZero(m[i][c])) continue;
      const factor = m[i][c];
      m[i] = m[i].map((v, j) => Q.subtract(v, Q.multiply(factor, m[r][j])));
    }
    pivotColumn.push(c);
    r += 1;
  }
  // Inconsistent if a zero row has a non-zero right-hand side.
  for (let i = r; i < m.length; i += 1)
    if (!Q.isZero(m[i][unknowns])) return undefined;
  const solution = new Array<Q.Rational>(unknowns).fill(Q.ZERO);
  pivotColumn.forEach((c, i) => (solution[c] = m[i][unknowns]));
  return solution;
}

/** A polynomial back as a node, highest power first. */
export function polyNode(p: QPoly, variable: string): Node {
  let total: Node | undefined;
  for (let k = p.length - 1; k >= 0; k -= 1) {
    const c = p[k];
    if (Q.isZero(c)) continue;
    const magnitude = Q.isNegative(c) ? Q.negate(c) : c;
    const monomial =
      k === 0
        ? rationalNode(magnitude)
        : Q.isOne(magnitude)
          ? k === 1
            ? id(variable)
            : power(id(variable), number(k))
          : multiply(
              rationalNode(magnitude),
              k === 1 ? id(variable) : power(id(variable), number(k))
            );
    total =
      total === undefined
        ? Q.isNegative(c)
          ? { type: "Negative", arg: monomial }
          : monomial
        : Q.isNegative(c)
          ? subtract(total, monomial)
          : add(total, monomial);
  }
  return total ?? number(0);
}

/**
 * Decides `∫ f e^g` for rational `f` and polynomial `g`, or undefined when the
 * integrand is not of that form.
 */
export function integrateExpRational(
  node: Node,
  variable: string
): ExpRationalResult | undefined {
  const parts = split(node, variable);
  if (parts === undefined) return undefined;
  const g = asQPoly(parts.g, variable);
  if (g === undefined || degree(g) < 1) return undefined;
  const ratio = asRatio(parts.f);
  const A = asQPoly(fold(ratio.numerator), variable);
  const B = asQPoly(fold(ratio.denominator), variable);
  if (A === undefined || B === undefined || degree(B) < 0) return undefined;
  if (degree(A) < 0) return undefined;

  const gPrime = derivative(g);
  const m = degree(gPrime);
  // D = ∏ layer_k^{k-1}: where y's poles can be, and how high.
  let D: QPoly = [Q.ONE];
  const layers = degree(B) >= 1 ? squarefree(B) : [];
  for (const [layer, k] of layers) D = mul(D, powP(layer, k - 1));
  const hasPoles = layers.length > 0;

  const fDegree = degree(A) - degree(B);
  const yDegree = fDegree - m;
  const nDegree = yDegree + degree(D);
  if (nDegree < 0 || nDegree > MAX_DEGREE) {
    return nDegree < 0
      ? {
          kind: "non-elementary",
          degree: degree(g),
          hasPoles,
          grows: !Q.isNegative(g[g.length - 1]),
        }
      : undefined;
  }

  // B (N'D - N D' + g' N D) = A D², one column per coefficient of N.
  const Dp = derivative(D);
  const columns: QPoly[] = [];
  for (let j = 0; j <= nDegree; j += 1) {
    const xj: QPoly = [...new Array<Q.Rational>(j).fill(Q.ZERO), Q.ONE];
    const term = addP(
      addP(mul(derivative(xj), D), mul(xj, Dp), -1),
      mul(mul(gPrime, xj), D)
    );
    columns.push(mul(B, term));
  }
  const rhs = mul(A, mul(D, D));
  const height = Math.max(rhs.length, ...columns.map((c) => c.length));
  const rows: Q.Rational[][] = [];
  for (let i = 0; i < height; i += 1)
    rows.push([...columns.map((c) => c[i] ?? Q.ZERO), rhs[i] ?? Q.ZERO]);
  const N = solveLinear(rows, nDegree + 1);
  if (N === undefined) {
    return {
      kind: "non-elementary",
      degree: degree(g),
      hasPoles,
      grows: !Q.isNegative(g[g.length - 1]),
    };
  }

  const numerator = polyNode(trim(N), variable);
  // A single term goes in front -- `x e^{x^2}` -- and a sum behind, so it
  // reads `e^x (x - 1)` rather than as a bracket with an exponential trailing.
  const single = trim(N).filter((c) => !Q.isZero(c)).length <= 1;
  const value =
    degree(D) === 0
      ? single
        ? multiply(numerator, parts.exponential)
        : multiply(parts.exponential, numerator)
      : divide(multiply(parts.exponential, numerator), polyNode(D, variable));
  return { kind: "integrated", value: fold(value) };
}
