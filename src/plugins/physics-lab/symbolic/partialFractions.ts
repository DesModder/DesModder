/**
 * Partial fractions, done properly: factor the denominator, solve for the
 * numerators, integrate each piece.
 *
 * The integrator had two special cases — a denominator written as two linear
 * factors, and a quadratic read through its discriminant — and between them
 * they miss most of what a course actually asks. `1/((x+1)(x+2)(x+3))` has
 * three factors. `1/(x(x+1)²)` has a repeated one. `1/(x³-x)` has three roots
 * and is not written as a product at all. Every one of them is the same
 * problem, and the general answer is shorter than the special cases were.
 *
 * ## The three steps
 *
 * **Factor.** Rational roots first, by the rational root theorem: clear the
 * denominators, and every rational root `p/q` has `p` dividing the constant
 * term and `q` the leading one. Each root found is divided out and looked for
 * again, so a repeated one is found as many times as it occurs. What is left is
 * either a constant, or a quadratic whose discriminant decides it, or something
 * this refuses.
 *
 * **Solve.** Every factor contributes one unknown per multiplicity — two for a
 * quadratic, since its numerator is linear — and matching coefficients gives a
 * square system with exactly as many equations as unknowns. Gaussian
 * elimination over exact rationals, never floating point: the answer is a list
 * of coefficients that go straight into the printed result, and `0.33333` in
 * place of a third would be visible and wrong.
 *
 * **Integrate.** Each piece is one of four standard forms, and none of them
 * needs anything the rest of the integrator does not already have.
 *
 * ## What it refuses
 *
 * A denominator with an irrational root that is not part of a quadratic factor,
 * which means anything of degree three or more that has no rational root.
 * Factoring those exactly is a different problem — `x³ - 2` has one real root
 * and it is the cube root of two — and an answer in terms of a root nobody can
 * write is worse than a refusal.
 *
 * Coefficients have to be rational, for the same reason the discriminant rule
 * needs numbers: the *shape* of the answer depends on whether a discriminant is
 * negative, and with a symbolic coefficient there is no way to know.
 */
import {
  add,
  call,
  constantValue,
  divide,
  fold,
  id,
  multiply,
  negative,
  number,
  power,
  subtract,
  type Node,
} from "../../../symbolic";
import * as Q from "./rational";
import { coefficientsIn } from "./integrate";

/** A polynomial as exact rational coefficients, lowest power first. */
type Poly = Q.Rational[];

/** How large a numerator or denominator may get before this gives up. */
const COEFFICIENT_LIMIT = 10n ** 12n;

/** Beyond this the search for rational roots is not worth the arithmetic. */
const MAX_DEGREE = 6;

function trim(poly: Poly): Poly {
  const out = [...poly];
  while (out.length > 1 && Q.isZero(out[out.length - 1])) out.pop();
  return out;
}

const degreeOf = (poly: Poly) => trim(poly).length - 1;

function polyAdd(a: Poly, b: Poly): Poly {
  const out: Poly = [];
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    out.push(Q.add(a[i] ?? Q.ZERO, b[i] ?? Q.ZERO));
  }
  return trim(out);
}

function polyMultiply(a: Poly, b: Poly): Poly {
  const out: Poly = new Array(a.length + b.length - 1).fill(Q.ZERO);
  for (let i = 0; i < a.length; i += 1) {
    for (let j = 0; j < b.length; j += 1) {
      out[i + j] = Q.add(out[i + j], Q.multiply(a[i], b[j]));
    }
  }
  return trim(out);
}

/** `a = q·b + r`, exactly. `b` must not be zero. */
function polyDivide(a: Poly, b: Poly): { quotient: Poly; remainder: Poly } {
  const remainder = [...trim(a)];
  const divisor = trim(b);
  const d = degreeOf(divisor);
  const leading = divisor[d];
  const quotient: Poly = new Array(Math.max(1, remainder.length - d)).fill(
    Q.ZERO
  );
  for (let i = degreeOf(remainder); i >= d; i -= 1) {
    if (Q.isZero(remainder[i])) continue;
    const factor = Q.divide(remainder[i], leading);
    quotient[i - d] = factor;
    for (let j = 0; j <= d; j += 1) {
      remainder[i - d + j] = Q.subtract(
        remainder[i - d + j],
        Q.multiply(factor, divisor[j])
      );
    }
  }
  return { quotient: trim(quotient), remainder: trim(remainder) };
}

/** One factor of the denominator, with how many times it occurs. */
type Factor =
  | { kind: "linear"; root: Q.Rational; multiplicity: number }
  | { kind: "quadratic"; b: Q.Rational; c: Q.Rational; multiplicity: number };

/**
 * The denominator as a leading coefficient and a list of factors, or
 * `undefined` if it cannot be factored exactly.
 */
function factorise(
  poly: Poly
): { leading: Q.Rational; factors: Factor[] } | undefined {
  let current = trim(poly);
  const degree = degreeOf(current);
  if (degree < 1 || degree > MAX_DEGREE) return undefined;
  const leading = current[degree];
  // Made monic, so every factor below is `(x - r)` or `x² + bx + c` and the
  // leading coefficient is carried once rather than spread through them.
  current = current.map((value) => Q.divide(value, leading));

  const factors: Factor[] = [];
  const addFactor = (factor: Factor) => {
    const existing = factors.find((other) => sameFactor(other, factor));
    if (existing === undefined) factors.push(factor);
    else existing.multiplicity += factor.multiplicity;
  };

  while (degreeOf(current) > 2) {
    const root = rationalRoot(current);
    if (root === undefined) return undefined;
    addFactor({ kind: "linear", root, multiplicity: 1 });
    current = polyDivide(current, [Q.negate(root), Q.ONE]).quotient;
  }

  if (degreeOf(current) === 2) {
    const [c, b] = current;
    const discriminant = Q.subtract(
      Q.multiply(b, b),
      Q.multiply(Q.rational(4n), c)
    );
    const root = exactSquareRoot(discriminant);
    if (root === undefined) {
      // Irreducible over the rationals, which is exactly the case that becomes
      // an arctangent rather than a pair of logarithms.
      if (!Q.isNegative(discriminant)) return undefined;
      addFactor({ kind: "quadratic", b, c, multiplicity: 1 });
      current = [Q.ONE];
    } else {
      const half = Q.rational(1n, 2n);
      const first = Q.multiply(half, Q.subtract(Q.negate(b), root));
      const second = Q.multiply(half, Q.add(Q.negate(b), root));
      addFactor({ kind: "linear", root: first, multiplicity: 1 });
      addFactor({ kind: "linear", root: second, multiplicity: 1 });
      current = [Q.ONE];
    }
  }
  if (degreeOf(current) === 1) {
    addFactor({
      kind: "linear",
      root: Q.negate(Q.divide(current[0], current[1])),
      multiplicity: 1,
    });
    current = [Q.ONE];
  }
  return { leading, factors };
}

function sameFactor(a: Factor, b: Factor) {
  if (a.kind !== b.kind) return false;
  if (a.kind === "linear" && b.kind === "linear")
    return Q.equals(a.root, b.root);
  if (a.kind === "quadratic" && b.kind === "quadratic")
    return Q.equals(a.b, b.b) && Q.equals(a.c, b.c);
  return false;
}

/** The exact square root of a rational, where there is one. */
function exactSquareRoot(value: Q.Rational): Q.Rational | undefined {
  if (Q.isNegative(value)) return undefined;
  const n = integerSquareRoot(value.n);
  const d = integerSquareRoot(value.d);
  if (n === undefined || d === undefined) return undefined;
  return Q.rational(n, d);
}

function integerSquareRoot(value: bigint): bigint | undefined {
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

/**
 * A rational root of a monic-or-not polynomial, by the rational root theorem.
 *
 * Both the numerator's and the denominator's candidates come from divisors of
 * the constant and leading terms, and the constant term being zero means the
 * root is zero — which is the case the theorem does not cover and the one that
 * `x³ - x` starts with.
 */
function rationalRoot(poly: Poly): Q.Rational | undefined {
  const cleared = clearDenominators(poly);
  if (cleared === undefined) return undefined;
  const degree = degreeOf(cleared);
  if (Q.isZero(cleared[0])) return Q.ZERO;
  const constant = cleared[0].n < 0n ? -cleared[0].n : cleared[0].n;
  const leading =
    cleared[degree].n < 0n ? -cleared[degree].n : cleared[degree].n;
  for (const p of divisors(constant)) {
    for (const q of divisors(leading)) {
      for (const sign of [1n, -1n]) {
        const candidate = Q.rational(sign * p, q);
        if (Q.isZero(evaluatePoly(cleared, candidate))) return candidate;
      }
    }
  }
  return undefined;
}

/** The same polynomial with integer coefficients, or undefined if too large. */
function clearDenominators(poly: Poly): Poly | undefined {
  let multiplier = 1n;
  for (const value of poly) {
    multiplier = lcm(multiplier, value.d);
    if (multiplier > COEFFICIENT_LIMIT) return undefined;
  }
  const out = poly.map((value) => Q.multiply(value, Q.rational(multiplier)));
  for (const value of out) {
    if (value.n > COEFFICIENT_LIMIT || -value.n > COEFFICIENT_LIMIT)
      return undefined;
  }
  return out;
}

function lcm(a: bigint, b: bigint) {
  return (a / gcd(a, b)) * b;
}

function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) [x, y] = [y, x % y];
  return x;
}

/** Every positive divisor of `value`, smallest first. Bounded, deliberately. */
function divisors(value: bigint): bigint[] {
  if (value === 0n) return [1n];
  const out: bigint[] = [];
  for (let i = 1n; i * i <= value && i <= 100000n; i += 1n) {
    if (value % i === 0n) {
      out.push(i);
      if (i * i !== value) out.push(value / i);
    }
  }
  return out.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function evaluatePoly(poly: Poly, at: Q.Rational): Q.Rational {
  let total = Q.ZERO;
  let power = Q.ONE;
  for (const coefficient of poly) {
    total = Q.add(total, Q.multiply(coefficient, power));
    power = Q.multiply(power, at);
  }
  return total;
}

/** One term of the decomposition, before it is integrated. */
interface Piece {
  factor: Factor;
  /** Which power of the factor this term sits over. */
  at: number;
  /** The coefficients of its numerator, lowest power first. */
  numerator: Poly;
}

/**
 * Solves `N(x)/D(x) = Σ pieces`, exactly.
 *
 * The system is square by construction: a factor of degree `d` repeated `m`
 * times contributes `d·m` unknowns and `d·m` to the degree of `D`.
 */
function decompose(
  numerator: Poly,
  factors: readonly Factor[],
  denominator: Poly
): Piece[] | undefined {
  // Each unknown's multiplier: the whole denominator divided by the power of
  // the factor this term sits over, times x for the second unknown of a
  // quadratic.
  const columns: { piece: Omit<Piece, "numerator">; multiplier: Poly }[] = [];
  for (const factor of factors) {
    const base: Poly =
      factor.kind === "linear"
        ? [Q.negate(factor.root), Q.ONE]
        : [factor.c, factor.b, Q.ONE];
    for (let at = 1; at <= factor.multiplicity; at += 1) {
      let divisorPower: Poly = [Q.ONE];
      for (let i = 0; i < at; i += 1)
        divisorPower = polyMultiply(divisorPower, base);
      const { quotient, remainder } = polyDivide(denominator, divisorPower);
      if (degreeOf(remainder) > 0 || !Q.isZero(remainder[0])) return undefined;
      columns.push({ piece: { factor, at }, multiplier: quotient });
      if (factor.kind === "quadratic") {
        columns.push({
          piece: { factor, at },
          multiplier: polyMultiply([Q.ZERO, Q.ONE], quotient),
        });
      }
    }
  }

  const size = degreeOf(denominator);
  if (columns.length !== size) return undefined;
  // One row per power of x below the denominator's degree.
  const matrix: Q.Rational[][] = [];
  for (let row = 0; row < size; row += 1) {
    const line: Q.Rational[] = [];
    for (const column of columns) line.push(column.multiplier[row] ?? Q.ZERO);
    line.push(numerator[row] ?? Q.ZERO);
    matrix.push(line);
  }
  const solution = solve(matrix, size);
  if (solution === undefined) return undefined;

  const pieces: Piece[] = [];
  let index = 0;
  for (const column of columns) {
    const value = solution[index];
    index += 1;
    const existing = pieces.find(
      (piece) =>
        piece.factor === column.piece.factor && piece.at === column.piece.at
    );
    // A quadratic's two unknowns are the constant and the `x` coefficient, in
    // that order, so the second one lands in the second slot.
    if (existing === undefined) {
      pieces.push({ ...column.piece, numerator: [value] });
    } else {
      existing.numerator = [existing.numerator[0], value];
    }
  }
  return pieces;
}

/** Gaussian elimination over exact rationals. */
function solve(matrix: Q.Rational[][], size: number): Q.Rational[] | undefined {
  const rows = matrix.map((row) => [...row]);
  for (let column = 0; column < size; column += 1) {
    let pivot = -1;
    for (let row = column; row < size; row += 1) {
      if (!Q.isZero(rows[row][column])) {
        pivot = row;
        break;
      }
    }
    if (pivot < 0) return undefined;
    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
    const leading = rows[column][column];
    for (let i = column; i <= size; i += 1) {
      rows[column][i] = Q.divide(rows[column][i], leading);
    }
    for (let row = 0; row < size; row += 1) {
      if (row === column || Q.isZero(rows[row][column])) continue;
      const factor = rows[row][column];
      for (let i = column; i <= size; i += 1) {
        rows[row][i] = Q.subtract(
          rows[row][i],
          Q.multiply(factor, rows[column][i])
        );
      }
    }
  }
  return rows.map((row) => row[size]);
}

/** A rational as a node, exactly. */
function rationalNodeOf(value: Q.Rational): Node {
  const n = number(Number(value.n));
  return value.d === 1n ? n : divide(n, number(Number(value.d)));
}

/**
 * The antiderivative of `numerator / denominator` by partial fractions, or
 * `undefined` when the denominator cannot be factored exactly.
 *
 * The numerator must already be of lower degree than the denominator; the
 * caller divides first, because polynomial division is its own step and is
 * useful without any of this.
 */
export function partialFractionIntegral(
  numerator: Node,
  denominator: Node,
  variable: string
): Node | undefined {
  const top = asPoly(numerator, variable);
  const bottom = asPoly(denominator, variable);
  if (top === undefined || bottom === undefined) return undefined;
  if (degreeOf(top) >= degreeOf(bottom)) return undefined;

  const factored = factorise(bottom);
  if (factored === undefined) return undefined;
  const monic = bottom.map((value) => Q.divide(value, factored.leading));
  const scaled = top.map((value) => Q.divide(value, factored.leading));

  const pieces = decompose(scaled, factored.factors, monic);
  if (pieces === undefined) return undefined;

  let total: Node | undefined;
  for (const piece of pieces) {
    const term = integratePiece(piece, variable);
    if (term === undefined) return undefined;
    total = total === undefined ? term : add(total, term);
  }
  return total === undefined ? number(0) : fold(total);
}

/** One decomposed term, integrated. Four shapes and no others. */
function integratePiece(piece: Piece, variable: string): Node | undefined {
  const x = id(variable);
  if (piece.factor.kind === "linear") {
    const [coefficient] = piece.numerator;
    if (Q.isZero(coefficient)) return number(0);
    const shifted = add(x, rationalNodeOf(Q.negate(piece.factor.root)));
    if (piece.at === 1) {
      return multiply(
        rationalNodeOf(coefficient),
        call("ln", call("abs", shifted))
      );
    }
    // A/(x-r)^m integrates to -A/((m-1)(x-r)^{m-1}).
    return negative(
      divide(
        rationalNodeOf(coefficient),
        multiply(number(piece.at - 1), power(shifted, number(piece.at - 1)))
      )
    );
  }

  // A repeated irreducible quadratic needs a reduction formula, which is a
  // genuinely different piece of work and is rare enough in a course to refuse
  // rather than half-do.
  if (piece.at !== 1) return undefined;

  const { b, c } = piece.factor;
  const constantTerm = piece.numerator[0] ?? Q.ZERO;
  const linearTerm = piece.numerator[1] ?? Q.ZERO;
  const quadratic = add(
    add(power(x, number(2)), multiply(rationalNodeOf(b), x)),
    rationalNodeOf(c)
  );
  // Bx + C = (B/2)(2x + b) + (C - Bb/2), and the first part is the quadratic's
  // own derivative over itself.
  const half = Q.rational(1n, 2n);
  const logarithmic = Q.isZero(linearTerm)
    ? undefined
    : multiply(
        rationalNodeOf(Q.multiply(half, linearTerm)),
        call("ln", call("abs", quadratic))
      );
  const leftover = Q.subtract(
    constantTerm,
    Q.multiply(Q.multiply(half, linearTerm), b)
  );
  // The square completed: x + b/2, and the half-width from the discriminant.
  const shifted = add(x, rationalNodeOf(Q.multiply(half, b)));
  const spread = Q.subtract(
    c,
    Q.multiply(Q.multiply(half, b), Q.multiply(half, b))
  );
  const arctangent = Q.isZero(leftover)
    ? undefined
    : divide(
        multiply(
          rationalNodeOf(leftover),
          call("arctan", divide(shifted, call("sqrt", rationalNodeOf(spread))))
        ),
        call("sqrt", rationalNodeOf(spread))
      );
  if (logarithmic === undefined && arctangent === undefined) return number(0);
  if (logarithmic === undefined) return arctangent!;
  if (arctangent === undefined) return logarithmic;
  return add(logarithmic, arctangent);
}

/** A node as exact rational coefficients, or undefined if it is not one. */
function asPoly(node: Node, variable: string): Poly | undefined {
  const symbolic = coefficientsIn(node, variable, MAX_DEGREE);
  if (symbolic === undefined) return undefined;
  const out: Poly = [];
  for (const coefficient of symbolic) {
    const value = constantValue(fold(coefficient));
    if (value === undefined) return undefined;
    const exact = Q.fromNumber(value);
    if (exact === undefined) return undefined;
    out.push(exact);
  }
  return trim(out);
}

/** Kept for the tests, which check the factoring and the solve separately. */
export const forTesting = {
  factorise,
  decompose,
  rationalRoot,
  polyDivide,
  polyMultiply,
  polyAdd,
  asPoly,
  subtract,
};
