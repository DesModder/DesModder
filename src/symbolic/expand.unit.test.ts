/**
 * Expansion is the one rewrite here that can be wrong in a way that still looks
 * right. A dropped term or a lost sign in `(x+1)(x-2)` produces a perfectly
 * ordinary quadratic, and nothing about the shape of it says which quadratic it
 * was supposed to be — so, as in `condense.unit.test.ts`, every case asserts
 * two separate things.
 *
 * The **shape** assertion says the form is the one wanted. That is arguable.
 *
 * The **value** assertion says it is still the same function, checked at a
 * spread of points. That is not.
 */
import { expand, EXPANSION_LIMIT, forTesting } from "./expand";
import { agreesOnSamples, evaluate } from "./evaluate";
import { fold } from "./fold";
import { nodeCount, type Node } from "./tree";
import { toLatex } from "./latex";
import { AugBuilders, buildConfig } from "../../text-mode-core";

const { binop, functionCall, id, number, negative } = AugBuilders;

const cfg = buildConfig({ commandNames: "sqrt pi" });
const emit = (node: Node) => toLatex(cfg, node);

const x = id("x");
const mul = (a: Node, b: Node) => binop("Multiply", a, b);
const div = (a: Node, b: Node) => binop("Divide", a, b);
const add = (a: Node, b: Node) => binop("Add", a, b);
const sub = (a: Node, b: Node) => binop("Subtract", a, b);
const pow = (a: Node, b: Node) => binop("Exponent", a, b);
const fn = (name: string, arg: Node) => functionCall(id(name), [arg]);

/** Away from zero, so a split fraction's denominator is never sampled at it. */
const SAMPLES = [0.37, 0.81, 1.23, 1.7, 2.41, 3.05].map((v) => ({ x: v }));

function sameFunction(before: Node, after: Node) {
  return agreesOnSamples(
    (bindings) => evaluate(before, bindings),
    (bindings) => evaluate(after, bindings),
    SAMPLES,
    1e-9
  );
}

function check(original: Node, expected: string) {
  const { node } = expand(original);
  expect(emit(node)).toBe(expected);
  expect(sameFunction(original, node)).toBe(true);
}

describe("multiplying out", () => {
  test("a number over a sum", () => {
    check(mul(number(3), add(x, number(2))), "3x+6");
  });

  test("two binomials, with the middle terms collected", () => {
    // (x+1)(x+2) = x² + 3x + 2. The fold does the collecting; expansion only
    // has to produce the four products for it to collect.
    check(mul(add(x, number(1)), add(x, number(2))), "x^{2}+3x+2");
  });

  test("a difference, where a sign is the thing that can go wrong", () => {
    // (x-1)(x-2) = x² - 3x + 2, so both minus signs have to survive and the
    // two of them have to make a plus at the end.
    check(mul(sub(x, number(1)), sub(x, number(2))), "x^{2}-3x+2");
  });

  test("a sum times itself, written as a power", () => {
    check(pow(add(x, number(1)), number(3)), "x^{3}+3x^{2}+3x+1");
  });

  test("a sign in front of a sum", () => {
    // -(x+1) hides a sum from every rule that works term by term, so the minus
    // has to come inside before anything else can see it.
    check(negative(add(x, number(1))), "-x-1");
  });

  test("a factor that is not a polynomial at all", () => {
    // `sin(x)x` rather than `x sin(x)`: the order of two factors inside one
    // product is the fold's business and it has no rule for swapping two
    // things that are not numbers. Expansion does not invent one — reordering
    // factors is the beginning of a canonical form, and the terms are still in
    // the right order, which is the part that reads as wrong when it is not.
    check(
      mul(fn("sin", x), add(x, number(1))),
      "\\operatorname{sin}\\left(x\\right)x+\\operatorname{sin}\\left(x\\right)"
    );
  });
});

describe("splitting a fraction", () => {
  test("over a sum in the numerator", () => {
    // The case integration is waiting for: (x²+1)/x is refused as a quotient
    // and is x + 1/x term by term.
    check(div(add(pow(x, number(2)), number(1)), x), "x+\\frac{1}{x}");
  });

  test("and a denominator that is a sum is left alone", () => {
    // Turning 1/((x+1)(x+2)) into two fractions is partial fractions, which is
    // a different problem with a different answer. Guessing here would produce
    // something that looks like an identity and is not.
    const original = div(number(1), mul(add(x, number(1)), add(x, number(2))));
    const { node, notes } = expand(original);
    expect(emit(node)).toBe("\\frac{1}{x^{2}+3x+2}");
    expect(sameFunction(original, node)).toBe(true);
    // The denominator was multiplied out, which is a real change; nothing
    // claims the fraction itself was split.
    expect(notes.map((note) => note.latex)).not.toContain(
      "\\frac{a+b}{c}=\\frac{a}{c}+\\frac{b}{c}"
    );
  });

  test("the domain warning is attached, because splitting can remove a hole", () => {
    // (x²+x)/x is undefined at zero and x+1 is not. That is the ordinary
    // convention for a symbolic simplifier and it is still a change worth
    // telling the reader about, so the note carries it rather than a comment
    // in a file they will never open.
    const { node, notes } = expand(div(add(pow(x, number(2)), x), x));
    expect(emit(node)).toBe("x+1");
    expect(notes.some((note) => note.text.includes("domain"))).toBe(true);
  });
});

describe("what it refuses", () => {
  test("a symbolic exponent", () => {
    const original = pow(add(x, number(1)), id("n"));
    const { node, notes } = expand(original);
    expect(emit(node)).toBe("\\left(x+1\\right)^{n}");
    expect(notes).toHaveLength(0);
  });

  test("a negative exponent", () => {
    // Written out it is a fraction with a longer denominator, which is not
    // what anybody meant by expanding.
    const { node } = expand(pow(add(x, number(1)), number(-2)));
    expect(emit(node)).toBe("\\frac{1}{x^{2}+2x+1}");
  });

  test("an expansion that would run away", () => {
    // (x+1)^8 · (x+2)^8 is a perfectly legal thing to type and a perfectly
    // useless thing to read. The original comes back, with a note saying why.
    const big = mul(
      pow(add(x, number(1)), number(8)),
      pow(add(x, number(2)), number(8))
    );
    const { node, notes } = expand(big);
    expect(nodeCount(node)).toBeLessThanOrEqual(EXPANSION_LIMIT);
    expect(
      notes.some((note) => note.text.includes("longer than it is worth"))
    ).toBe(true);
    expect(sameFunction(big, node)).toBe(true);
  });

  test("something already flat is left exactly as it was, with no notes", () => {
    // Empty notes is the signal a panel uses to offer one form rather than two
    // identical ones, so it has to mean what it says.
    const flat = add(pow(x, number(2)), number(1));
    const { node, notes } = expand(flat);
    expect(emit(node)).toBe("x^{2}+1");
    expect(notes).toHaveLength(0);
  });
});

describe("it really is condense run backwards", () => {
  test("expanding a factored form and folding gets the same function", () => {
    // Not the same *tree* — that is the whole point of having two forms — so
    // this is checked the only way it can honestly be checked.
    const factored = mul(add(x, number(2)), sub(pow(x, number(2)), number(3)));
    const { node } = expand(factored);
    expect(emit(node)).toBe("x^{3}+2x^{2}-3x-6");
    expect(sameFunction(factored, node)).toBe(true);
  });

  test("every rewrite preserves the function on its own", () => {
    // The loop could hide a bad rewrite behind a good one, so each is run once,
    // by itself, and checked.
    const notes: { text: string; latex: string }[] = [];
    const cases: [Node, Node | undefined][] = [
      [
        mul(add(x, number(1)), sub(x, number(4))),
        forTesting.distribute(add(x, number(1)), sub(x, number(4)), notes),
      ],
      [
        div(sub(pow(x, number(2)), number(1)), add(x, number(3))),
        forTesting.split(
          sub(pow(x, number(2)), number(1)),
          add(x, number(3)),
          notes
        ),
      ],
      [
        pow(sub(x, number(2)), number(4)),
        forTesting.raise(sub(x, number(2)), number(4), notes),
      ],
      [
        negative(sub(x, number(5))),
        forTesting.distributeSign(sub(x, number(5))),
      ],
    ];
    for (const [before, after] of cases) {
      expect(after).toBeDefined();
      expect(sameFunction(before, fold(after!))).toBe(true);
    }
  });
});
