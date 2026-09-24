/**
 * Series antiderivatives, checked as functions rather than as formulae.
 *
 * A general term is easy to get slightly wrong in a way that reads perfectly:
 * an index off by one, a factorial of `2n` where it should be `2n+1`, a
 * coefficient that alternates the wrong way. None of that shows in the LaTeX.
 *
 * So every case here differentiates the *finite sum* numerically and compares
 * it against the integrand, which is possible because the evaluator was taught
 * factorials and repeated operators for exactly this. Thirty terms is far more
 * than enough near the origin, and the sample points are chosen inside every
 * interval of convergence the table mentions.
 */
import {
  DEFAULT_SERIES_TERMS,
  SeriesError,
  seriesAntiderivative,
} from "./series";
import {
  agreesOnSamples,
  evaluate,
  numericDerivative,
  toLatex,
} from "../../../symbolic";
import { Aug, AugBuilders, buildConfig } from "../../../../text-mode-core";

const { binop, functionCall, id, number } = AugBuilders;

type Node = Aug.Latex.AnyChild;

const cfg = buildConfig({
  commandNames: "sin cos tan ln exp sqrt sinh cosh arctan",
});
const emit = (node: Node) => toLatex(cfg, node);

const x = id("x");
const e = id("e");
const mul = (a: Node, b: Node) => binop("Multiply", a, b);
const div = (a: Node, b: Node) => binop("Divide", a, b);
const add = (a: Node, b: Node) => binop("Add", a, b);
const sub = (a: Node, b: Node) => binop("Subtract", a, b);
const pow = (a: Node, b: Node) => binop("Exponent", a, b);
const fn = (name: string, arg: Node) => functionCall(id(name), [arg]);
const neg = (arg: Node): Node => ({ type: "Negative", arg });

/** Well inside `|x| < 1`, which is the narrowest interval in the table. */
const SAMPLES = [0.15, 0.3, 0.45].map((value) => ({ x: value }));

function check(integrand: Node, expectedTerm: string) {
  const result = seriesAntiderivative(integrand, "x", 30);
  expect(emit(result.term)).toBe(expectedTerm);
  // The claim, checked: differentiating the sum gives the integrand back.
  expect(
    agreesOnSamples(
      (bindings) => numericDerivative(result.sum, "x", bindings),
      (bindings) => evaluate(integrand, bindings),
      SAMPLES,
      1e-6
    )
  ).toBe(true);
  return result;
}

describe("the integrals that have no elementary antiderivative", () => {
  test("e^{x^2}, which is the one everybody meets first", () => {
    const result = check(
      pow(e, pow(x, number(2))),
      "\\frac{x^{2n+1}}{n!\\left(2n+1\\right)}"
    );
    expect(result.from).toBe(0);
    expect(result.interval).toBe("every x");
    // And the same thing written out, which is what a reader checks it by.
    expect(emit(result.partial)).toBe(
      "x+\\frac{x^{3}}{3}+\\frac{x^{5}}{10}+\\frac{x^{7}}{42}"
    );
  });

  test("e^{-x^2}, which is the error function", () => {
    // The sign has to come through the substitution `u = -x^2` and end up
    // alternating, which is the one thing a lost minus would hide.
    check(
      pow(e, neg(pow(x, number(2)))),
      "\\frac{\\left(-1\\right)^{n}x^{2n+1}}{n!\\left(2n+1\\right)}"
    );
  });

  test("sin(x)/x, which is the sine integral", () => {
    const result = check(
      div(fn("sin", x), x),
      "\\frac{\\left(-1\\right)^{n}x^{2n+1}}{\\left(2n+1\\right)!\\left(2n+1\\right)}"
    );
    expect(emit(result.partial)).toBe(
      "x-\\frac{x^{3}}{18}+\\frac{x^{5}}{600}-\\frac{x^{7}}{35280}"
    );
  });

  test("cos(x^2) and sin(x^2), which are the Fresnel integrals", () => {
    check(
      fn("cos", pow(x, number(2))),
      "\\frac{\\left(-1\\right)^{n}x^{4n+1}}{\\left(2n\\right)!\\left(4n+1\\right)}"
    );
    check(
      fn("sin", pow(x, number(2))),
      "\\frac{\\left(-1\\right)^{n}x^{4n+3}}{\\left(2n+1\\right)!\\left(4n+3\\right)}"
    );
  });
});

describe("the pieces it reads off the integrand", () => {
  test("a constant in front, and one inside the exponent", () => {
    check(
      mul(number(2), pow(e, mul(number(3), pow(x, number(2))))),
      "\\frac{2\\cdot 3^{n}x^{2n+1}}{n!\\left(2n+1\\right)}"
    );
  });

  test("a power of the variable outside the function", () => {
    check(
      mul(pow(x, number(2)), fn("sin", x)),
      "\\frac{\\left(-1\\right)^{n}x^{2n+4}}{\\left(2n+1\\right)!\\left(2n+4\\right)}"
    );
  });

  test("a negative outside power, which is what a quotient is", () => {
    check(
      div(fn("ln", add(number(1), x)), x),
      "\\frac{\\left(-1\\right)^{n+1}x^{n}}{n^{2}}"
    );
  });

  test("the geometric series, recognised from its denominator", () => {
    // The one entry with no function of its own: `1/(1-u)` is a shape rather
    // than something anybody calls by name.
    const result = check(
      div(number(1), sub(number(1), pow(x, number(2)))),
      "\\frac{x^{2n+1}}{2n+1}"
    );
    expect(result.interval).toBe("|x| < 1");
  });

  test("the hyperbolic ones, which do not alternate", () => {
    check(
      fn("sinh", pow(x, number(2))),
      "\\frac{x^{4n+3}}{\\left(2n+1\\right)!\\left(4n+3\\right)}"
    );
  });
});

describe("what it refuses", () => {
  test("a function with no series in the table", () => {
    // `tan` has one and it has no closed general term -- the coefficients are
    // Bernoulli numbers -- so it is not in the table, and being absent is the
    // honest answer rather than a truncation pretending to be a formula.
    expect(() => seriesAntiderivative(fn("tan", x), "x")).toThrow(SeriesError);
  });

  test("an argument that is not a constant times a power", () => {
    expect(() =>
      seriesAntiderivative(fn("sin", add(x, number(1))), "x")
    ).toThrow(SeriesError);
    expect(() => seriesAntiderivative(fn("exp", fn("sin", x)), "x")).toThrow(
      SeriesError
    );
  });

  test("two functions multiplied together", () => {
    expect(() =>
      seriesAntiderivative(mul(fn("sin", x), fn("cos", x)), "x")
    ).toThrow(SeriesError);
  });

  test("a first term that is a multiple of 1/x becomes a logarithm", () => {
    // `1/x` times the geometric series starts with `∫dx/x`. That term is
    // taken out as ln|x| and the general term starts one index later, which is
    // exactly how the exponential integral is written.
    const result = seriesAntiderivative(
      div(number(1), mul(x, sub(number(1), x))),
      "x"
    );
    expect(result.logarithm).toBeDefined();
    expect(result.from).toBe(1);
  });

  test("a zero exponent in the middle of the series is still refused", () => {
    // e^x/x^3: the n = 2 term is x^{-1}, and no one general term covers the
    // powers either side of a logarithm.
    expect(() =>
      seriesAntiderivative(div(pow(e, x), pow(x, number(3))), "x")
    ).toThrow(SeriesError);
  });
});

describe("the sum it hands back", () => {
  test("is a finite one, because that is what can be plotted", () => {
    const result = seriesAntiderivative(pow(e, pow(x, number(2))), "x");
    expect(result.sum.type).toBe("RepeatedOperator");
    const sum = result.sum as Aug.Latex.RepeatedOperator;
    expect(sum.name).toBe("Sum");
    expect(sum.index.symbol).toBe(result.index);
    expect(emit(sum.start)).toBe("0");
    expect(emit(sum.end)).toBe(String(DEFAULT_SERIES_TERMS - 1));
  });

  test("and its index does not collide with the integrand's names", () => {
    // `n` is the obvious name and is also a name somebody may have used.
    const withN = mul(id("n"), pow(e, pow(x, number(2))));
    expect(seriesAntiderivative(withN, "x").index).not.toBe("n");
  });
});
