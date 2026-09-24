/**
 * Every integration technique the integrator has, one example each.
 *
 * `integrate.unit.test.ts` covers the rules a first course meets; this covers
 * the machinery added on top of them, which is where the risk is. A rule reads
 * a shape and either matches it or does not. A *technique* rewrites the problem
 * — substitutes, divides, completes a square, changes variable and changes back
 * — and every one of those steps is a place where a correct-looking answer can
 * be the antiderivative of something else.
 *
 * So each case here asserts two things, and the second is the one that matters:
 * the LaTeX, so that a technique which quietly stops firing is noticed, and the
 * derivative of the answer against the integrand at five points, which no
 * plausible wrong answer survives.
 */
import { integrate, IntegrationError } from "./integrate";
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
  commandNames:
    "sin cos tan sec csc cot ln log exp sqrt sinh cosh tanh arcsin arccos arctan",
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

/**
 * Close to the origin and strictly inside every domain used here: the circle
 * substitutions need |x| < 1, the logarithms need x > 0, and a point at a pole
 * would be skipped and quietly reduce the check to nothing.
 */
const SAMPLES = [0.11, 0.27, 0.41, 0.58, 0.72].map((value) => ({ x: value }));

/**
 * `extra` binds any parameter the integrand carries besides the variable.
 *
 * Without it an integrand mentioning `a` evaluates to `NaN` at every point,
 * every point is skipped as undefined, and the numeric check passes by never
 * having checked anything -- which is the one way this suite could be quietly
 * worthless.
 */
function check(
  integrand: Node,
  expected: string,
  extra: Record<string, number> = {}
) {
  const result = integrate(integrand, "x");
  expect(emit(result)).toBe(expected);
  const samples = SAMPLES.map((sample) => ({ ...sample, ...extra }));
  expect(
    agreesOnSamples(
      (bindings) => numericDerivative(result, "x", bindings),
      (bindings) => evaluate(integrand, bindings),
      samples
    )
  ).toBe(true);
}

describe("substitution, found rather than matched", () => {
  test("the derivative of the inner function is sitting outside", () => {
    check(mul(mul(number(2), x), pow(e, pow(x, number(2)))), "e^{x^{2}}");
  });

  test("a quotient whose numerator is the denominator's derivative", () => {
    check(
      div(x, add(pow(x, number(2)), number(1))),
      "\\frac{\\ln\\left|x^{2}+1\\right|}{2}"
    );
  });

  test("the inner function is itself a logarithm", () => {
    check(
      div(number(1), mul(x, fn("ln", x))),
      "\\ln\\left|\\ln\\left(x\\right)\\right|"
    );
    check(div(fn("ln", x), x), "\\frac{\\ln\\left(x\\right)^{2}}{2}");
  });

  test("a power of a trigonometric function against its own derivative", () => {
    check(
      mul(pow(fn("sin", x), number(3)), fn("cos", x)),
      "\\frac{\\sin\\left(x\\right)^{4}}{4}"
    );
  });

  test("the candidate with the simplest derivative wins", () => {
    // Both `x^2+1` and `sqrt(x^2+1)` work here. The second gives
    // `sqrt(x^2+1)^3/3`, which is the same function written as a cube of a
    // root, and is nobody's answer.
    check(
      mul(x, fn("sqrt", add(pow(x, number(2)), number(1)))),
      "\\frac{\\left(x^{2}+1\\right)^{\\frac{3}{2}}}{3}"
    );
  });

  test("substitution is preferred to parts where both would work", () => {
    // Parts succeeds on this and answers `x` times an arcsine plus a
    // correction, which is correct and three times the length.
    check(
      mul(x, fn("sqrt", sub(number(1), pow(x, number(2))))),
      "-\\frac{\\left(1-x^{2}\\right)^{\\frac{3}{2}}}{3}"
    );
  });
});

describe("the table, which is most of a first course", () => {
  test("the inverse functions, each of which is parts done once in advance", () => {
    check(
      fn("arctan", x),
      "x\\arctan\\left(x\\right)-\\frac{\\ln\\left(x^{2}+1\\right)}{2}"
    );
    check(fn("arcsin", x), "x\\arcsin\\left(x\\right)+\\sqrt{1-x^{2}}");
    check(fn("ln", x), "x\\ln\\left(x\\right)-x");
  });

  test("the trigonometric functions that are logarithms", () => {
    check(fn("cot", x), "\\ln\\left|\\sin\\left(x\\right)\\right|");
    check(
      fn("csc", x),
      "-\\ln\\left|\\csc\\left(x\\right)+\\cot\\left(x\\right)\\right|"
    );
    check(fn("tanh", x), "\\ln\\left(\\cosh\\left(x\\right)\\right)");
  });
});

describe("powers of trigonometric functions", () => {
  test("the two that are derivatives of something in the table", () => {
    check(pow(fn("sec", x), number(2)), "\\tan\\left(x\\right)");
  });

  test("the squares, through the half-angle identity", () => {
    check(
      pow(fn("sin", x), number(2)),
      "\\frac{x}{2}-\\frac{\\sin\\left(2x\\right)}{4}"
    );
    // The doubled argument brings its own factor of two with it, which is
    // where the 8 comes from rather than a 4.
    check(
      pow(fn("cos", mul(number(2), x)), number(2)),
      "\\frac{x}{2}+\\frac{\\sin\\left(4x\\right)}{8}"
    );
    check(pow(fn("tan", x), number(2)), "\\tan\\left(x\\right)-x");
  });

  test("the odd powers, through 1 - cos^2 and a substitution", () => {
    check(
      pow(fn("sin", x), number(3)),
      "\\frac{\\cos\\left(x\\right)^{3}}{3}-\\cos\\left(x\\right)"
    );
    check(
      pow(fn("cos", x), number(5)),
      "\\sin\\left(x\\right)-\\frac{2\\sin\\left(x\\right)^{3}}{3}+\\frac{\\sin\\left(x\\right)^{5}}{5}"
    );
  });

  test("the secant cube, which is its own reduction formula", () => {
    check(
      pow(fn("sec", x), number(3)),
      "\\frac{\\sec\\left(x\\right)\\tan\\left(x\\right)+\\ln\\left|\\sec\\left(x\\right)+\\tan\\left(x\\right)\\right|}{2}"
    );
  });
});

describe("one polynomial over another, decided by the discriminant", () => {
  test("a negative discriminant is an arctangent", () => {
    check(
      div(number(1), add(pow(x, number(2)), number(4))),
      "\\frac{\\arctan\\left(\\frac{x}{2}\\right)}{2}"
    );
  });

  test("a positive one is a pair of logarithms", () => {
    check(
      div(number(1), sub(pow(x, number(2)), number(1))),
      "\\frac{\\ln\\left|\\frac{x-1}{x+1}\\right|}{2}"
    );
  });

  test("a repeated root is the power rule", () => {
    check(
      div(number(1), add(add(pow(x, number(2)), mul(number(2), x)), number(1))),
      "-\\frac{1}{x+1}"
    );
  });

  test("a linear numerator splits into a logarithm and the rest", () => {
    check(
      div(add(mul(number(2), x), number(3)), add(pow(x, number(2)), number(4))),
      "\\ln\\left|x^{2}+4\\right|+\\frac{3\\arctan\\left(\\frac{x}{2}\\right)}{2}"
    );
  });

  test("an improper fraction is divided first", () => {
    check(
      div(add(pow(x, number(2)), number(1)), add(x, number(1))),
      "\\frac{x^{2}}{2}-x+2\\ln\\left|x+1\\right|"
    );
    check(
      div(pow(x, number(3)), add(x, number(2))),
      "\\frac{x^{3}}{3}-x^{2}+4x-8\\ln\\left|x+2\\right|"
    );
  });

  test("a denominator written as factors keeps the textbook form", () => {
    // Both routes can do this one. The factor-based split gives the answer in
    // the book and the discriminant gives the answer in a table of integrals,
    // and the first is tried first for that reason.
    check(
      div(number(1), mul(x, sub(number(1), x))),
      "\\ln\\left|x\\right|-\\ln\\left|1-x\\right|"
    );
  });
});

describe("a root in the denominator", () => {
  test("the arcsine family", () => {
    check(
      div(number(3), fn("sqrt", sub(number(9), pow(x, number(2))))),
      "3\\arcsin\\left(\\frac{x}{3}\\right)"
    );
  });

  test("and its hyperbolic cousin", () => {
    check(
      div(number(1), fn("sqrt", add(pow(x, number(2)), number(1)))),
      "\\operatorname{arcsinh}\\left(x\\right)"
    );
  });

  test("a numerator that is not constant is refused rather than guessed", () => {
    // The check that stops `x^2/sqrt(1-x^2)` coming back as `x^2 arcsin(x)`,
    // which is not an antiderivative of anything. It goes to trigonometric
    // substitution instead, which does it properly.
    const integrand = div(
      pow(x, number(2)),
      fn("sqrt", sub(number(1), pow(x, number(2))))
    );
    check(
      integrand,
      "\\frac{\\arcsin\\left(x\\right)}{2}-\\frac{x\\sqrt{1-x^{2}}}{2}"
    );
  });
});

describe("integration by parts, and choosing which factor is u", () => {
  test("a logarithm or an inverse function is always u", () => {
    // Taking `dv = arctan x dx` produces a remaining integral containing
    // `x arctan x`, which is the integral being done. It recurses forever.
    check(
      mul(x, fn("arctan", x)),
      "\\frac{\\arctan\\left(x\\right)x^{2}}{2}-\\frac{x}{2}+\\frac{\\arctan\\left(x\\right)}{2}"
    );
  });

  test("even when the other factor is not a polynomial", () => {
    check(
      mul(fn("sqrt", x), fn("ln", x)),
      "\\frac{2\\ln\\left(x\\right)x^{\\frac{3}{2}}}{3}-\\frac{4x^{\\frac{3}{2}}}{9}"
    );
    check(
      mul(pow(x, number(2)), fn("ln", x)),
      "\\frac{\\ln\\left(x\\right)x^{3}}{3}-\\frac{x^{3}}{9}"
    );
  });

  test("the cyclic pair, which parts alone never finishes", () => {
    check(
      mul(pow(e, mul(number(2), x)), fn("sin", x)),
      "\\frac{e^{2x}\\left(2\\sin\\left(x\\right)-\\cos\\left(x\\right)\\right)}{5}"
    );
    check(
      mul(pow(e, x), fn("cos", mul(number(3), x))),
      "\\frac{e^{x}\\left(\\cos\\left(3x\\right)+3\\sin\\left(3x\\right)\\right)}{10}"
    );
  });
});

describe("trigonometric substitution, and coming back from it", () => {
  test("the quarter circle", () => {
    check(
      fn("sqrt", sub(number(1), pow(x, number(2)))),
      "\\frac{x\\sqrt{1-x^{2}}}{2}+\\frac{\\arcsin\\left(x\\right)}{2}"
    );
  });

  test("a doubled angle is opened before the substitution is undone", () => {
    // Integrating `sin^2` produces `sin(2t)`, which is not a function of `t`
    // that the back-substitution table can replace. `2 sin t cos t` is.
    check(
      div(pow(x, number(2)), fn("sqrt", sub(number(1), pow(x, number(2))))),
      "\\frac{\\arcsin\\left(x\\right)}{2}-\\frac{x\\sqrt{1-x^{2}}}{2}"
    );
  });

  test("the tangent case, which lands on a secant cube", () => {
    check(
      fn("sqrt", add(number(1), pow(x, number(2)))),
      "\\frac{\\sqrt{x^{2}+1}x+\\ln\\left|x+\\sqrt{x^{2}+1}\\right|}{2}"
    );
  });
});

describe("what it still refuses, and says so", () => {
  test("an integrand with no elementary antiderivative", () => {
    expect(() => integrate(fn("sin", pow(x, number(2))), "x")).toThrow(
      IntegrationError
    );
    expect(() => integrate(pow(e, pow(x, number(2))), "x")).toThrow(
      IntegrationError
    );
  });

  test("a product that is neither cyclic nor reducible", () => {
    expect(() => integrate(mul(fn("exp", x), fn("tan", x)), "x")).toThrow(
      IntegrationError
    );
  });

  test("a symbolic exponent, which could be the one the power rule misses", () => {
    expect(() => integrate(pow(x, id("n")), "x")).toThrow(IntegrationError);
  });
});

describe("partial fractions, in general rather than in two special cases", () => {
  test("three distinct linear factors", () => {
    check(
      div(
        number(1),
        mul(mul(add(x, number(1)), add(x, number(2))), add(x, number(3)))
      ),
      "\\frac{\\ln\\left|x+1\\right|}{2}+\\frac{\\ln\\left|x+3\\right|}{2}-\\ln\\left|x+2\\right|"
    );
  });

  test("a repeated factor, which needs a term over each power", () => {
    check(
      div(number(1), mul(x, pow(add(x, number(1)), number(2)))),
      "\\ln\\left|x\\right|-\\ln\\left|x+1\\right|+\\frac{1}{x+1}"
    );
  });

  test("a denominator that is not written as a product at all", () => {
    // `x^3 - x` has to be factored before it can be decomposed, which is the
    // rational root theorem doing the work.
    check(
      div(number(1), sub(pow(x, number(3)), x)),
      "\\frac{\\ln\\left|x+1\\right|}{2}-\\ln\\left|x\\right|+\\frac{\\ln\\left|x-1\\right|}{2}"
    );
  });

  test("an irreducible quadratic factor becomes an arctangent", () => {
    check(
      div(number(1), mul(pow(x, number(2)), add(pow(x, number(2)), number(1)))),
      "-\\arctan\\left(x\\right)-\\frac{1}{x}"
    );
  });

  test("a symbolic square in the denominator is still an arctangent", () => {
    // The one symbolic case a discriminant cannot decide and a square can:
    // `a^2` is not negative whatever `a` is.
    check(
      div(number(1), add(pow(x, number(2)), pow(id("a"), number(2)))),
      "\\frac{\\arctan\\left(\\frac{x}{a}\\right)}{a}",
      { a: 2.1 }
    );
  });
});

describe("products and powers of trigonometric functions", () => {
  test("an even power, through the half-angle identity twice", () => {
    check(
      pow(fn("sin", x), number(4)),
      "\\frac{3x}{8}-\\frac{\\sin\\left(2x\\right)}{4}+\\frac{\\sin\\left(4x\\right)}{32}"
    );
  });

  test("a mixed product, where an odd power decides the substitution", () => {
    check(
      mul(pow(fn("sin", x), number(2)), pow(fn("cos", x), number(3))),
      "\\frac{\\sin\\left(x\\right)^{3}}{3}-\\frac{\\sin\\left(x\\right)^{5}}{5}"
    );
    // Both even, so there is no factor to peel off and the half-angle
    // identities are the only way down.
    check(
      mul(pow(fn("sin", x), number(2)), pow(fn("cos", x), number(2))),
      "\\frac{x}{8}-\\frac{\\sin\\left(4x\\right)}{32}"
    );
  });

  test("a tangent and a secant, by reduction", () => {
    check(
      pow(fn("tan", x), number(4)),
      "x+\\frac{\\tan\\left(x\\right)^{3}}{3}-\\tan\\left(x\\right)"
    );
    check(
      pow(fn("sec", x), number(4)),
      "\\tan\\left(x\\right)+\\frac{\\tan\\left(x\\right)^{3}}{3}"
    );
  });

  test("two waves of different frequencies, by product to sum", () => {
    check(
      mul(fn("sin", mul(number(3), x)), fn("cos", mul(number(2), x))),
      "-\\frac{\\cos\\left(5x\\right)}{10}-\\frac{\\cos\\left(x\\right)}{2}"
    );
  });

  test("a factor that is not trigonometric comes along", () => {
    // `sin x cos x` is `sin(2x)/2`, which turns this into the cyclic pair.
    check(
      mul(pow(e, x), mul(fn("sin", x), fn("cos", x))),
      "\\frac{e^{x}\\left(\\sin\\left(2x\\right)-2\\cos\\left(2x\\right)\\right)}{10}"
    );
  });
});

describe("substitutions that run backwards", () => {
  test("a root of something linear becomes the new variable", () => {
    check(
      div(x, fn("sqrt", add(x, number(1)))),
      "\\frac{2\\left(x+1\\right)^{\\frac{3}{2}}}{3}-2\\sqrt{x+1}"
    );
    check(
      div(fn("sqrt", x), add(number(1), x)),
      "2\\sqrt{x}-2\\arctan\\left(\\sqrt{x}\\right)"
    );
    check(
      div(number(1), add(fn("sqrt", x), x)),
      "2\\ln\\left|\\sqrt{x}+1\\right|"
    );
  });

  test("a logarithm in the way becomes an exponential", () => {
    // `u = ln x` leaves the `x` in `dx` behind. `x = e^u` does not.
    check(
      fn("cos", fn("ln", x)),
      "\\frac{x\\left(\\cos\\left(\\ln\\left(x\\right)\\right)+\\sin\\left(\\ln\\left(x\\right)\\right)\\right)}{2}"
    );
  });

  test("a rational function of one angle, by the half-angle tangent", () => {
    check(
      div(number(1), add(number(1), fn("cos", x))),
      "\\tan\\left(\\frac{x}{2}\\right)"
    );
    check(
      div(number(1), add(number(2), fn("sin", x))),
      "\\frac{2\\arctan\\left(\\frac{2\\tan\\left(\\frac{x}{2}\\right)+1}{\\sqrt{3}}\\right)}{\\sqrt{3}}"
    );
  });

  test("a root of a quadratic, with the square completed first", () => {
    check(
      div(
        number(1),
        fn("sqrt", sub(sub(number(3), mul(number(2), x)), pow(x, number(2))))
      ),
      "\\arcsin\\left(\\frac{x+1}{2}\\right)"
    );
  });
});

describe("what had to be found rather than matched", () => {
  test("a substitution that is not a subexpression", () => {
    // `x/(x^4+1)` wants `u = x^2`, and `x^2` appears nowhere in it -- what
    // appears is `x^4`, which is `u^2`.
    check(
      div(x, add(pow(x, number(4)), number(1))),
      "\\frac{\\arctan\\left(x^{2}\\right)}{2}"
    );
    check(
      div(pow(e, x), add(pow(e, mul(number(2), x)), number(1))),
      "\\arctan\\left(e^{x}\\right)"
    );
  });

  test("a logarithm or an inverse function raised to a power", () => {
    check(
      pow(fn("ln", x), number(2)),
      "x\\ln\\left(x\\right)^{2}-2\\left(x\\ln\\left(x\\right)-x\\right)"
    );
    check(
      mul(x, pow(fn("ln", x), number(2))),
      "\\frac{\\ln\\left(x\\right)^{2}x^{2}}{2}-\\frac{\\ln\\left(x\\right)x^{2}}{2}+\\frac{x^{2}}{4}"
    );
  });

  test("a quotient handed to the product rules", () => {
    // Not a rational function, so `ln(x)/x^2` is `ln x` times `x^{-2}` and
    // integration by parts finishes it.
    check(
      div(fn("ln", x), pow(x, number(2))),
      "-\\frac{\\ln\\left(x\\right)}{x}-\\frac{1}{x}"
    );
  });
});
