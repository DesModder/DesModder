/**
 * Constants Desmos has no name for, defined so that it can have one.
 *
 * Euler's γ, Apéry's ζ(3), ζ(5), ζ(7) and Catalan's G turn up constantly —
 * in series, in integrals, in the harmonic numbers — and Desmos knows none
 * of them. It does not need to: each is a finite expression Desmos can
 * evaluate, once the right one is chosen, and a definition put into the graph
 * beside an answer makes the answer evaluable there.
 *
 * Each constant carries two computations, and they do different jobs.
 *
 * - `compute(digits)` is exact to any precision asked for, for recognising a
 *   decimal: Brent–McMillan for γ, Borwein's algorithm for ζ, a series in
 *   central binomial coefficients for G. Tests pin each to published digits.
 * - `definition` is what goes into Desmos, which evaluates in doubles. It is
 *   chosen to be exact to below a double's last digit, not merely close:
 *   Euler–Maclaurin at N = 100 for γ and ζ, whose first omitted term is below
 *   10⁻¹⁷, and the same central-binomial series for G, cut where its terms
 *   are. The integration test compares Desmos's value with `compute`'s.
 */
import { decimalContext, type Decimal } from "../../../symbolic";

export interface SpecialConstant {
  /** The identifier the formula uses, and the name Desmos is given. */
  symbol: string;
  /** What it is called, for saying so. */
  name: string;
  /** The value to `digits` significant digits. */
  compute: (digits: number) => Decimal;
  /** The Desmos definition that gives the name its value. */
  definition: string;
}

const cache = new Map<string, Decimal>();

function cached(key: string, digits: number, run: () => Decimal): Decimal {
  const id = `${key} ${digits}`;
  let value = cache.get(id);
  if (value === undefined) {
    value = run();
    cache.set(id, value);
  }
  return value;
}

/**
 * Euler's constant, by Brent and McMillan's algorithm B1: with
 * `A₀ = −ln n`, `B₀ = 1`, `Bₖ = Bₖ₋₁ n²/k²`, `Aₖ = (Aₖ₋₁ n²/k + Bₖ)/k`,
 * `γ = ΣAₖ / ΣBₖ` with error about `π e^{−4n}`. (Brent and McMillan, "Some
 * new algorithms for high-precision computation of Euler's constant", Math.
 * Comp. 1980.)
 */
function eulerGamma(digits: number): Decimal {
  return cached("gamma", digits, () => {
    const n = Math.ceil(((digits + 5) * Math.LN10) / 4) + 1;
    const terms = Math.ceil(3.5911 * n) + 1;
    // The sums grow to about e^{2n} before their ratio is taken.
    const D = decimalContext(digits + Math.ceil(0.87 * n) + 15);
    const n2 = new D(n).pow(2);
    let a = D.ln(n).neg();
    let b = new D(1);
    let u = a;
    let v = b;
    for (let k = 1; k <= terms; k++) {
      b = b.times(n2).div(k * k);
      a = a.times(n2).div(k).plus(b).div(k);
      u = u.plus(a);
      v = v.plus(b);
    }
    return new (decimalContext(digits))(u.div(v));
  });
}

/**
 * `ζ(s)` for an integer `s ≥ 2`, by Borwein's second algorithm for the
 * alternating η: with integer weights `dₖ`, the error is below
 * `3/(3 + √8)ⁿ`. (P. Borwein, "An efficient algorithm for the Riemann zeta
 * function", CMS Conf. Proc. 2000.)
 */
function zeta(s: number, digits: number): Decimal {
  return cached(`zeta ${s}`, digits, () => {
    const n = Math.ceil((digits + 5) / Math.log10(3 + Math.sqrt(8))) + 1;
    // dₖ = n Σ_{i≤k} (n+i−1)! 4ⁱ / ((n−i)! (2i)!), integers, computed exactly.
    const d: bigint[] = [];
    let term = 1n; // i = 0: n·(n−1)!/n! = 1
    let total = 0n;
    for (let i = 0; i <= n; i++) {
      total += term;
      d.push(total);
      const N = BigInt(n);
      const I = BigInt(i);
      term = (term * (N + I) * (N - I) * 4n) / ((2n * I + 1n) * (2n * I + 2n));
    }
    const D = decimalContext(digits + Math.ceil(0.8 * n) + 15);
    const dn = new D(d[n].toString());
    let sum = new D(0);
    for (let k = 0; k < n; k++) {
      const weight = new D((d[k] - d[n]).toString());
      const piece = weight.div(new D(k + 1).pow(s));
      sum = k % 2 === 0 ? sum.plus(piece) : sum.minus(piece);
    }
    const eta = sum.neg().div(dn);
    const value = eta.div(new D(1).minus(new D(2).pow(1 - s)));
    return new (decimalContext(digits))(value);
  });
}

/**
 * Catalan's constant, by `G = (π/8) ln(2 + √3) + (3/8) Σ 1/((2n+1)² C(2n,n))`,
 * whose terms fall by about four each time.
 */
function catalan(digits: number): Decimal {
  return cached("catalan", digits, () => {
    const D = decimalContext(digits + 15);
    const terms = Math.ceil(((digits + 5) * Math.LN10) / Math.log(4)) + 5;
    let sum = new D(0);
    let central = 1n; // C(2n, n)
    for (let k = 0; k <= terms; k++) {
      if (k > 0) central = (central * BigInt(2 * (2 * k - 1))) / BigInt(k);
      sum = sum.plus(
        new D(1).div(new D(central.toString()).times((2 * k + 1) ** 2))
      );
    }
    const pi = D.acos(-1);
    const value = pi
      .div(8)
      .times(D.ln(new D(2).plus(D.sqrt(3))))
      .plus(sum.times(3).div(8));
    return new (decimalContext(digits))(value);
  });
}

/**
 * ζ(s) in Desmos: Σ_{n<100} n^{−s} plus the Euler–Maclaurin tail at 100,
 * `100^{1−s}/(s−1) + 100^{−s}/2 + s·100^{−s−1}/12 − s(s+1)(s+2)·100^{−s−3}/720`.
 * The first term left out is about `s⁵ · 100^{−s−5}/30240`, below 10⁻¹⁷ for
 * s = 3 — past the last digit a double holds.
 */
function zetaDefinition(s: number): string {
  const rising = s * (s + 1) * (s + 2);
  // Summed smallest term first, 1/99ˢ up to 1: adding small numbers to a
  // large one drops their low bits, and in the other order the rounding of
  // ninety-nine additions lands in the last digit Desmos shows.
  return (
    `\\zeta_{${s}}=\\sum_{n=1}^{99}\\frac{1}{\\left(100-n\\right)^{${s}}}` +
    `+\\frac{1}{${s - 1}\\cdot100^{${s - 1}}}` +
    `+\\frac{1}{2\\cdot100^{${s}}}` +
    `+\\frac{${s}}{12\\cdot100^{${s + 1}}}` +
    `-\\frac{${rising}}{720\\cdot100^{${s + 3}}}`
  );
}

export const SPECIAL_CONSTANTS: readonly SpecialConstant[] = [
  {
    symbol: "gamma",
    name: "Euler's constant γ",
    compute: eulerGamma,
    // H₁₀₀ − ln 100 − 1/200 + 1/(12·100²) − 1/(120·100⁴) + 1/(252·100⁶);
    // the next term is 1/(240·100⁸), about 4·10⁻¹⁹.
    definition:
      "\\gamma=\\sum_{n=1}^{100}\\frac{1}{n}-\\ln\\left(100\\right)-\\frac{1}{200}+\\frac{1}{120000}-\\frac{1}{12000000000}+\\frac{1}{252000000000000}",
  },
  {
    symbol: "zeta_3",
    name: "Apéry's constant ζ(3)",
    compute: (digits) => zeta(3, digits),
    definition: zetaDefinition(3),
  },
  {
    symbol: "zeta_5",
    name: "ζ(5)",
    compute: (digits) => zeta(5, digits),
    definition: zetaDefinition(5),
  },
  {
    symbol: "zeta_7",
    name: "ζ(7)",
    compute: (digits) => zeta(7, digits),
    definition: zetaDefinition(7),
  },
  {
    symbol: "G_c",
    name: "Catalan's constant G",
    compute: catalan,
    // Terms fall by four each time; forty of them reach 10⁻²⁶. Summed from
    // the smallest term up (k = 40 − n), for the same reason as ζ.
    definition:
      "G_{c}=\\frac{\\pi}{8}\\ln\\left(2+\\sqrt{3}\\right)+\\frac{3}{8}\\sum_{n=0}^{40}\\frac{1}{\\operatorname{nCr}\\left(80-2n,40-n\\right)\\left(81-2n\\right)^{2}}",
  },
];

/** Every special constant's value at a precision, as evaluation bindings. */
export function specialBindings(digits: number): Record<string, Decimal> {
  const out: Record<string, Decimal> = {};
  for (const c of SPECIAL_CONSTANTS) out[c.symbol] = c.compute(digits);
  return out;
}

/** The special constants a formula uses, by the identifiers in it. */
export function constantsIn(symbols: readonly string[]): SpecialConstant[] {
  return SPECIAL_CONSTANTS.filter((c) => symbols.includes(c.symbol));
}
