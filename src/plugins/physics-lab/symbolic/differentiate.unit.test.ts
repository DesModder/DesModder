/**
 * Every derivative here is checked twice: against the form a course writes, and
 * — the check that matters — against a numerical derivative of the original.
 *
 * The second one is what catches a wrong answer. A derivative with a sign
 * flipped or a chain factor dropped reads perfectly well, and only evaluating
 * it notices.
 *
 * A third set of assertions is about the *derivation*, because which rule gets
 * applied where, and how many cards that costs, is half of what this module is
 * for. `3x²` has a correct derivation through the product rule and nobody
 * writes it that way; `3x` has a correct derivation in two steps and nobody
 * spends two steps on it.
 */
import {
  differentiate,
  DifferentiationError,
  hintsFor,
  implicitDerivative,
  RULE_DERIVATIONS,
  stepsOf,
  type DerivationNode,
} from "./differentiate";
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
 *
 * They also all sit below π/3, so `sin 3x` is positive across the whole set and
 * the variable-power cases are real-valued where they are tested.
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
    check(pow(x, div(number(1), number(2))), "\\frac{x^{-\\frac{1}{2}}}{2}");
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

/**
 * The nested cases, which are the ones a wrong dispatch gets wrong. Each is
 * only checked numerically: the tidy form of some of these answers is a matter
 * of taste, and whether they are *right* is not.
 */
describe("expressions with a rule inside a rule", () => {
  const nested: [string, Node][] = [
    ["sin(x²)", fn("sin", pow(x, number(2)))],
    ["x sin x", mul(x, fn("sin", x))],
    ["x / sin x", div(x, fn("sin", x))],
    ["x^x", pow(x, x)],
    ["(sin x)^x", pow(fn("sin", x), x)],
    ["(sin 3x)^(e^x)", pow(fn("sin", mul(number(3), x)), pow(id("e"), x))],
    ["ln(sin x)", fn("ln", fn("sin", x))],
    ["e^(x²)", pow(id("e"), pow(x, number(2)))],
    ["sqrt(x² + 1)", fn("sqrt", add(pow(x, number(2)), number(1)))],
    ["tan(x³)", fn("tan", pow(x, number(3)))],
    ["x^(sin x)", pow(x, fn("sin", x))],
    ["sin(x e^x)", fn("sin", mul(x, pow(id("e"), x)))],
    [
      "x²(sin 3x)^(e^x)",
      mul(
        pow(x, number(2)),
        pow(fn("sin", mul(number(3), x)), pow(id("e"), x))
      ),
    ],
  ];

  test.each(nested)("%s", (_name, node) => {
    checkValue(node);
  });
});

describe("which rule gets used, which is half the point", () => {
  const stepsIn = (node: Node) => stepsOf(derive(node).root).map((s) => s.step);
  const rulesFor = (node: Node) => stepsIn(node).map((s) => s.rule);

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

  test("a power with a whole expression under it is named for both rules", () => {
    // Calling this one "the power rule" is the omission that loses the factor
    // of 3, so it gets its own name and its own formula.
    expect(
      rulesFor(pow(add(mul(number(3), x), number(1)), number(4)))
    ).toContain("power-chain");
    expect(rulesFor(pow(x, number(4)))).not.toContain("power-chain");
  });

  test("the variable in both places is neither", () => {
    expect(rulesFor(pow(x, x))).toContain("logarithmic-differentiation");
    expect(rulesFor(pow(x, x))).not.toContain("power");
    expect(rulesFor(pow(x, x))).not.toContain("exponential");
  });

  test("the whole dispatch of the nested example, in order", () => {
    const node = mul(
      pow(x, number(2)),
      pow(fn("sin", mul(number(3), x)), pow(id("e"), x))
    );
    expect(rulesFor(node)).toEqual([
      "product",
      "power",
      "logarithmic-differentiation",
      "chain",
      "linear",
      "exponential",
    ]);
  });
});

describe("how much of the derivation a step is", () => {
  const stepsIn = (node: Node) => stepsOf(derive(node).root).map((s) => s.step);
  const shown = (node: Node) =>
    stepsIn(node).filter((step) => step.importance !== "atomic");

  test("a linear term is one fact, not a coefficient plus a derivative of 1", () => {
    const steps = stepsIn(mul(number(3), x));
    expect(steps).toHaveLength(1);
    expect(steps[0].rule).toBe("linear");
    expect(emit(steps[0].after)).toBe("3");
  });

  test("a sum of four terms is one step with four children", () => {
    const node = add(
      sub(
        add(pow(x, number(4)), mul(number(3), pow(x, number(2)))),
        mul(number(7), x)
      ),
      number(2)
    );
    const { root } = derive(node);
    expect(root.rule).toBe("sum");
    expect(root.children).toHaveLength(4);
    // And it is still the right answer.
    check(node, "4x^{3}+6x-7");
  });

  test("the nested example shows three steps, not seven", () => {
    // Every atomic fact is still in the tree for the full view; what changes is
    // what a reader is shown before asking for more.
    const node = mul(pow(x, number(2)), fn("sin", mul(number(3), x)));
    expect(stepsIn(node)).toHaveLength(4);
    expect(shown(node).map((step) => step.title)).toEqual([
      "Product rule",
      "Power rule",
      "Chain rule",
    ]);
  });
});

describe("what a step carries besides its name", () => {
  const root = (node: Node) => derive(node).root;

  test("the product rule names its two factors", () => {
    const step = root(mul(pow(x, number(2)), fn("sin", x)));
    expect(step.substitutions.map((s) => s.symbol)).toEqual(["u", "v"]);
    expect(step.substitutions.map((s) => emit(s.value))).toEqual([
      "x^{2}",
      "\\operatorname{sin}\\left(x\\right)",
    ]);
    // And the names reach the children, so a sub-derivation can be headed
    // "Differentiate u" rather than merely "Differentiate".
    expect(step.childRoles).toEqual(["u", "v"]);
  });

  test("the chain rule names an outer function and an inner one", () => {
    // "Multiply by the derivative of the inside" does not scale: a reader
    // meeting sin(e^{x²+1}) has three insides and no way to say which.
    const step = root(fn("sin", mul(number(3), x)));
    expect(step.substitutions.map((s) => s.symbol)).toEqual(["outer", "u"]);
    expect(step.substitutions.map((s) => emit(s.value))).toEqual([
      "\\operatorname{sin}\\left(u\\right)",
      "3x",
    ]);
    expect(step.childRoles).toEqual(["u"]);
  });

  test("the power rule says why it may be used, and names the exponent", () => {
    // The same expression can hold x² and a variable exponent at once, so
    // "bring the exponent down" on its own is a rule the reader misapplies.
    expect(root(pow(x, number(2))).recognition).toBe(
      "The exponent 2 is constant and the base is x itself, so the ordinary power rule applies."
    );
    expect(root(pow(fn("sin", x), x)).recognition).toContain(
      "neither the ordinary power rule nor the ordinary exponential rule is sufficient"
    );
  });

  test("logarithmic differentiation can show where it comes from", () => {
    // Nobody guesses u^v(v'ln u + vu'/u); everybody can follow taking logs.
    const lines = RULE_DERIVATIONS["logarithmic-differentiation"];
    expect(lines).toBeDefined();
    expect(lines).toHaveLength(4);
    for (const line of lines!) expect(line.note).not.toMatch(/[\\{}^_]/);
  });

  test("a structural rule shows itself applied before it shows the answer", () => {
    // The line a worked solution writes: two smaller problems, not one big one.
    const step = root(mul(pow(x, number(2)), fn("sin", x)));
    expect(step.intermediate).toBeDefined();
    expect(emit(step.intermediate!)).toBe(
      "\\frac{d}{dx}\\left(x^{2}\\right)\\operatorname{sin}\\left(x\\right)+" +
        "x^{2}\\left(\\frac{d}{dx}\\left(\\operatorname{sin}\\left(x\\right)\\right)\\right)"
    );
  });

  test("logarithmic differentiation says what it assumed", () => {
    const { domain } = derive(
      pow(fn("sin", mul(number(3), x)), pow(id("e"), x))
    );
    expect(domain).toHaveLength(1);
    expect(domain[0].requirement).toBe("positive");
    expect(emit(domain[0].expression)).toBe(
      "\\operatorname{sin}\\left(3x\\right)"
    );
  });

  test("an ordinary derivative assumes nothing worth saying", () => {
    // A note that appears on every answer is one nobody reads on the answer
    // where it matters.
    expect(derive(mul(pow(x, number(2)), fn("sin", x))).domain).toEqual([]);
  });
});

/**
 * The prose is prose. An earlier version built these sentences with the LaTeX
 * emitter, and what reached the screen was `\operatorname{sin}\left(3x\right)`
 * as literal text beside the maths it was describing.
 */
describe("the explanation is written in words", () => {
  const everyStep = (node: Node): DerivationNode[] =>
    stepsOf(derive(node).root).map((entry) => entry.step);

  const expressions: Node[] = [
    mul(x, fn("sin", x)),
    div(fn("sin", x), x),
    pow(x, x),
    pow(add(mul(number(3), x), number(1)), number(4)),
    add(pow(x, number(2)), fn("ln", x)),
  ];

  test("every step says what it recognised and what it did", () => {
    for (const expression of expressions) {
      for (const step of everyStep(expression)) {
        expect(step.title.length).toBeGreaterThan(0);
        expect(step.recognition.length).toBeGreaterThan(0);
      }
    }
  });

  test("no sentence contains LaTeX", () => {
    for (const expression of expressions) {
      for (const step of everyStep(expression)) {
        expect(step.recognition).not.toMatch(/[\\{}^_]/);
        expect(step.detail).not.toMatch(/[\\{}^_]/);
      }
    }
  });
});

describe("hints, for the problem the reader is asked to try", () => {
  const node = mul(
    pow(x, number(2)),
    pow(fn("sin", mul(number(3), x)), pow(id("e"), x))
  );

  test("they escalate: the shape, then the pieces, then the hard part", () => {
    const hints = hintsFor(derive(node).root);
    expect(hints).toHaveLength(3);

    // First a question, answering nothing. The recognition is the exercise, so
    // a hint that performs it has ended the exercise.
    expect(hints[0].text).toBe("What are the two factors of the product?");
    expect(hints[0].show).toEqual([]);

    // Then the pieces, which is the answer to the first question.
    expect(hints[1].show.map(emit)).toEqual([
      "x^{2}",
      "\\operatorname{sin}\\left(3x\\right)^{e^{x}}",
    ]);

    // Then a question about whichever piece is actually hard, and it points at
    // that piece rather than at the whole expression.
    expect(hints[2].text).toContain("base and the exponent");
    expect(hints[2].show.map(emit)).toEqual([
      "\\operatorname{sin}\\left(3x\\right)^{e^{x}}",
    ]);
  });

  test("a hint is prose, never LaTeX", () => {
    for (const hint of hintsFor(derive(node).root))
      expect(hint.text).not.toMatch(/[\\{}^_]/);
  });

  test("nothing is given away for an expression with no structure", () => {
    // "The derivative of x is 1" as a hint has helped nobody.
    expect(hintsFor(derive(mul(number(3), x)).root)).toEqual([]);
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
