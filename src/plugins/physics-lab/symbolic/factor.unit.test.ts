/**
 * Factoring over Q: Yun's squarefree layers, then Kronecker's complete search.
 * The cases are the research brief's regression table.
 */
import { factorOverQ, squarefree, type QPoly } from "./factor";
import * as Q from "./rational";

/** Coefficients lowest power first, as integers. */
const poly = (...coefficients: number[]): QPoly =>
  coefficients.map((c) => Q.rational(BigInt(c)));

const show = (p: QPoly) =>
  p
    .map((c, i) => [Q.toLatex(c), i] as const)
    .filter(([c]) => c !== "0")
    .map(([c, i]) => `${c}x^${i}`)
    .reverse()
    .join(" + ");

describe("squarefree layers", () => {
  test("(x^2+1)^3 (x-2)^2 comes apart by multiplicity", () => {
    // (x-2)^2 = x^2 - 4x + 4; (x^2+1)^3 = x^6 + 3x^4 + 3x^2 + 1.
    let f: QPoly = poly(1);
    const mul = (a: QPoly, b: QPoly) => {
      const out = new Array<Q.Rational>(a.length + b.length - 1).fill(Q.ZERO);
      a.forEach((x, i) =>
        b.forEach((y, j) => (out[i + j] = Q.add(out[i + j], Q.multiply(x, y))))
      );
      return out;
    };
    f = mul(poly(4, -4, 1), poly(1, 0, 3, 0, 3, 0, 1));
    const layers = squarefree(f).map(([p, m]) => [show(p), m]);
    expect(layers).toEqual([
      ["1x^1 + -2x^0", 2],
      ["1x^2 + 1x^0", 3],
    ]);
  });
});

describe("Kronecker's factoring", () => {
  const factors = (p: QPoly) => factorOverQ(p)?.map(show).sort();

  test("x^6 + 1 is a quadratic times a quartic", () => {
    expect(factors(poly(1, 0, 0, 0, 0, 0, 1))).toEqual(
      ["1x^2 + 1x^0", "1x^4 + -1x^2 + 1x^0"].sort()
    );
  });

  test("x^4 - 1 into its three rational factors", () => {
    expect(factors(poly(-1, 0, 0, 0, 1))).toEqual(
      ["1x^1 + -1x^0", "1x^1 + 1x^0", "1x^2 + 1x^0"].sort()
    );
  });

  test("x^4 + 4, the Sophie Germain identity", () => {
    expect(factors(poly(4, 0, 0, 0, 1))).toEqual(
      ["1x^2 + -2x^1 + 2x^0", "1x^2 + 2x^1 + 2x^0"].sort()
    );
  });

  test("x^3 + 2 and x^8 + 1 are irreducible over Q", () => {
    expect(factors(poly(2, 0, 0, 1))).toEqual(["1x^3 + 2x^0"]);
    expect(factors(poly(1, 0, 0, 0, 0, 0, 0, 0, 1))).toEqual(["1x^8 + 1x^0"]);
  });

  test("beyond degree eight it declines rather than guessing", () => {
    expect(factorOverQ(poly(1, 0, 0, 0, 0, 0, 0, 0, 0, 1))).toBeUndefined();
  });
});
