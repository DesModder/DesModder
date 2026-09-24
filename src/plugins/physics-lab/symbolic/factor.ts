/**
 * Factoring a polynomial over the rationals, for partial fractions.
 *
 * The rational root theorem finds every *linear* factor and nothing else, so
 * `x⁶ + 1` — which has no rational root and is `(x² + 1)(x⁴ - x² + 1)` — was
 * refused. The quadratic and quartic factors are there to be found; they only
 * have to be looked for.
 *
 * Two steps, both exact:
 *
 * 1. **Yun's squarefree decomposition** splits the polynomial into layers
 *    `f = ∏ fᵢ^i` with every `fᵢ` squarefree and coprime to the others, using
 *    nothing but GCDs.
 * 2. **Kronecker's method** factors each squarefree layer. A factor of degree
 *    `k` of an integer polynomial `F` takes, at each of `k + 1` integer points,
 *    a value dividing `F` there — so enumerating those divisors and
 *    interpolating enumerates every candidate factor, and an exact division
 *    test decides each. It is complete, which is what makes a "no factor"
 *    answer mean something.
 *
 * The enumeration can grow quickly, so it runs under a budget. **Running out
 * of budget is not a proof of irreducibility**: it returns `undefined`, and
 * the caller refuses the decomposition rather than treating a factor it gave
 * up on as irreducible.
 */
import * as Q from "./rational";

/** A polynomial over Q, lowest power first. */
export type QPoly = Q.Rational[];

/** How many candidate factors Kronecker's search may test. */
const KRONECKER_BUDGET = 200_000;

/** Beyond this the search space is not one a panel should wait on. */
export const MAX_FACTOR_DEGREE = 8;

function trim(p: QPoly): QPoly {
  const out = [...p];
  while (out.length > 1 && Q.isZero(out[out.length - 1])) out.pop();
  return out.length === 0 ? [Q.ZERO] : out;
}

const degree = (p: QPoly) => trim(p).length - 1;
const isZero = (p: QPoly) => trim(p).every(Q.isZero);

function multiply(a: QPoly, b: QPoly): QPoly {
  const out = new Array<Q.Rational>(a.length + b.length - 1).fill(Q.ZERO);
  for (let i = 0; i < a.length; i += 1)
    for (let j = 0; j < b.length; j += 1)
      out[i + j] = Q.add(out[i + j], Q.multiply(a[i], b[j]));
  return trim(out);
}

function divide(a: QPoly, b: QPoly): { quotient: QPoly; remainder: QPoly } {
  const remainder = [...trim(a)];
  const divisor = trim(b);
  const d = degree(divisor);
  const quotient = new Array<Q.Rational>(
    Math.max(1, remainder.length - d)
  ).fill(Q.ZERO);
  for (let i = remainder.length - 1; i >= d; i -= 1) {
    if (Q.isZero(remainder[i])) continue;
    const factor = Q.divide(remainder[i], divisor[d]);
    quotient[i - d] = factor;
    for (let j = 0; j <= d; j += 1)
      remainder[i - d + j] = Q.subtract(
        remainder[i - d + j],
        Q.multiply(factor, divisor[j])
      );
  }
  return { quotient: trim(quotient), remainder: trim(remainder) };
}

function monic(p: QPoly): QPoly {
  const t = trim(p);
  const lead = t[t.length - 1];
  return t.map((c) => Q.divide(c, lead));
}

function gcd(a: QPoly, b: QPoly): QPoly {
  let x = trim(a);
  let y = trim(b);
  while (!isZero(y)) [x, y] = [y, divide(x, y).remainder];
  return monic(x);
}

function derivative(p: QPoly): QPoly {
  const out = p
    .slice(1)
    .map((c, i) => Q.multiply(c, Q.rational(BigInt(i + 1))));
  return out.length === 0 ? [Q.ZERO] : trim(out);
}

const isOne = (p: QPoly) => degree(p) === 0;

/**
 * Yun: `[factor, multiplicity]` pairs, each factor monic and squarefree.
 *
 * Terminates because `w` loses degree on every pass until it is constant.
 */
export function squarefree(f: QPoly): [QPoly, number][] {
  const F = monic(f);
  if (degree(F) < 1) return [];
  let c = gcd(F, derivative(F));
  let w = divide(F, c).quotient;
  const out: [QPoly, number][] = [];
  for (let i = 1; !isOne(w); i += 1) {
    const y = gcd(w, c);
    const z = divide(w, y).quotient;
    if (!isOne(z)) out.push([monic(z), i]);
    w = y;
    c = divide(c, y).quotient;
  }
  return out;
}

// ---- Kronecker ---------------------------------------------------------------

function bigAbs(n: bigint) {
  return n < 0n ? -n : n;
}

function bigGcd(a: bigint, b: bigint): bigint {
  let x = bigAbs(a);
  let y = bigAbs(b);
  while (y !== 0n) [x, y] = [y, x % y];
  return x;
}

/** The same polynomial with integer coefficients and content removed. */
function primitiveInteger(p: QPoly): bigint[] {
  let lcm = 1n;
  for (const c of p) lcm = (lcm / bigGcd(lcm, c.d)) * c.d;
  const ints = p.map((c) => (c.n * lcm) / c.d);
  let content = 0n;
  for (const c of ints) content = bigGcd(content, c);
  if (content === 0n) content = 1n;
  const sign = ints[ints.length - 1] < 0n ? -1n : 1n;
  return ints.map((c) => (sign * c) / content);
}

function evaluateInt(p: bigint[], x: bigint): bigint {
  let total = 0n;
  for (let i = p.length - 1; i >= 0; i -= 1) total = total * x + p[i];
  return total;
}

function positiveDivisors(n: bigint): bigint[] | undefined {
  const value = bigAbs(n);
  if (value > 10n ** 9n) return undefined;
  const out: bigint[] = [];
  for (let i = 1n; i * i <= value; i += 1n) {
    if (value % i === 0n) {
      out.push(i);
      if (i * i !== value) out.push(value / i);
    }
  }
  return out;
}

/** The polynomial of degree < points.length through the given points, over Q. */
function interpolate(xs: bigint[], ys: bigint[]): QPoly {
  let result: QPoly = [Q.ZERO];
  for (let i = 0; i < xs.length; i += 1) {
    let basis: QPoly = [Q.ONE];
    let denominator = Q.ONE;
    for (let j = 0; j < xs.length; j += 1) {
      if (i === j) continue;
      basis = multiply(basis, [Q.rational(-xs[j]), Q.ONE]);
      denominator = Q.multiply(denominator, Q.rational(xs[i] - xs[j]));
    }
    const scale = Q.divide(Q.rational(ys[i]), denominator);
    const term = basis.map((c) => Q.multiply(c, scale));
    const length = Math.max(result.length, term.length);
    const sum: QPoly = [];
    for (let k = 0; k < length; k += 1)
      sum.push(Q.add(result[k] ?? Q.ZERO, term[k] ?? Q.ZERO));
    result = trim(sum);
  }
  return result;
}

class Budget {
  private remaining = KRONECKER_BUDGET;
  tick() {
    this.remaining -= 1;
    return this.remaining >= 0;
  }
}

/**
 * The irreducible factors of a squarefree polynomial over Q, monic, or
 * `undefined` when the search could not be finished.
 */
function kronecker(f: QPoly, budget: Budget): QPoly[] | undefined {
  const F = primitiveInteger(f);
  const n = F.length - 1;
  if (n <= 1) return [monic(f)];

  // Integer points where F is non-zero, smallest |F| first: fewer divisors
  // means fewer candidates.
  const candidates: { x: bigint; value: bigint }[] = [];
  for (let x = -12n; x <= 12n; x += 1n) {
    const value = evaluateInt(F, x);
    if (value !== 0n) candidates.push({ x, value });
  }
  candidates.sort((a, b) => (bigAbs(a.value) < bigAbs(b.value) ? -1 : 1));

  for (let k = 1; k <= Math.floor(n / 2); k += 1) {
    const points = candidates.slice(0, k + 1);
    if (points.length < k + 1) return undefined;
    // The values a factor can take at each point. The first point's is taken
    // positive: a factor and its negative are the same factor, so fixing one
    // sign halves the search without losing anything.
    const values: bigint[][] = [];
    for (let i = 0; i < points.length; i += 1) {
      const divisors = positiveDivisors(points[i].value);
      if (divisors === undefined) return undefined;
      values.push(
        i === 0 ? divisors : [...divisors, ...divisors.map((d) => -d)]
      );
    }
    const xs = points.map((p) => p.x);
    const indices = new Array<number>(k + 1).fill(0);
    for (;;) {
      if (!budget.tick()) return undefined;
      const h = interpolate(
        xs,
        indices.map((index, i) => values[i][index])
      );
      if (degree(h) === k) {
        const { quotient, remainder } = divide(f, h);
        if (isZero(remainder)) {
          const left = kronecker(monic(h), budget);
          const right = kronecker(monic(quotient), budget);
          if (left === undefined || right === undefined) return undefined;
          return [...left, ...right];
        }
      }
      // Count through every combination, like an odometer.
      let position = 0;
      while (position <= k) {
        indices[position] += 1;
        if (indices[position] < values[position].length) break;
        indices[position] = 0;
        position += 1;
      }
      if (position > k) break;
    }
  }
  // Every candidate of every degree up to n/2 was tested: irreducible.
  return [monic(f)];
}

/**
 * Every irreducible factor of `f` over Q, monic, repeated by multiplicity, or
 * `undefined` if the degree is too high or the search ran out of budget.
 */
export function factorOverQ(f: QPoly): QPoly[] | undefined {
  if (degree(f) > MAX_FACTOR_DEGREE) return undefined;
  const budget = new Budget();
  const out: QPoly[] = [];
  for (const [layer, multiplicity] of squarefree(f)) {
    const factors = kronecker(layer, budget);
    if (factors === undefined) return undefined;
    for (const factor of factors)
      for (let i = 0; i < multiplicity; i += 1) out.push(factor);
  }
  return out;
}

/** Kept for the tests. */
export const forTesting = { kronecker, interpolate, primitiveInteger };
