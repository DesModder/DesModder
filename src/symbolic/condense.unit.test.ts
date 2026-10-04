/**
 * The factoriser rewrites an answer into the form somebody writes down, which
 * makes it the one piece of `symbolic/` whose output is a matter of taste — so
 * every case here asserts two separate things.
 *
 * The **shape** assertion says the taste is right: that the common factor came
 * out, that the quotient became a cotangent. Those can be argued with.
 *
 * The **value** assertion says it is still the same function, checked at a
 * spread of points. That one cannot. A factoriser that drops a term or loses a
 * sign produces something shorter and plausible, and only evaluating it notices
 * — which is exactly the failure the rest of this directory is built to catch.
 */
import { condense } from "./condense";
import { agreesOnSamples, evaluate } from "./evaluate";
import { toLatex } from "./latex";
import { Aug, AugBuilders, buildConfig } from "../../text-mode-core";

const { binop, functionCall, id, number } = AugBuilders;

type Node = Aug.Latex.AnyChild;

const cfg = buildConfig({ commandNames: "sqrt pi" });
const emit = (node: Node) => toLatex(cfg, node);

const x = id("x");
const mul = (a: Node, b: Node) => binop("Multiply", a, b);
const div = (a: Node, b: Node) => binop("Divide", a, b);
const add = (a: Node, b: Node) => binop("Add", a, b);
const sub = (a: Node, b: Node) => binop("Subtract", a, b);
const pow = (a: Node, b: Node) => binop("Exponent", a, b);
const fn = (name: string, arg: Node) => functionCall(id(name), [arg]);

/** Below π/3, so `sin 3x` is positive and every case here is real there. */
const SAMPLES = [0.13, 0.29, 0.44, 0.61, 0.77, 0.93].map((v) => ({ x: v }));

/** Shorter is only allowed to mean shorter. It has to be the same function. */
function sameFunction(before: Node, after: Node) {
  return agreesOnSamples(
    (bindings) => evaluate(before, bindings),
    (bindings) => evaluate(after, bindings),
    SAMPLES,
    1e-9
  );
}

function check(original: Node, expected: string) {
  const { node } = condense(original);
  expect(emit(node)).toBe(expected);
  expect(sameFunction(original, node)).toBe(true);
}

describe("pulling out what every term shares", () => {
  test("a shared identifier", () => {
    // 3x + x·sin(x) is x(3 + sin x).
    check(
      add(mul(number(3), x), mul(x, fn("sin", x))),
      "x\\left(3+\\operatorname{sin}\\left(x\\right)\\right)"
    );
  });

  test("a shared function call", () => {
    check(
      add(mul(number(2), fn("exp", x)), mul(x, fn("exp", x))),
      "\\operatorname{exp}\\left(x\\right)\\left(2+x\\right)"
    );
  });

  test("a shared factor over a fraction bar", () => {
    // f divides a·f + b·f/g, and the result keeps the division where it was.
    const original = add(
      mul(number(2), fn("sin", x)),
      div(mul(number(3), fn("sin", x)), x)
    );
    const { node } = condense(original);
    expect(sameFunction(original, node)).toBe(true);
    expect(emit(node)).toBe(
      "\\operatorname{sin}\\left(x\\right)\\left(2+\\frac{3}{x}\\right)"
    );
  });

  test("signs survive", () => {
    // The sign is a factor of -1 in the flattened list, so it has to come back
    // attached to the right term and not to the one beside it.
    const original = sub(mul(number(5), x), mul(x, fn("cos", x)));
    check(original, "x\\left(5-\\operatorname{cos}\\left(x\\right)\\right)");
  });

  test("three terms, all sharing", () => {
    const original = add(
      add(mul(x, fn("sin", x)), mul(number(2), fn("sin", x))),
      mul(fn("exp", x), fn("sin", x))
    );
    const { node } = condense(original);
    expect(sameFunction(original, node)).toBe(true);
    expect(emit(node)).toContain("\\operatorname{sin}\\left(x\\right)\\left(");
  });
});

describe("what it leaves alone", () => {
  test("a numeric factor, which is shorter left where it is", () => {
    // 2x + 4x² would become 2x(1 + 2x), which nobody writes.
    const original = add(mul(number(2), x), mul(number(4), pow(x, number(2))));
    expect(emit(condense(original).node)).toBe("2x+4x^{2}");
  });

  test("powers of a shared base, which is a different problem", () => {
    // Pulling x² out of x³ + x² is the first step of factoring to find roots,
    // and doing it silently inside an answer helps nobody.
    const original = add(pow(x, number(3)), pow(x, number(2)));
    expect(emit(condense(original).node)).toBe("x^{3}+x^{2}");
  });

  test("terms with nothing in common", () => {
    const original = add(fn("sin", x), fn("exp", x));
    const { node, notes } = condense(original);
    expect(emit(node)).toBe(
      "\\operatorname{sin}\\left(x\\right)+\\operatorname{exp}\\left(x\\right)"
    );
    // No notes is the signal the panel uses to offer no choice at all.
    expect(notes).toEqual([]);
  });
});

describe("the quotient identities", () => {
  test("cosine over sine is cotangent", () => {
    check(
      div(fn("cos", mul(number(3), x)), fn("sin", mul(number(3), x))),
      "\\operatorname{cot}\\left(3x\\right)"
    );
  });

  test("sine over cosine is tangent", () => {
    check(
      div(fn("sin", x), fn("cos", x)),
      "\\operatorname{tan}\\left(x\\right)"
    );
  });

  test("it only fires when both halves have the same argument", () => {
    const original = div(fn("cos", mul(number(2), x)), fn("sin", x));
    expect(emit(condense(original).node)).toBe(
      "\\frac{\\operatorname{cos}\\left(2x\\right)}{\\operatorname{sin}\\left(x\\right)}"
    );
  });

  test("the rest of the fraction is kept", () => {
    // 3·cos(3x)/sin(3x) is 3cot(3x), not cot(3x).
    const original = div(
      mul(number(3), fn("cos", mul(number(3), x))),
      fn("sin", mul(number(3), x))
    );
    check(original, "3\\operatorname{cot}\\left(3x\\right)");
  });
});

describe("the derivative this was written for", () => {
  /**
   * What differentiating `x²(sin 3x)^{eˣ}` produces, as the rules leave it. The
   * form a person writes is three passes away: the outer power comes out, which
   * exposes the `eˣ` in the sum inside, and the quotient left behind is a
   * cotangent.
   */
  const base = fn("sin", mul(number(3), x));
  const varying = pow(base, pow(id("e"), x));
  const original = add(
    mul(mul(number(2), x), varying),
    mul(
      pow(x, number(2)),
      mul(
        varying,
        add(
          mul(pow(id("e"), x), fn("ln", base)),
          div(
            mul(pow(id("e"), x), mul(number(3), fn("cos", mul(number(3), x)))),
            base
          )
        )
      )
    )
  );

  test("comes out as the form in the textbook", () => {
    const { node, notes } = condense(original);
    expect(sameFunction(original, node)).toBe(true);
    expect(emit(node)).toBe(
      "\\left(\\operatorname{sin}\\left(3x\\right)\\right)^{e^{x}}\\left(2x+x^{2}e^{x}" +
        "\\left(\\operatorname{ln}\\left(\\operatorname{sin}\\left(3x\\right)\\right)+" +
        "3\\operatorname{cot}\\left(3x\\right)\\right)\\right)"
    );
    // And it says what it did, so the shorter form is not a form the reader has
    // to reverse-engineer.
    expect(notes.length).toBeGreaterThanOrEqual(2);
    expect(notes.map((note) => note.text)).toContain(
      "Rewrite cos over sin as cot."
    );
  });
});
