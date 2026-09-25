/**
 * PSLQ: finding the integer relation among a handful of real numbers.
 *
 * Given x₀ … xₙ₋₁, PSLQ finds integers a₀ … aₙ₋₁, not all zero, with
 * `Σ aᵢ xᵢ = 0` to the working precision — or proves no such relation exists
 * with coefficients below a bound. It is the algorithm behind identifying a
 * decimal as a closed form: put the decimal beside the constants it might be
 * built from, and a relation *is* the formula. (Ferguson, Bailey and Arno,
 * "Analysis of PSLQ, an integer relation finding algorithm", Math. Comp.
 * 1999; the two-level form here follows Bailey's description.)
 *
 * The arithmetic is `decimal.js` at a precision set by the caller, because a
 * relation can only be as trustworthy as the digits behind it: a relation
 * that holds to twelve digits among twelve-digit numbers is evidence, and
 * one that holds only to six is noise.
 *
 * What this returns is a candidate. Whether it means anything is decided by
 * the caller, which compares how many digits the relation explains with how
 * many digits it takes to write down.
 */
import { decimalContext, type Decimal } from "../../../symbolic";

export interface RelationSearch {
  /** Significant digits the inputs are good to. */
  digits: number;
  /** The largest coefficient worth finding: past it, no relation is claimed. */
  maxCoefficient: number;
  /** A ceiling on iterations, so a hopeless search ends. */
  maxIterations?: number;
}

/**
 * An integer relation among `xs`, or undefined when none is found within the
 * bounds. The relation is returned with a positive first nonzero entry.
 */
export function integerRelation(
  xs: readonly Decimal[],
  { digits, maxCoefficient, maxIterations = 250 }: RelationSearch
): bigint[] | undefined {
  const n = xs.length;
  if (n < 2) return undefined;
  // A few guard digits past the evidence, so rounding in the algorithm stays
  // below the threshold that decides a relation has been found.
  const D = decimalContext(digits + 12);
  const x = xs.map((v) => new D(v));
  if (x.some((v) => !v.isFinite()) || x.every((v) => v.isZero()))
    return undefined;
  const threshold = new D(10).pow(-(digits - 3));
  const gamma = new D(4).div(3).sqrt();

  // Normalise x, and build the partial norms s_j = √(Σ_{k≥j} x_k²).
  const s: Decimal[] = new Array<Decimal>(n);
  let tail = new D(0);
  for (let k = n - 1; k >= 0; k--) {
    tail = tail.plus(x[k].times(x[k]));
    s[k] = tail.sqrt();
  }
  const [t] = s;
  const y = x.map((v) => v.div(t));
  for (let k = 0; k < n; k++) s[k] = s[k].div(t);
  if (s.slice(0, n - 1).some((v) => v.isZero())) return undefined;

  // H is n × (n − 1), lower trapezoidal.
  const H: Decimal[][] = [];
  for (let i = 0; i < n; i++) {
    H.push([]);
    for (let j = 0; j < n - 1; j++) {
      if (i < j) H[i].push(new D(0));
      else if (i === j) H[i].push(s[j + 1].div(s[j]));
      else
        H[i].push(
          y[i]
            .times(y[j])
            .neg()
            .div(s[j].times(s[j + 1]))
        );
    }
  }
  const identity = (): bigint[][] =>
    Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (__, j) => (i === j ? 1n : 0n) as bigint)
    );
  const A = identity();
  const B = identity();

  const reduceRow = (i: number, j: number) => {
    if (H[j][j].isZero()) return;
    const q = H[i][j].div(H[j][j]).toDecimalPlaces(0, D.ROUND_HALF_EVEN);
    if (q.isZero()) return;
    const qi = BigInt(q.toFixed(0));
    y[j] = y[j].plus(q.times(y[i]));
    for (let k = 0; k <= j; k++) H[i][k] = H[i][k].minus(q.times(H[j][k]));
    for (let k = 0; k < n; k++) {
      A[i][k] -= qi * A[j][k];
      B[k][j] += qi * B[k][i];
    }
  };
  for (let i = 1; i < n; i++) for (let j = i - 1; j >= 0; j--) reduceRow(i, j);

  const bound = BigInt(Math.ceil(maxCoefficient));
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    // The row whose diagonal, weighted, is largest.
    let m = 0;
    let best = new D(-1);
    let weight = gamma;
    for (let i = 0; i < n - 1; i++) {
      const size = weight.times(H[i][i].abs());
      if (size.gt(best)) {
        best = size;
        m = i;
      }
      weight = weight.times(gamma);
    }
    // Exchange m and m + 1.
    [y[m], y[m + 1]] = [y[m + 1], y[m]];
    [A[m], A[m + 1]] = [A[m + 1], A[m]];
    [H[m], H[m + 1]] = [H[m + 1], H[m]];
    for (let k = 0; k < n; k++) [B[k][m], B[k][m + 1]] = [B[k][m + 1], B[k][m]];
    // Restore the trapezoid with a rotation.
    if (m < n - 2) {
      const t0 = H[m][m]
        .times(H[m][m])
        .plus(H[m][m + 1].times(H[m][m + 1]))
        .sqrt();
      if (t0.isZero()) return undefined;
      const t1 = H[m][m].div(t0);
      const t2 = H[m][m + 1].div(t0);
      for (let i = m; i < n; i++) {
        const t3 = H[i][m];
        const t4 = H[i][m + 1];
        H[i][m] = t1.times(t3).plus(t2.times(t4));
        H[i][m + 1] = t2.neg().times(t3).plus(t1.times(t4));
      }
    }
    for (let i = m + 1; i < n; i++)
      for (let j = Math.min(i - 1, m + 1); j >= 0; j--) reduceRow(i, j);

    // A relation: some y_j has vanished, and column j of B is it.
    for (let j = 0; j < n; j++) {
      if (y[j].abs().lt(threshold)) {
        const relation = B.map((row) => row[j]);
        const largest = relation.reduce<bigint>(
          (a, b) => ((b < 0n ? -b : b) > a ? (b < 0n ? -b : b) : a),
          0n
        );
        if (largest === 0n || largest > bound) return undefined;
        const first = relation.find((c) => c !== 0n) ?? 1n;
        return first < 0n ? relation.map((c) => -c) : relation;
      }
    }
    // Every relation left has norm at least 1/max|H_jj|: past the bound,
    // there is nothing worth finding.
    let largestDiagonal = new D(0);
    for (let j = 0; j < n - 1; j++)
      if (H[j][j].abs().gt(largestDiagonal)) largestDiagonal = H[j][j].abs();
    if (largestDiagonal.isZero()) return undefined;
    if (new D(1).div(largestDiagonal).gt(maxCoefficient * n)) return undefined;
  }
  return undefined;
}
