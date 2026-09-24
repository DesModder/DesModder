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
 * a constant, a quadratic, or a quartic with no rational root at all.
 *
 * A quadratic stays whole whenever its roots are irrational, whichever sign its
 * discriminant has. `t² - 2t - 1` has the real roots `1 ± √2`, and splitting it
 * into `(t - 1 - √2)(t - 1 + √2)` would give two logarithms with `√2/4` in
 * front of each; keeping it whole and completing the square gives the one
 * logarithm of a quotient that every table prints. The Weierstrass substitution
 * lands on exactly this for `1/(sin x + cos x)`.
 *
 * A quartic with no rational root is split into two quadratics through its
 * resolvent cubic, which is how `x⁴ + 1` becomes `(x² + √2x + 1)(x² - √2x + 1)`.
 * The coefficients of those factors are not rational, so from there on the
 * arithmetic is done in the rationals with one square root adjoined — see
 * `field.ts`, which is what keeps them exact.
 *
 * **Solve.** Every factor contributes one unknown per multiplicity — two for a
 * quadratic, since its numerator is linear — and matching coefficients gives a
 * square system with exactly as many equations as unknowns. Gaussian
 * elimination over the exact field, never floating point: the answer is a list
 * of coefficients that go straight into the printed result, and `0.33333` in
 * place of a third would be visible and wrong.
 *
 * **Integrate.** Each piece is a power of a linear or a quadratic factor, and a
 * power of a quadratic is the one that needs a reduction formula:
 *
 *     ∫du/(u²+K)^m = u / (2K(m-1)(u²+K)^{m-1}) + (2m-3)/(2K(m-1)) ∫du/(u²+K)^{m-1}
 *
 * ## What it refuses
 *
 * A cubic with no rational root, whose one real root is a cube root nobody can
 * write in these terms; a quartic whose resolvent has no rational root, which
 * would need a root of a cubic in its factors; anything of degree five or six
 * that does not come apart into those. An answer in terms of a root nobody can
 * write is worse than a refusal.
 *
 * Coefficients have to be rational, for the same reason the discriminant rule
 * needs numbers: the *shape* of the answer depends on the sign of a
 * discriminant, and with a symbolic coefficient there is no way to know it.
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
import {
  RATIONALS,
  quadraticField,
  rationalNode,
  surd,
  type Field,
} from "./field";
import { coefficientsIn } from "./integrate";
import { factorOverQ } from "./factor";

/** A polynomial as exact coefficients, lowest power first. */
type Poly<T> = T[];

/** How large a numerator or denominator may get before this gives up. */
const COEFFICIENT_LIMIT = 10n ** 12n;

/** Beyond this the search for rational roots is not worth the arithmetic. */
const MAX_DEGREE = 8;

// ---- polynomial arithmetic, over whichever field ---------------------------

function trim<T>(F: Field<T>, poly: Poly<T>): Poly<T> {
  const out = [...poly];
  while (out.length > 1 && F.isZero(out[out.length - 1])) out.pop();
  return out.length === 0 ? [F.zero] : out;
}

const degreeOf = <T>(F: Field<T>, poly: Poly<T>) => trim(F, poly).length - 1;

const isZeroPoly = <T>(F: Field<T>, poly: Poly<T>) =>
  trim(F, poly).every((value) => F.isZero(value));

function polyMultiply<T>(F: Field<T>, a: Poly<T>, b: Poly<T>): Poly<T> {
  const out: Poly<T> = new Array<T>(a.length + b.length - 1).fill(F.zero);
  for (let i = 0; i < a.length; i += 1) {
    for (let j = 0; j < b.length; j += 1) {
      out[i + j] = F.add(out[i + j], F.multiply(a[i], b[j]));
    }
  }
  return trim(F, out);
}

/** `a = q·b + r`, exactly. `b` must not be zero. */
function polyDivide<T>(
  F: Field<T>,
  a: Poly<T>,
  b: Poly<T>
): { quotient: Poly<T>; remainder: Poly<T> } {
  const remainder = [...trim(F, a)];
  const divisor = trim(F, b);
  const d = degreeOf(F, divisor);
  const leading = divisor[d];
  const quotient: Poly<T> = new Array<T>(
    Math.max(1, remainder.length - d)
  ).fill(F.zero);
  for (let i = remainder.length - 1; i >= d; i -= 1) {
    if (F.isZero(remainder[i])) continue;
    const factor = F.divide(remainder[i], leading);
    quotient[i - d] = factor;
    for (let j = 0; j <= d; j += 1) {
      remainder[i - d + j] = F.subtract(
        remainder[i - d + j],
        F.multiply(factor, divisor[j])
      );
    }
  }
  return { quotient: trim(F, quotient), remainder: trim(F, remainder) };
}

/** The monic greatest common divisor, by Euclid. */
function polyGcd<T>(F: Field<T>, a: Poly<T>, b: Poly<T>): Poly<T> {
  let x = trim(F, a);
  let y = trim(F, b);
  while (!isZeroPoly(F, y)) [x, y] = [y, polyDivide(F, x, y).remainder];
  const leading = x[degreeOf(F, x)];
  return x.map((value) => F.divide(value, leading));
}

function evaluatePoly<T>(F: Field<T>, poly: Poly<T>, at: T): T {
  let total = F.zero;
  for (let i = poly.length - 1; i >= 0; i -= 1)
    total = F.add(F.multiply(total, at), poly[i]);
  return total;
}

/** `p(x + shift)`, by Horner's rule on polynomials. */
function shiftPoly<T>(F: Field<T>, poly: Poly<T>, shift: T): Poly<T> {
  let total: Poly<T> = [F.zero];
  for (let i = poly.length - 1; i >= 0; i -= 1) {
    total = polyMultiply(F, total, [shift, F.one]);
    total[0] = F.add(total[0], poly[i]);
  }
  return trim(F, total);
}

const lift = <T>(F: Field<T>, poly: Poly<Q.Rational>): Poly<T> =>
  poly.map((value) => F.of(value));

// ---- factoring -------------------------------------------------------------

/** One factor of the denominator, with how many times it occurs. */
type Factor<T> =
  | { kind: "linear"; root: T; multiplicity: number }
  | { kind: "quadratic"; b: T; c: T; multiplicity: number };

/** The denominator factored over some field, and which field that is. */
interface Factorisation<T> {
  field: Field<T>;
  leading: T;
  factors: Factor<T>[];
}

/** A quadratic `x² + bx + c`, over whichever field it was found in. */
type QuadraticPair<T> = readonly [T, T];

/**
 * The denominator as a leading coefficient and a list of factors, or
 * `undefined` if it cannot be factored exactly.
 */
function factorise(poly: Poly<Q.Rational>): Factorisation<unknown> | undefined {
  const F = RATIONALS;
  let current = trim(F, poly);
  const degree = degreeOf(F, current);
  if (degree < 1 || degree > MAX_DEGREE) return undefined;
  const leading = current[degree];
  // Made monic, so every factor below is `(x - r)` or `x² + bx + c` and the
  // leading coefficient is carried once rather than spread through them.
  current = current.map((value) => Q.divide(value, leading));

  const roots: Q.Rational[] = [];
  while (degreeOf(F, current) > 2) {
    const root = rationalRoot(current);
    if (root === undefined) break;
    roots.push(root);
    current = polyDivide(F, current, [Q.negate(root), Q.ONE]).quotient;
  }

  // What is left has no rational root. Factored over Q first -- `x^6 + 1`
  // is `(x^2 + 1)(x^4 - x^2 + 1)` -- and then every quartic factor split into
  // quadratics through its resolvent, which may need one square root.
  const rest = degreeOf(F, current);
  const irreducible = rest <= 2 ? [current] : factorOverQ(current);
  if (irreducible === undefined) return undefined;

  let field: Field<unknown> = RATIONALS as Field<unknown>;
  const rationalPairs: QuadraticPair<Q.Rational>[] = [];
  const fieldPairs: QuadraticPair<unknown>[] = [];
  for (const factor of irreducible) {
    const d = degreeOf(F, factor);
    if (d === 0) continue;
    if (d === 1) {
      roots.push(Q.negate(Q.divide(factor[0], factor[1])));
      continue;
    }
    if (d === 2) {
      rationalPairs.push([factor[1], factor[0]]);
      continue;
    }
    // A cubic or quintic with no rational root has a real root that is not in
    // any field this works in; an elementary antiderivative exists, and this
    // cannot write it.
    if (d !== 4) return undefined;
    const split = splitQuartic(factor);
    if (split === undefined) return undefined;
    if (split.field.key !== "Q") {
      // One square root at a time: two quartics needing different ones would
      // need their product field, which this does not do.
      if (field.key !== "Q" && field.key !== split.field.key) return undefined;
      ({ field } = split);
    }
    fieldPairs.push(...split.pairs);
  }
  const G = field;
  const pairs: QuadraticPair<unknown>[] = [
    ...rationalPairs.map(
      ([b, c]): QuadraticPair<unknown> => [G.of(b), G.of(c)]
    ),
    ...fieldPairs.map(
      ([b, c]): QuadraticPair<unknown> => [liftInto(G, b), liftInto(G, c)]
    ),
  ];
  return assemble(G, leading, roots, pairs, poly);
}

/** A value from a quartic's split, in the common field: a rational is lifted. */
function liftInto(G: Field<unknown>, value: unknown): unknown {
  const v = value as { n?: bigint; d?: bigint };
  return typeof v.n === "bigint" && typeof v.d === "bigint"
    ? G.of(value as Q.Rational)
    : value;
}

/**
 * Every factor in one field, repeated ones merged, and the product checked
 * against the polynomial it came from.
 *
 * The check is cheap and it is the one that matters: the quartic split solves a
 * cubic and takes square roots on the way, and a factorisation that does not
 * multiply back out is a decomposition of some other denominator.
 */
function assemble<T>(
  F: Field<T>,
  leading: Q.Rational,
  roots: readonly Q.Rational[],
  pairs: readonly QuadraticPair<T>[],
  original: Poly<Q.Rational>
): Factorisation<unknown> | undefined {
  const factors: Factor<T>[] = [];
  const addFactor = (factor: Factor<T>) => {
    const existing = factors.find((other) => sameFactor(F, other, factor));
    if (existing === undefined) factors.push(factor);
    else existing.multiplicity += factor.multiplicity;
  };
  for (const root of roots)
    addFactor({ kind: "linear", root: F.of(root), multiplicity: 1 });
  for (const [b, c] of pairs) {
    // A quadratic whose discriminant is a square in this field splits into two
    // linear factors; one whose discriminant is not stays whole.
    const discriminant = F.subtract(
      F.multiply(b, b),
      F.multiply(F.of(Q.rational(4n)), c)
    );
    const root = F.sqrt(discriminant);
    if (root === undefined) {
      addFactor({ kind: "quadratic", b, c, multiplicity: 1 });
      continue;
    }
    const half = F.of(Q.rational(1n, 2n));
    for (const signed of [F.negate(root), root]) {
      addFactor({
        kind: "linear",
        root: F.multiply(half, F.add(F.negate(b), signed)),
        multiplicity: 1,
      });
    }
  }

  let product: Poly<T> = [F.of(leading)];
  for (const factor of factors) {
    for (let i = 0; i < factor.multiplicity; i += 1)
      product = polyMultiply(F, product, factorPoly(F, factor));
  }
  const expected = lift(F, trim(RATIONALS, original));
  if (product.length !== expected.length) return undefined;
  if (!product.every((value, i) => F.equals(value, expected[i])))
    return undefined;
  return {
    field: F as Field<unknown>,
    leading: F.of(leading),
    factors: factors as Factor<unknown>[],
  };
}

function factorPoly<T>(F: Field<T>, factor: Factor<T>): Poly<T> {
  return factor.kind === "linear"
    ? [F.negate(factor.root), F.one]
    : [factor.c, factor.b, F.one];
}

function sameFactor<T>(F: Field<T>, a: Factor<T>, b: Factor<T>) {
  if (a.kind === "linear" && b.kind === "linear")
    return F.equals(a.root, b.root);
  if (a.kind === "quadratic" && b.kind === "quadratic")
    return F.equals(a.b, b.b) && F.equals(a.c, b.c);
  return false;
}

/**
 * A monic quartic with no rational root, as two quadratics — over the
 * rationals where that is possible, and over `Q(√d)` where it is not.
 *
 * Shifted first so the cubic term vanishes: `y⁴ + qy² + ry + s`. Writing that
 * as `(y² + ay + b)(y² - ay + d)` and matching coefficients leaves one equation
 * in `A = a²`, the resolvent cubic
 *
 *     A³ + 2qA² + (q² - 4s)A - r² = 0,
 *
 * and any positive rational root of it gives `a = √A` and then `b` and `d` by
 * division. `A = 0` is the biquadratic `y⁴ + qy² + s`, which splits as
 * `(y² + b)(y² + d)` with `b` and `d` the roots of `z² - qz + s`.
 */
function splitQuartic(
  monic: Poly<Q.Rational>
): { field: Field<unknown>; pairs: QuadraticPair<unknown>[] } | undefined {
  const F = RATIONALS;
  const shift = Q.divide(monic[3], Q.rational(4n));
  // y = x + p/4, so p(x) = p(y - p/4).
  const depressed = shiftPoly(F, monic, Q.negate(shift));
  const [s, r, q] = depressed;
  const resolvent: Poly<Q.Rational> = [
    Q.negate(Q.multiply(r, r)),
    Q.subtract(Q.multiply(q, q), Q.multiply(Q.rational(4n), s)),
    Q.multiply(Q.rational(2n), q),
    Q.ONE,
  ];
  const candidates = allRationalRoots(resolvent);
  // A rational factorisation first, where one exists; then anything real.
  const ranked = [...candidates].sort(
    (x, y) => rank(x, r, q, s) - rank(y, r, q, s)
  );

  for (const A of ranked) {
    const found = pairsFor(A, q, r, s);
    if (found === undefined) continue;
    const { field, pairs } = found;
    // Undo the shift: y = x + p/4 turns y² + αy + β into
    // x² + (α + p/2)x + (β + αp/4 + p²/16).
    const G = field;
    const k = G.of(shift);
    const shifted = pairs.map(
      ([alpha, beta]): QuadraticPair<unknown> => [
        G.add(alpha, G.multiply(G.of(Q.rational(2n)), k)),
        G.add(G.add(beta, G.multiply(alpha, k)), G.multiply(k, k)),
      ]
    );
    return { field, pairs: shifted };
  }
  return undefined;
}

/** Lower is better: a rational split, then a real one, then nothing. */
function rank(A: Q.Rational, r: Q.Rational, q: Q.Rational, s: Q.Rational) {
  if (Q.isNegative(A)) return 3;
  if (Q.isZero(A)) {
    if (!Q.isZero(r)) return 3;
    const disc = Q.subtract(Q.multiply(q, q), Q.multiply(Q.rational(4n), s));
    if (Q.isNegative(disc)) return 3;
    return RATIONALS.sqrt(disc) === undefined ? 1 : 0;
  }
  return RATIONALS.sqrt(A) === undefined ? 1 : 0;
}

function pairsFor(
  A: Q.Rational,
  q: Q.Rational,
  r: Q.Rational,
  s: Q.Rational
): { field: Field<unknown>; pairs: QuadraticPair<unknown>[] } | undefined {
  if (Q.isNegative(A)) return undefined;
  const half = Q.rational(1n, 2n);

  if (Q.isZero(A)) {
    // The biquadratic case: y⁴ + qy² + s = (y² + b)(y² + d).
    if (!Q.isZero(r)) return undefined;
    const disc = Q.subtract(Q.multiply(q, q), Q.multiply(Q.rational(4n), s));
    if (Q.isNegative(disc)) return undefined;
    const root = rootIn(disc);
    if (root === undefined) return undefined;
    const G = root.field;
    const qq = G.of(q);
    const b = G.multiply(G.of(half), G.subtract(qq, root.value));
    const d = G.multiply(G.of(half), G.add(qq, root.value));
    return {
      field: G,
      pairs: [
        [G.zero, b],
        [G.zero, d],
      ],
    };
  }

  const root = rootIn(A);
  if (root === undefined) return undefined;
  const G = root.field;
  const a = root.value;
  const base = G.of(Q.add(q, A));
  const skew = G.divide(G.of(r), a);
  const b = G.multiply(G.of(half), G.subtract(base, skew));
  const d = G.multiply(G.of(half), G.add(base, skew));
  return {
    field: G,
    pairs: [
      [a, b],
      [G.negate(a), d],
    ],
  };
}

/**
 * `√value` and the field it lives in: the rationals if it is a perfect
 * square, `Q(√d)` for its squarefree part `d` if it is not.
 */
function rootIn(
  value: Q.Rational
): { field: Field<unknown>; value: unknown } | undefined {
  const plain = RATIONALS.sqrt(value);
  if (plain !== undefined)
    return { field: RATIONALS as Field<unknown>, value: plain };
  const found = surd(value);
  if (found === undefined) return undefined;
  const G = quadraticField(found.inside);
  return {
    field: G as Field<unknown>,
    value: { a: Q.ZERO, b: found.outside },
  };
}

/** Every rational root of a polynomial, with repetition removed. */
function allRationalRoots(poly: Poly<Q.Rational>): Q.Rational[] {
  const out: Q.Rational[] = [];
  let current = trim(RATIONALS, poly);
  while (degreeOf(RATIONALS, current) >= 1) {
    if (degreeOf(RATIONALS, current) === 1) {
      out.push(Q.negate(Q.divide(current[0], current[1])));
      break;
    }
    if (degreeOf(RATIONALS, current) === 2) {
      const [c, b, a] = current;
      const disc = Q.subtract(
        Q.multiply(b, b),
        Q.multiply(Q.rational(4n), Q.multiply(a, c))
      );
      const root = RATIONALS.sqrt(disc);
      if (root !== undefined) {
        const twice = Q.multiply(Q.rational(2n), a);
        out.push(Q.divide(Q.subtract(Q.negate(b), root), twice));
        out.push(Q.divide(Q.add(Q.negate(b), root), twice));
      }
      break;
    }
    const root = rationalRoot(current);
    if (root === undefined) break;
    out.push(root);
    current = polyDivide(RATIONALS, current, [Q.negate(root), Q.ONE]).quotient;
  }
  return out.filter(
    (value, index) => out.findIndex((other) => Q.equals(other, value)) === index
  );
}

/**
 * A rational root of a monic-or-not polynomial, by the rational root theorem.
 *
 * Both the numerator's and the denominator's candidates come from divisors of
 * the constant and leading terms, and the constant term being zero means the
 * root is zero — which is the case the theorem does not cover and the one that
 * `x³ - x` starts with.
 */
function rationalRoot(poly: Poly<Q.Rational>): Q.Rational | undefined {
  const cleared = clearDenominators(poly);
  if (cleared === undefined) return undefined;
  const degree = degreeOf(RATIONALS, cleared);
  if (Q.isZero(cleared[0])) return Q.ZERO;
  const constant = cleared[0].n < 0n ? -cleared[0].n : cleared[0].n;
  const leading =
    cleared[degree].n < 0n ? -cleared[degree].n : cleared[degree].n;
  for (const p of divisors(constant)) {
    for (const q of divisors(leading)) {
      for (const sign of [1n, -1n]) {
        const candidate = Q.rational(sign * p, q);
        if (Q.isZero(evaluatePoly(RATIONALS, cleared, candidate)))
          return candidate;
      }
    }
  }
  return undefined;
}

/** The same polynomial with integer coefficients, or undefined if too large. */
function clearDenominators(
  poly: Poly<Q.Rational>
): Poly<Q.Rational> | undefined {
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

// ---- solving -----------------------------------------------------------------

/** One term of the decomposition, before it is integrated. */
interface Piece<T> {
  factor: Factor<T>;
  /** Which power of the factor this term sits over. */
  at: number;
  /** The coefficients of its numerator, lowest power first. */
  numerator: Poly<T>;
}

/**
 * Solves `N(x)/D(x) = Σ pieces`, exactly.
 *
 * The system is square by construction: a factor of degree `d` repeated `m`
 * times contributes `d·m` unknowns and `d·m` to the degree of `D`.
 */
function decompose<T>(
  F: Field<T>,
  numerator: Poly<T>,
  factors: readonly Factor<T>[],
  denominator: Poly<T>
): Piece<T>[] | undefined {
  // Each unknown's multiplier: the whole denominator divided by the power of
  // the factor this term sits over, times x for the second unknown of a
  // quadratic.
  const columns: { piece: Omit<Piece<T>, "numerator">; multiplier: Poly<T> }[] =
    [];
  for (const factor of factors) {
    const base = factorPoly(F, factor);
    for (let at = 1; at <= factor.multiplicity; at += 1) {
      let divisorPower: Poly<T> = [F.one];
      for (let i = 0; i < at; i += 1)
        divisorPower = polyMultiply(F, divisorPower, base);
      const { quotient, remainder } = polyDivide(F, denominator, divisorPower);
      if (!isZeroPoly(F, remainder)) return undefined;
      columns.push({ piece: { factor, at }, multiplier: quotient });
      if (factor.kind === "quadratic") {
        columns.push({
          piece: { factor, at },
          multiplier: polyMultiply(F, [F.zero, F.one], quotient),
        });
      }
    }
  }

  const size = degreeOf(F, denominator);
  if (columns.length !== size) return undefined;
  // One row per power of x below the denominator's degree.
  const matrix: T[][] = [];
  for (let row = 0; row < size; row += 1) {
    const line: T[] = [];
    for (const column of columns) line.push(column.multiplier[row] ?? F.zero);
    line.push(numerator[row] ?? F.zero);
    matrix.push(line);
  }
  const solution = solve(F, matrix, size);
  if (solution === undefined) return undefined;

  const pieces: Piece<T>[] = [];
  columns.forEach((column, index) => {
    const value = solution[index];
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
  });
  return pieces;
}

/** Gaussian elimination over an exact field. */
function solve<T>(F: Field<T>, matrix: T[][], size: number): T[] | undefined {
  const rows = matrix.map((row) => [...row]);
  for (let column = 0; column < size; column += 1) {
    let pivot = -1;
    for (let row = column; row < size; row += 1) {
      if (!F.isZero(rows[row][column])) {
        pivot = row;
        break;
      }
    }
    if (pivot < 0) return undefined;
    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
    const leading = rows[column][column];
    for (let i = column; i <= size; i += 1) {
      rows[column][i] = F.divide(rows[column][i], leading);
    }
    for (let row = 0; row < size; row += 1) {
      if (row === column || F.isZero(rows[row][column])) continue;
      const factor = rows[row][column];
      for (let i = column; i <= size; i += 1) {
        rows[row][i] = F.subtract(
          rows[row][i],
          F.multiply(factor, rows[column][i])
        );
      }
    }
  }
  return rows.map((row) => row[size]);
}

// ---- integrating -----------------------------------------------------------

/**
 * The antiderivative of `numerator / denominator` by partial fractions, or
 * `undefined` when the denominator cannot be factored exactly.
 *
 * A factor the numerator and denominator share is cancelled first. That is not
 * tidiness: the Weierstrass substitution hands over `2(1+t²)/((1+t²)(1+2t-t²))`
 * with the common factor multiplied out on both sides, and the quintic it makes
 * of the denominator has no rational root at all. Divided through by the
 * greatest common divisor it is a quadratic.
 */
export function partialFractionIntegral(
  numerator: Node,
  denominator: Node,
  variable: string
): Node | undefined {
  const F = RATIONALS;
  let top = asPoly(numerator, variable);
  let bottom = asPoly(denominator, variable);
  if (top === undefined || bottom === undefined) return undefined;
  if (degreeOf(F, bottom) < 1) return undefined;

  const common = polyGcd(F, top, bottom);
  const cancelled = degreeOf(F, common) > 0;
  if (cancelled) {
    top = polyDivide(F, top, common).quotient;
    bottom = polyDivide(F, bottom, common).quotient;
  }

  let whole: Node | undefined;
  if (degreeOf(F, top) >= degreeOf(F, bottom)) {
    // An improper fraction over a quadratic is the discriminant rule's case,
    // and that rule writes the logarithm with the denominator as it was typed;
    // it is left to it unless a cancellation means what was typed is no longer
    // the denominator.
    if (!cancelled && degreeOf(F, bottom) <= 2) return undefined;
    const { quotient, remainder } = polyDivide(F, top, bottom);
    whole = integratePolynomial(quotient, variable);
    top = remainder;
  }
  if (isZeroPoly(F, top)) return whole ?? number(0);
  if (degreeOf(F, bottom) < 1) return undefined;

  const factored = factorise(bottom);
  if (factored === undefined) return undefined;
  const rest = integrateFactored(factored, top, bottom, variable);
  if (rest === undefined) return undefined;
  return fold(whole === undefined ? rest : add(whole, rest));
}

function integrateFactored<T>(
  factored: Factorisation<T>,
  top: Poly<Q.Rational>,
  bottom: Poly<Q.Rational>,
  variable: string
): Node | undefined {
  const { field: F, leading } = factored;
  const monic = lift(F, bottom).map((value) => F.divide(value, leading));
  const scaled = lift(F, top).map((value) => F.divide(value, leading));
  const pieces = decompose(F, scaled, factored.factors, monic);
  if (pieces === undefined) return undefined;

  let total: Node | undefined;
  for (const piece of pieces) {
    const term = integratePiece(F, piece, variable);
    if (term === undefined) return undefined;
    total = total === undefined ? term : add(total, term);
  }
  return total ?? number(0);
}

/** Σ cₖxᵏ integrated term by term. */
function integratePolynomial(poly: Poly<Q.Rational>, variable: string): Node {
  let total: Node = number(0);
  poly.forEach((coefficient, k) => {
    if (Q.isZero(coefficient)) return;
    const raised = power(id(variable), number(k + 1));
    total = add(
      total,
      multiply(
        rationalNode(Q.divide(coefficient, Q.rational(BigInt(k + 1)))),
        raised
      )
    );
  });
  return total;
}

/** `slope·x + intercept`, with the sign of the intercept written as a sign. */
function linearNode<T>(
  F: Field<T>,
  slope: T,
  intercept: T,
  variable: string
): Node {
  const x = id(variable);
  const scaled = F.equals(slope, F.one) ? x : multiply(F.toNode(slope), x);
  if (F.isZero(intercept)) return scaled;
  return F.sign(intercept) < 0
    ? subtract(scaled, F.toNode(F.negate(intercept)))
    : add(scaled, F.toNode(intercept));
}

/** `x² + bx + c`, as it would be written. */
function quadraticNode<T>(F: Field<T>, b: T, c: T, variable: string): Node {
  const x = id(variable);
  const squared = power(x, number(2));
  const withLinear = F.isZero(b)
    ? squared
    : F.sign(b) < 0
      ? subtract(squared, linearNode(F, F.negate(b), F.zero, variable))
      : add(squared, linearNode(F, b, F.zero, variable));
  if (F.isZero(c)) return withLinear;
  return F.sign(c) < 0
    ? subtract(withLinear, F.toNode(F.negate(c)))
    : add(withLinear, F.toNode(c));
}

/** `c · node`, with a coefficient of one left out. */
function scaledBy<T>(F: Field<T>, coefficient: T, node: Node): Node {
  if (F.equals(coefficient, F.one)) return node;
  if (F.equals(coefficient, F.negate(F.one))) return negative(node);
  return multiply(F.toNode(coefficient), node);
}

/** One decomposed term, integrated. */
function integratePiece<T>(
  F: Field<T>,
  piece: Piece<T>,
  variable: string
): Node | undefined {
  const x = id(variable);
  if (piece.factor.kind === "linear") {
    const [coefficient] = piece.numerator;
    if (F.isZero(coefficient)) return number(0);
    const shifted = linearNode(F, F.one, F.negate(piece.factor.root), variable);
    if (piece.at === 1)
      return scaledBy(F, coefficient, call("ln", call("abs", shifted)));
    // A/(x-r)^m integrates to -A/((m-1)(x-r)^{m-1}).
    return negative(
      divide(
        F.toNode(coefficient),
        multiply(number(piece.at - 1), power(shifted, number(piece.at - 1)))
      )
    );
  }

  const { b, c } = piece.factor;
  const m = piece.at;
  const constantTerm = piece.numerator[0] ?? F.zero;
  const linearTerm = piece.numerator[1] ?? F.zero;
  const quadratic = quadraticNode(F, b, c, variable);
  const half = F.of(Q.rational(1n, 2n));
  // The square completed: u = x + h, and u² + K is the quadratic.
  const h = F.multiply(half, b);
  const K = F.subtract(c, F.multiply(h, h));
  if (F.isZero(K)) return undefined;

  // Bx + C = (B/2)(2x + b) + (C - Bb/2), and the first part is the quadratic's
  // own derivative over a power of it.
  const halfB = F.multiply(half, linearTerm);
  const logarithmic = F.isZero(linearTerm)
    ? undefined
    : m === 1
      ? scaledBy(F, halfB, call("ln", call("abs", quadratic)))
      : negative(
          divide(
            F.toNode(F.divide(halfB, F.of(Q.rational(BigInt(m - 1))))),
            power(quadratic, number(m - 1))
          )
        );
  const leftover = F.subtract(constantTerm, F.multiply(linearTerm, h));
  const rest = F.isZero(leftover)
    ? undefined
    : reduction(F, m, leftover, h, K, quadratic, variable);
  void x;
  if (logarithmic === undefined && rest === undefined) return number(0);
  if (logarithmic === undefined) return rest;
  if (rest === undefined) return logarithmic;
  return add(logarithmic, rest);
}

/**
 * `scale · ∫du/(u² + K)^m` with `u = x + h`, by the reduction formula, down to
 * the arctangent or logarithm at `m = 1`.
 */
function reduction<T>(
  F: Field<T>,
  m: number,
  scale: T,
  h: T,
  K: T,
  quadratic: Node,
  variable: string
): Node {
  if (m === 1) return quadraticBase(F, scale, h, K, variable);
  const steps = F.of(Q.rational(BigInt(m - 1)));
  const denominator = F.multiply(F.multiply(F.of(Q.rational(2n)), K), steps);
  const u = linearNode(F, F.one, h, variable);
  const algebraic = divide(
    scaledBy(F, F.divide(scale, denominator), u),
    power(quadratic, number(m - 1))
  );
  const next = F.divide(
    F.multiply(scale, F.of(Q.rational(BigInt(2 * m - 3)))),
    denominator
  );
  return add(algebraic, reduction(F, m - 1, next, h, K, quadratic, variable));
}

/**
 * `scale · ∫du/(u² + K)`: an arctangent when `K > 0`, a logarithm of a
 * quotient when `K < 0`.
 *
 * Three ways of writing the root of `|K|`, in order of preference. Inside the
 * field, it is a coefficient like any other and the arctangent's argument comes
 * out linear — `arctan(√2x + 1)` for `x⁴ + 1`. A rational `|K|` whose root is
 * not in the field is written `(m/k)√s`, and the `k` is multiplied through so
 * `∫dx/(x²+x+1)` reads `arctan((2x+1)/√3)` rather than a radical of three
 * quarters. Anything else is a nested radical, which is exact and rare.
 */
function quadraticBase<T>(
  F: Field<T>,
  scale: T,
  h: T,
  K: T,
  variable: string
): Node {
  const positive = F.sign(K) > 0;
  const magnitude = positive ? K : F.negate(K);
  const two = F.of(Q.rational(2n));

  const inside = F.sqrt(magnitude);
  // A rational half-width divides the shifted variable as it stands:
  // `arctan((x+1)/2)`, not `arctan(x/2 + 1/2)`.
  if (inside !== undefined && positive && F.asRational(inside) !== undefined) {
    const u = linearNode(F, F.one, h, variable);
    const over = F.equals(inside, F.one) ? u : divide(u, F.toNode(inside));
    return scaledBy(F, F.divide(scale, inside), call("arctan", over));
  }
  if (inside !== undefined) {
    if (positive) {
      const inverse = F.divide(F.one, inside);
      return scaledBy(
        F,
        F.multiply(scale, inverse),
        call("arctan", linearNode(F, inverse, F.multiply(h, inverse), variable))
      );
    }
    const over = linearNode(F, F.one, F.subtract(h, inside), variable);
    const under = linearNode(F, F.one, F.add(h, inside), variable);
    return scaledBy(
      F,
      F.divide(scale, F.multiply(two, inside)),
      call("ln", call("abs", divide(over, under)))
    );
  }

  const rational = F.asRational(magnitude);
  const written = rational === undefined ? undefined : surd(rational);
  if (written !== undefined) {
    // √|K| = o√s, so u/√|K| = ((1/o)u)/√s.
    const o = F.of(written.outside);
    const root = call("sqrt", number(Number(written.inside)));
    const u = linearNode(F, F.divide(F.one, o), F.divide(h, o), variable);
    if (positive) {
      return divide(
        scaledBy(F, F.divide(scale, o), call("arctan", divide(u, root))),
        root
      );
    }
    return divide(
      scaledBy(
        F,
        F.divide(scale, F.multiply(two, o)),
        call("ln", call("abs", divide(subtract(u, root), add(u, root))))
      ),
      root
    );
  }

  const root = call("sqrt", F.toNode(magnitude));
  const u = linearNode(F, F.one, h, variable);
  if (positive) {
    return divide(scaledBy(F, scale, call("arctan", divide(u, root))), root);
  }
  return divide(
    scaledBy(
      F,
      F.divide(scale, two),
      call("ln", call("abs", divide(subtract(u, root), add(u, root))))
    ),
    root
  );
}

/** A node as exact rational coefficients, or undefined if it is not one. */
function asPoly(node: Node, variable: string): Poly<Q.Rational> | undefined {
  const symbolic = coefficientsIn(node, variable, MAX_DEGREE);
  if (symbolic === undefined) return undefined;
  const out: Poly<Q.Rational> = [];
  for (const coefficient of symbolic) {
    const value = constantValue(fold(coefficient));
    if (value === undefined) return undefined;
    const exact = Q.fromNumber(value);
    if (exact === undefined) return undefined;
    out.push(exact);
  }
  return trim(RATIONALS, out);
}

/** Kept for the tests, which check the factoring and the solve separately. */
export const forTesting = {
  factorise,
  decompose,
  rationalRoot,
  polyDivide,
  polyMultiply,
  polyGcd,
  asPoly,
};
