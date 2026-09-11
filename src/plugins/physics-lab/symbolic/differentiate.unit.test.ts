/**
 * Every derivative here is checked twice: against the form a course writes, and
 * — the check that matters — against a numerical derivative of the original.
 *
 * The second one is what catches a wrong answer. A derivative with a sign
 * flipped or a chain factor dropped reads perfectly well, and only evaluating
 * it notices.
 *
 * A third set of assertions is about the *steps*, because which rule gets
 * applied where is half of what this module is for. `3x²` has a correct
 * derivation through the product rule and nobody writes it that way.
 */
import {
  differentiate,
  DifferentiationError,
  implicitDerivative,
} from "./differentiate";
import { agreesOnSamples, evaluate, numericDerivative } from "./evaluate";
import { toLatex } from "./latex";
import { Aug, AugBuilders, buildConfig } from "../../../../text-mode-core";

const { binop, functionCall, id, number } = AugBuilders;

type Node = Aug.Latex.AnyChild;

const cfg = buildConfig({
  commandNames: "sqrt pi",
});

const emit = (node: Node) => toLatex(cfg, node);

const x = id("x");
const y = id("y");
const mul = (a: Node, b: Node) => binop("Multiply", a, b);
const div = (a: Node, b: Node) => binop("Divide", a, b);
const add = (a: Node, b: Node) => binop("Add", a, b);
const sub = (a: Node, b: Node) => binop("Subtract", a, b);
const pow = (a: Node, b: Node) => binop("Exponent", a, b);
const fn = (name: string, arg: Node) => functionCall(id(name), [arg]);

/**
 * Points chosen to stay inside the domains of logs, roots and arcsin, with `k`
 * bound so that an expression containing a parameter can be evaluated at all.
 * Unbound, it is NaN everywhere and the numeric check passes by never having
 * tested anything.
 */
const SAMPLES = [0.12, 0.31, 0.47, 0.63, 0.78, 0.91].map((v) => ({
  x: v,
  k: 1.7,
}));

const derive = (node: Node) => differentiate(cfg, node, "x");

/** The derivative has to agree with a numerical one. This is the definition. */
function isDerivativeOf(result: Node, original: Node) {
  return agreesOnSamples(
    (bindings) => evaluate(result, bindings),
    (bindings) => numericDerivative(original, "x", bindings),
    SAMPLES,
    1e-4
  );
}

function check(original: Node, expected: string) {
  const { result } = derive(original);
  expect(emit(result)).toBe(expected);
  expect(isDerivativeOf(result, original)).toBe(true);
}

/** Just the numeric check, for answers whose tidy form is not the point. */
function checkValue(original: Node) {
  const { result } = derive(original);
  expect(isDerivativeOf(result, original)).toBe(true);
}

describe("the rules every course starts with", () => {
  test("constants and the variable itself", () => {
    check(number(7), "0");
    check(id("k"), "0");
    check(x, "1");
  });

  test("the power rule", () => {
    check(pow(x, number(3)), "3x^{2}");
    check(pow(x, number(-2)), "-\\frac{2}{x^{3}}");
    // The exponent drops by one exactly, without the fraction ever becoming
    // 0.5 on the way.
    check(pow(x, div(number(1), number(2))), "\\frac{1}{2}x^{-\\frac{1}{2}}");
  });

  test("constant multiples, and sums", () => {
    check(mul(number(3), pow(x, number(2))), "6x");
    check(add(pow(x, number(2)), x), "2x+1");
    check(sub(pow(x, number(3)), mul(number(4), x)), "3x^{2}-4");
  });

  test("the product rule", () => {
    // `sin` is one of Desmos's operator names rather than one of its LaTeX
    // commands, so the emitter writes `\operatorname{sin}` — which is exactly
    // what Desmos itself writes, and what it parses back.
    check(
      mul(x, fn("sin", x)),
      "\\operatorname{sin}\\left(x\\right)+x\\operatorname{cos}\\left(x\\right)"
    );
  });

  test("the quotient rule", () => {
    checkValue(div(fn("sin", x), x));
    checkValue(div(x, add(x, number(1))));
  });

  test("the chain rule", () => {
    checkValue(fn("sin", pow(x, number(2))));
    checkValue(pow(add(mul(number(3), x), number(1)), number(4)));
    checkValue(fn("ln", add(pow(x, number(2)), number(1))));
  });
});

describe("every function in the table differentiates to something true", () => {
  const singleArgument = [
    "sin",
    "cos",
    "tan",
    "cot",
    "sec",
    "csc",
    "arcsin",
    "arctan",
    "sinh",
    "cosh",
    "tanh",
    "coth",
    "sech",
    "csch",
    "arcsinh",
    "arctanh",
    "exp",
    "ln",
    "log",
    "sqrt",
  ];

  test.each(singleArgument)("%s", (name) => {
    // Composed with 2x, so the chain rule is exercised at the same time.
    checkValue(fn(name, mul(number(2), x)));
  });

  test("arccos, which differs from arcsin only by a sign", () => {
    checkValue(fn("arccos", mul(number(0.5), x)));
  });

  test("the inverse functions whose domain starts above 1", () => {
    const big = [{ x: 1.4 }, { x: 1.9 }, { x: 2.6 }, { x: 3.3 }];
    for (const name of ["arcsec", "arccsc", "arccosh"]) {
      const original = fn(name, x);
      const { result } = derive(original);
      expect(
        agreesOnSamples(
          (b) => evaluate(result, b),
          (b) => numericDerivative(original, "x", b),
          big,
          1e-4
        )
      ).toBe(true);
    }
  });
});

describe("exponentials, where the variable can be in either place", () => {
  test("e to the x is its own derivative", () => {
    check(pow(id("e"), x), "e^{x}");
  });

  test("a general base brings a logarithm", () => {
    checkValue(pow(number(2), x));
    checkValue(pow(number(2), mul(number(3), x)));
  });

  test("x to the x needs logarithmic differentiation", () => {
    checkValue(pow(x, x));
  });
});

describe("which rule gets used, which is half the point", () => {
  const rulesFor = (node: Node) => derive(node).steps.map((s) => s.rule);

  test("a coefficient is a constant multiple, not a product", () => {
    // The product rule is correct here and produces 0·x² + 3·2x.
    expect(rulesFor(mul(number(3), pow(x, number(2))))).toContain(
      "constant-multiple"
    );
    expect(rulesFor(mul(number(3), pow(x, number(2))))).not.toContain(
      "product"
    );
  });

  test("dividing by a constant is a constant multiple, not a quotient", () => {
    expect(rulesFor(div(pow(x, number(2)), number(5)))).not.toContain(
      "quotient"
    );
  });

  test("a bare variable inside needs no chain step", () => {
    expect(rulesFor(fn("sin", x))).not.toContain("chain");
    expect(rulesFor(fn("sin", pow(x, number(2))))).toContain("chain");
  });

  test("the variable upstairs is exponential, not power", () => {
    expect(rulesFor(pow(number(2), x))).toContain("exponential-base");
    expect(rulesFor(pow(number(2), x))).not.toContain("power");
    expect(rulesFor(pow(x, number(2)))).toContain("power");
  });

  test("the variable in both places is neither", () => {
    expect(rulesFor(pow(x, x))).toContain("logarithmic-differentiation");
  });

  test("every step says what it did", () => {
    for (const step of derive(mul(x, fn("sin", x))).steps) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.detail.length).toBeGreaterThan(0);
    }
  });
});

describe("implicit differentiation", () => {
  test("the circle", () => {
    // x² + y² = 25 has dy/dx = -x/y.
    const { result } = implicitDerivative(
      cfg,
      add(pow(x, number(2)), pow(y, number(2))),
      number(25),
      "x",
      "y"
    );
    expect(emit(result)).toBe("-\\frac{x}{y}");
  });
});

describe("what it refuses", () => {
  test("a function it does not know", () => {
    expect(() => derive(fn("erf", x))).toThrow(DifferentiationError);
  });

  test("a list, an integral, anything that is not an expression", () => {
    expect(() => derive(fn("mod", x))).toThrow(DifferentiationError);
  });
});
