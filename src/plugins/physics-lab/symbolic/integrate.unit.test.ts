/**
 * Every antiderivative here is checked twice: once against the LaTeX a person
 * would write, and once — the check that matters — by differentiating the
 * result numerically and comparing it back against the integrand.
 *
 * The second check is the one that catches a wrong answer. An antiderivative
 * off by a constant factor still looks entirely reasonable written down, and
 * the only thing that notices is differentiating it.
 */
import { integrate, IntegrationError, linearIn } from "./integrate";
import {
  agreesOnSamples,
  evaluate,
  numericDerivative,
  toLatex,
} from "../../../symbolic";
import { Aug, AugBuilders, buildConfig } from "../../../../text-mode-core";

const { binop, functionCall, id, negative, number } = AugBuilders;

type Node = Aug.Latex.AnyChild;

const cfg = buildConfig({
  // Deliberately without `abs`: Desmos has no \abs command, so listing it here
  // would let the emitter produce something a real calculator cannot read.
  // `toLatex` turns the resulting `\operatorname{abs}(…)` into bars anyway.
  commandNames: "sin cos tan sec csc cot ln log exp sqrt sinh cosh tanh",
});

const emit = (node: Node) => toLatex(cfg, node);

const x = id("x");
const mul = (a: Node, b: Node) => binop("Multiply", a, b);
const div = (a: Node, b: Node) => binop("Divide", a, b);
const add = (a: Node, b: Node) => binop("Add", a, b);
const sub = (a: Node, b: Node) => binop("Subtract", a, b);
const pow = (a: Node, b: Node) => binop("Exponent", a, b);
const fn = (name: string, arg: Node) => functionCall(id(name), [arg]);

const SAMPLES = [0.3, 0.7, 1.1, 1.9, 2.6, 3.3].map((value) => ({ x: value }));

/**
 * Differentiating the antiderivative has to give the integrand back. This is
 * the definition, and it is the only assertion here that could not be satisfied
 * by a plausible-looking wrong answer.
 */
function isAntiderivativeOf(result: Node, integrand: Node) {
  return agreesOnSamples(
    (bindings) => numericDerivative(result, "x", bindings),
    (bindings) => evaluate(integrand, bindings),
    SAMPLES
  );
}

function check(integrand: Node, expected: string) {
  const result = integrate(integrand, "x");
  expect(emit(result)).toBe(expected);
  expect(isAntiderivativeOf(result, integrand)).toBe(true);
}

describe("antiderivatives of what an AP course integrates", () => {
  test("the power rule, including the constant it hides", () => {
    check(x, "\\frac{x^{2}}{2}");
    check(pow(x, number(3)), "\\frac{x^{4}}{4}");
    check(number(5), "5x");
    // 2·(x²/2) must fold to x², or the answer is right and unreadable.
    check(mul(number(2), x), "x^{2}");
  });

  test("the power rule's exception is a logarithm, not a division by zero", () => {
    check(pow(x, number(-1)), "\\ln\\left|x\\right|");
    check(div(number(1), x), "\\ln\\left|x\\right|");
  });

  test("a sum integrates term by term", () => {
    check(add(mul(number(3), pow(x, number(2))), number(4)), "x^{3}+4x");
    check(sub(x, number(1)), "\\frac{x^{2}}{2}-x");
  });

  test("exponentials, which is what every growth problem becomes", () => {
    check(fn("exp", x), "\\exp\\left(x\\right)");
    check(pow(id("e"), x), "e^{x}");
    // The 1/k factor from a linear argument is the thing most often dropped.
    check(pow(id("e"), mul(number(3), x)), "\\frac{e^{3x}}{3}");
    check(pow(id("e"), negative(x)), "-e^{-x}");
  });

  test("trigonometry, with the sign that is easy to lose", () => {
    check(fn("sin", x), "-\\cos\\left(x\\right)");
    check(fn("cos", x), "\\sin\\left(x\\right)");
    check(fn("sin", mul(number(2), x)), "-\\frac{\\cos\\left(2x\\right)}{2}");
  });

  test("a polynomial times an exponential, by parts", () => {
    // The integral behind every `y = x - 1 + Ce^{-x}` in an answer key.
    check(mul(x, pow(id("e"), x)), "xe^{x}-e^{x}");
    // Reordered so the sum does not open with a negative term, which is also
    // how a textbook prints this one.
    check(mul(x, fn("sin", x)), "\\sin\\left(x\\right)-x\\cos\\left(x\\right)");
  });

  test("a linear argument brings its reciprocal factor with it", () => {
    check(
      pow(add(mul(number(2), x), number(1)), number(3)),
      "\\frac{\\left(2x+1\\right)^{4}}{8}"
    );
    check(div(number(1), add(x, number(1))), "\\ln\\left|x+1\\right|");
  });

  test("a constant that is not the variable is carried through", () => {
    // `k` is a parameter here, not the variable of integration, so it has to be
    // bound before the derivative check has anything to evaluate against.
    const withParameters = SAMPLES.map((sample) => ({
      ...sample,
      k: 2.5,
      y: 1.5,
    }));
    const integrand = mul(id("k"), x);
    const result = integrate(integrand, "x");
    expect(emit(result)).toBe("\\frac{kx^{2}}{2}");
    expect(
      agreesOnSamples(
        (bindings) => numericDerivative(result, "x", bindings),
        (bindings) => evaluate(integrand, bindings),
        withParameters
      )
    ).toBe(true);
    // Everything free of x is one constant, however many names it is spelled
    // with.
    expect(emit(integrate(mul(id("k"), id("y")), "x"))).toBe("kyx");
  });

  test("partial fractions, which is what separating the logistic asks for", () => {
    // 1/(x(1-x)) integrates to ln|x| - ln|1-x|, with the 1/D factor equal to 1.
    check(
      div(number(1), mul(x, sub(number(1), x))),
      "\\ln\\left|x\\right|-\\ln\\left|1-x\\right|"
    );
    // Here D is -1, so the two logarithms come back the other way round.
    check(
      div(number(1), mul(x, sub(x, number(1)))),
      "\\ln\\left|x-1\\right|-\\ln\\left|x\\right|"
    );
  });

  test("a repeated factor goes to the power rule, not to partial fractions", () => {
    // 1/((x+1)(x+1)) has D = 0, so partial fractions declines it. Collapsing
    // the repeat into (x+1)^2 hands it to the power rule, which is where it
    // always belonged.
    const repeated = integrate(
      div(number(1), mul(add(x, number(1)), add(x, number(1)))),
      "x"
    );
    expect(
      agreesOnSamples(
        (bindings) => numericDerivative(repeated, "x", bindings),
        (bindings) =>
          evaluate(
            div(number(1), mul(add(x, number(1)), add(x, number(1)))),
            bindings
          ),
        SAMPLES
      )
    ).toBe(true);
  });

  test("what it cannot do exactly, it refuses by name", () => {
    // No elementary antiderivative exists at all.
    expect(() => integrate(fn("sin", pow(x, number(2))), "x")).toThrow(
      IntegrationError
    );
    // Parts only terminates against a polynomial, and a product of two
    // transcendentals recurses forever. The one pair that does not is
    // `e^{ax}` against a sine or cosine, which has its own rule below.
    expect(() => integrate(mul(fn("exp", x), fn("tan", x)), "x")).toThrow(
      IntegrationError
    );
    // A symbolic exponent could be -1, where the power rule does not hold.
    expect(() => integrate(pow(x, id("n")), "x")).toThrow(IntegrationError);
    // x in both base and exponent.
    expect(() => integrate(pow(x, x), "x")).toThrow(IntegrationError);
  });
});

describe("recognising a linear argument", () => {
  const linear = (node: Node) => {
    const found = linearIn(node, "x");
    return found === undefined
      ? undefined
      : { a: emit(found.a), b: emit(found.b) };
  };

  test("the shapes people actually write", () => {
    expect(linear(x)).toEqual({ a: "1", b: "0" });
    expect(linear(mul(number(3), x))).toEqual({ a: "3", b: "0" });
    expect(linear(add(mul(number(2), x), number(1)))).toEqual({
      a: "2",
      b: "1",
    });
    expect(linear(sub(number(1), x))).toEqual({ a: "-1", b: "1" });
    expect(linear(div(x, number(2)))).toEqual({ a: "\\frac{1}{2}", b: "0" });
    // Free of x entirely, so the slope is zero.
    expect(linear(id("k"))).toEqual({ a: "0", b: "k" });
  });

  test("and refuses what is not linear", () => {
    expect(linear(pow(x, number(2)))).toBeUndefined();
    expect(linear(mul(x, x))).toBeUndefined();
    expect(linear(fn("sin", x))).toBeUndefined();
  });
});

describe("integrals that only work once the integrand is multiplied out", () => {
  test("a product of binomials, which has no rule of its own", () => {
    // There is no product rule for integrals. `(x+1)(x+2)` written out is
    // `x²+3x+2`, and that is three applications of the power rule.
    check(
      mul(add(x, number(1)), add(x, number(2))),
      "\\frac{x^{3}}{3}+\\frac{3x^{2}}{2}+2x"
    );
  });

  test("a quotient with the variable on both sides of the bar", () => {
    // Refused as it stands, and `x + 1/x` once the fraction is split.
    check(
      div(add(pow(x, number(2)), number(1)), x),
      "\\frac{x^{2}}{2}+\\ln\\left|x\\right|"
    );
  });

  test("a sum times a function, term by term", () => {
    const integrand = mul(add(x, number(1)), fn("cos", x));
    const result = integrate(integrand, "x");
    // Parts handles the `x·cos x` half; the expansion is what gets it there.
    expect(isAntiderivativeOf(result, integrand)).toBe(true);
  });

  test("a power that already has a rule keeps the answer that rule gives", () => {
    // `(x+1)^7` is `(x+1)^8/8`, not eight terms of the same function. The
    // expansion is a fallback, so it never gets the chance to make an answer
    // worse than the one the rules produce.
    check(
      pow(add(x, number(1)), number(7)),
      "\\frac{\\left(x+1\\right)^{8}}{8}"
    );
  });

  test("and expanding does not turn a refusal into a guess", () => {
    // `sin(x²)` has no elementary antiderivative, expanded or not, and the
    // message that comes back is the one about the expression as written.
    expect(() => integrate(fn("sin", pow(x, number(2))), "x")).toThrow(
      IntegrationError
    );
    expect(() =>
      integrate(mul(fn("sin", pow(x, number(2))), add(x, number(1))), "x")
    ).toThrow(IntegrationError);
  });
});

describe("a function of its inverse, simplified before integrating", () => {
  test("sin(arcsin x) is x, where it is defined", () => {
    // Refused once as the sine of something that is not linear.
    const integrand = fn("sin", fn("arcsin", x));
    const result = integrate(integrand, "x");
    expect(emit(result)).toBe(String.raw`\frac{x^{2}}{2}`);
    expect(
      agreesOnSamples(
        (b) => numericDerivative(result, "x", b),
        (b) => evaluate(integrand, b),
        [0.1, 0.4, 0.8].map((v) => ({ x: v }))
      )
    ).toBe(true);
  });

  test("cos(arcsin x) is the root of 1 − x²", () => {
    expect(emit(integrate(fn("cos", fn("arcsin", x)), "x"))).toBe(
      emit(integrate(fn("sqrt", sub(number(1), pow(x, number(2)))), "x"))
    );
  });
});
