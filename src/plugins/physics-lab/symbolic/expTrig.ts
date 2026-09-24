/**
 * `∫ P(x) e^{ax} cos(bx) dx` and its sine twin, in the form a textbook prints:
 *
 *     e^{ax} (U(x) cos bx + V(x) sin bx)
 *
 * with `U` and `V` polynomials of the same degree as `P`. Differentiating that
 * and matching the cosine and sine parts gives two coupled equations,
 *
 *     U' + aU + bV = P        V' + aV - bU = 0        (for a cosine)
 *
 * which are a square linear system for the coefficients — `2(deg P + 1)`
 * unknowns and as many equations — with a unique solution whenever `a² + b²`
 * is not zero. That is the whole method: no integration by parts at all, and
 * the answer comes out already factored.
 *
 * Tabular integration reached the same functions and printed `x⁵e^{3x}cos 2x`
 * as a long nest of products; the research brief's suggestion was to treat
 * `e^{ax}cos bx` and `e^{ax}sin bx` as a basis and solve for the coefficients
 * directly, which is this.
 */
import {
  add,
  dependsOn,
  divide,
  fold,
  multiply,
  number,
  quotientFactors,
  rationalOf,
  subtract,
  type Node,
} from "../../../symbolic";
import * as Q from "./rational";
import { coefficientsIn, linearIn } from "./integrate";
import { polyNode } from "./expRational";

type QPoly = Q.Rational[];

const MAX_DEGREE = 10;

/** A constant node as an exact rational, when it is one. */
function exactOf(node: Node): Q.Rational | undefined {
  const value = fold(node);
  const r = rationalOf(value);
  if (r !== undefined) return Q.rational(BigInt(r.n), BigInt(r.d));
  return value.type === "Constant" ? Q.fromNumber(value.value) : undefined;
}

/** Solves a square system over Q; undefined if singular. */
function solveSquare(matrix: Q.Rational[][]): Q.Rational[] | undefined {
  const n = matrix.length;
  const m = matrix.map((row) => [...row]);
  for (let c = 0; c < n; c += 1) {
    const p = m.findIndex((row, i) => i >= c && !Q.isZero(row[c]));
    if (p < 0) return undefined;
    [m[c], m[p]] = [m[p], m[c]];
    const lead = m[c][c];
    m[c] = m[c].map((v) => Q.divide(v, lead));
    for (let i = 0; i < n; i += 1) {
      if (i === c || Q.isZero(m[i][c])) continue;
      const factor = m[i][c];
      m[i] = m[i].map((v, j) => Q.subtract(v, Q.multiply(factor, m[c][j])));
    }
  }
  return m.map((row) => row[n]);
}

/**
 * The antiderivative in `e^{ax}(U cos bx + V sin bx)` form, or undefined when
 * the integrand is not a non-constant polynomial times one exponential and one
 * sine or cosine, all of linear arguments with rational slopes.
 */
export function expTrigPolynomial(
  node: Node,
  variable: string
): Node | undefined {
  const factors: { node: Node; inNumerator: boolean }[] = [];
  quotientFactors(node, true, factors);
  let exponential: Node | undefined;
  let a: Q.Rational | undefined;
  let wave: { name: "sin" | "cos"; argument: Node; b: Q.Rational } | undefined;
  let polynomial: Node = number(1);
  for (const { node: factor, inNumerator } of factors) {
    if (!dependsOn(factor, variable)) {
      polynomial = inNumerator
        ? multiply(polynomial, factor)
        : divide(polynomial, factor);
      continue;
    }
    if (!inNumerator) return undefined;
    const exponent =
      factor.type === "BinaryOperator" &&
      factor.name === "Exponent" &&
      factor.left.type === "Identifier" &&
      factor.left.symbol === "e"
        ? factor.right
        : factor.type === "FunctionCall" &&
            factor.callee.symbol === "exp" &&
            factor.args.length === 1
          ? factor.args[0]
          : undefined;
    if (exponent !== undefined) {
      if (exponential !== undefined) return undefined;
      const linear = linearIn(exponent, variable);
      const slope = linear === undefined ? undefined : exactOf(linear.a);
      if (slope === undefined || Q.isZero(slope)) return undefined;
      exponential = factor;
      a = slope;
      continue;
    }
    if (
      factor.type === "FunctionCall" &&
      (factor.callee.symbol === "sin" || factor.callee.symbol === "cos") &&
      factor.args.length === 1
    ) {
      if (wave !== undefined) return undefined;
      const linear = linearIn(factor.args[0], variable);
      const slope = linear === undefined ? undefined : exactOf(linear.a);
      if (slope === undefined || Q.isZero(slope)) return undefined;
      wave = { name: factor.callee.symbol, argument: factor.args[0], b: slope };
      continue;
    }
    polynomial = multiply(polynomial, factor);
  }
  if (exponential === undefined || a === undefined || wave === undefined)
    return undefined;

  const parts = coefficientsIn(fold(polynomial), variable, MAX_DEGREE);
  if (parts === undefined) return undefined;
  const P: QPoly = [];
  for (const part of parts) {
    const value = exactOf(part);
    if (value === undefined) return undefined;
    P.push(value);
  }
  while (P.length > 1 && Q.isZero(P[P.length - 1])) P.pop();
  // A constant P is the cyclic pair, which has its own rule and form.
  if (P.length < 2) return undefined;

  // Unknowns: U_0..U_d, V_0..V_d. Row k of the first equation is the x^k
  // coefficient of U' + aU + bV - P; of the second, of V' + aV - bU - 0.
  const d = P.length - 1;
  const size = 2 * (d + 1);
  const { b } = wave;
  const rows: Q.Rational[][] = [];
  const cosine = wave.name === "cos";
  for (let equation = 0; equation < 2; equation += 1) {
    for (let k = 0; k <= d; k += 1) {
      const row = new Array<Q.Rational>(size + 1).fill(Q.ZERO);
      const own = equation === 0 ? 0 : d + 1; // U for the first, V for the second
      const other = equation === 0 ? d + 1 : 0;
      // (own)' contributes (k+1)·own_{k+1}; a·own_k; ±b·other_k.
      if (k + 1 <= d) row[own + k + 1] = Q.rational(BigInt(k + 1));
      row[own + k] = Q.add(row[own + k], a);
      row[other + k] = Q.add(row[other + k], equation === 0 ? b : Q.negate(b));
      const target = (equation === 0) === cosine ? (P[k] ?? Q.ZERO) : Q.ZERO;
      row[size] = target;
      rows.push(row);
    }
  }
  const solution = solveSquare(rows);
  if (solution === undefined) return undefined;
  const U = solution.slice(0, d + 1);
  const V = solution.slice(d + 1);

  // One denominator under the whole thing, the way it is printed.
  let common = 1n;
  for (const c of [...U, ...V]) common = (common / gcd(common, c.d)) * c.d;
  const scale = Q.rational(common);
  const scaled = (p: QPoly) => p.map((c) => Q.multiply(c, scale));
  const cosTerm = multiply(
    polyNode(scaled(U), variable),
    callOf("cos", wave.argument)
  );
  const sinTerm = multiply(
    polyNode(scaled(V), variable),
    callOf("sin", wave.argument)
  );
  const inside = subtractOrAdd(cosTerm, sinTerm);
  const body = multiply(exponential, inside);
  return fold(common === 1n ? body : divide(body, number(Number(common))));
}

function callOf(name: string, argument: Node): Node {
  return {
    type: "FunctionCall",
    callee: { type: "Identifier", symbol: name },
    args: [argument],
  };
}

/** `a + b`, written `a - |b|` when `b` leads with a minus. */
function subtractOrAdd(left: Node, right: Node): Node {
  if (right.type === "BinaryOperator" && right.name === "Multiply") {
    const lead = right.left;
    if (lead.type === "Negative") {
      return subtract(left, { ...right, left: lead.arg });
    }
  }
  return add(left, right);
}

function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) [x, y] = [y, x % y];
  return x;
}
