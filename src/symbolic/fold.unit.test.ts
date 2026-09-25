/**
 * The fold, rule by rule.
 *
 * `property.unit.test.ts` already runs two thousand generated expressions
 * through this and checks that none of them changed value, which is the
 * strongest evidence available that the fold is correct. It is no evidence at
 * all about whether the fold is *useful*: an implementation that returned its
 * input untouched would pass every one of those checks.
 *
 * So this is the other half. Each case pins one rule to the output somebody
 * would write by hand, which is the only way to notice a rule that has quietly
 * stopped firing.
 */
import { fold } from "./fold";
import { toLatex } from "./latex";
import type { Node } from "./tree";
import { AugBuilders, buildConfig } from "../../text-mode-core";

const { binop, functionCall, id, negative, number } = AugBuilders;

const cfg = buildConfig({ commandNames: "sin cos tan ln exp sqrt abs sign" });
const emit = (node: Node) => toLatex(cfg, node);

const x = id("x");
const y = id("y");
const mul = (a: Node, b: Node) => binop("Multiply", a, b);
const div = (a: Node, b: Node) => binop("Divide", a, b);
const add = (a: Node, b: Node) => binop("Add", a, b);
const sub = (a: Node, b: Node) => binop("Subtract", a, b);
const pow = (a: Node, b: Node) => binop("Exponent", a, b);
const fn = (name: string, arg: Node) => functionCall(id(name), [arg]);

const check = (node: Node, expected: string) =>
  expect(emit(fold(node))).toBe(expected);

describe("the identities that make an answer readable", () => {
  test("zero and one disappear", () => {
    check(add(x, number(0)), "x");
    check(add(number(0), x), "x");
    check(sub(x, number(0)), "x");
    check(mul(x, number(1)), "x");
    check(mul(number(1), x), "x");
    check(div(x, number(1)), "x");
    check(pow(x, number(1)), "x");
    check(pow(x, number(0)), "1");
  });

  test("a factor of zero takes the whole product with it", () => {
    check(mul(number(0), fn("sin", x)), "0");
    check(mul(fn("sin", x), number(0)), "0");
    check(div(number(0), x), "0");
  });

  test("arithmetic on numbers is done", () => {
    check(add(number(2), number(3)), "5");
    check(sub(number(2), number(3)), "-1");
    check(mul(number(2), number(3)), "6");
    check(pow(number(2), number(3)), "8");
  });

  test("a coefficient of minus one is a sign, not a factor", () => {
    check(mul(number(-1), x), "-x");
    check(mul(x, number(-1)), "-x");
    check(div(x, number(-1)), "-x");
  });

  test("a number on the right comes to the front", () => {
    check(mul(y, number(2)), "2y");
    // And the move has to let the rules above it fire, or the result needs a
    // second fold to settle. This is the case that caught that.
    check(mul(div(x, y), number(-8)), "\\frac{-8x}{y}");
  });
});

describe("what it refuses to turn into a decimal", () => {
  test("a fraction of two integers stays a fraction", () => {
    check(div(number(1), number(2)), "\\frac{1}{2}");
    check(div(number(6), number(3)), "2");
    check(div(number(3), number(6)), "\\frac{1}{2}");
  });

  test("fractions add and multiply exactly", () => {
    check(sub(div(number(1), number(2)), number(1)), "-\\frac{1}{2}");
    check(
      add(div(number(1), number(3)), div(number(1), number(6))),
      "\\frac{1}{2}"
    );
    check(
      mul(div(number(2), number(3)), div(number(3), number(4))),
      "\\frac{1}{2}"
    );
  });

  test("a root that is not exact is left as a root", () => {
    check(fn("sqrt", number(4)), "2");
    check(fn("sqrt", number(2)), "\\sqrt{2}");
    // A one-half power *is* a square root, and is written as one: the two
    // are the same node after folding, which is what keeps an answer from
    // carrying both spellings depending on which rule produced it.
    check(pow(number(2), div(number(1), number(2))), "\\sqrt{2}");
  });

  test("only the function values that are exact are folded", () => {
    check(fn("sin", number(0)), "0");
    check(fn("cos", number(0)), "1");
    check(fn("exp", number(0)), "1");
    check(fn("ln", number(1)), "0");
    check(fn("abs", number(-3)), "3");
    check(fn("sin", number(1)), "\\sin\\left(1\\right)");
  });
});

describe("signs", () => {
  test("two negatives cancel", () => {
    check(negative(negative(x)), "x");
    check(mul(negative(x), negative(y)), "xy");
  });

  test("a sign in front of a product moves onto the coefficient", () => {
    check(negative(mul(number(2), x)), "-2x");
  });

  test("a negative on either side of a bar comes out in front", () => {
    check(div(x, number(-3)), "-\\frac{x}{3}");
    check(div(number(-1), number(9)), "-\\frac{1}{9}");
  });

  test("adding a negative is subtracting", () => {
    check(add(x, negative(y)), "x-y");
    check(sub(x, negative(y)), "x+y");
  });
});

describe("factors that meet each other", () => {
  test("powers of a shared base combine", () => {
    check(mul(pow(id("e"), negative(x)), mul(x, pow(id("e"), x))), "x");
    check(mul(add(x, number(1)), add(x, number(1))), "\\left(x+1\\right)^{2}");
  });

  test("a factor above the bar cancels one below it", () => {
    check(div(mul(id("k"), x), mul(id("k"), y)), "\\frac{x}{y}");
    check(div(mul(number(2), x), mul(number(2), y)), "\\frac{x}{y}");
    check(div(fn("sin", x), fn("sin", x)), "1");
  });

  test("like terms written the same way collect", () => {
    check(add(mul(number(3), x), mul(number(-3), x)), "0");
    check(add(mul(number(2), x), mul(number(5), x)), "7x");
    check(sub(x, x), "0");
  });

  test("a numeric factor above the line divides one below it", () => {
    check(div(mul(number(3), pow(x, number(3))), number(3)), "x^{3}");
    // Only when it divides exactly, or an exact answer becomes a decimal.
    check(
      div(mul(number(3), pow(x, number(2))), number(2)),
      "\\frac{3x^{2}}{2}"
    );
  });

  test("a negative power is written as a fraction", () => {
    check(pow(y, number(-1)), "\\frac{1}{y}");
    check(pow(y, number(-2)), "\\frac{1}{y^{2}}");
  });

  test("stacked fractions flatten", () => {
    check(div(div(x, number(2)), number(3)), "\\frac{x}{6}");
    check(mul(number(2), div(pow(x, number(2)), number(2))), "x^{2}");
  });
});

describe("what it deliberately leaves alone", () => {
  test("like terms written two different ways", () => {
    // Deciding that `x·2` and `2·x` are the same term is the first step of a
    // canonical form. The fold does not take it; `x·2` is reordered to `2x` by
    // the rule above, which is as far as this goes.
    check(add(mul(x, number(2)), mul(number(2), x)), "4x");
    // But nothing rewrites `x·y` into `y·x`, so these stay apart.
    check(add(mul(x, y), mul(y, x)), "xy+yx");
  });

  test("a common factor of a sum", () => {
    // That is `condense`, which is a matter of taste and is asked for.
    check(
      add(mul(number(2), x), mul(number(4), pow(x, number(2)))),
      "2x+4x^{2}"
    );
  });

  test("a product that has to be multiplied out", () => {
    // That is `expand`, for the same reason.
    check(
      mul(add(x, number(1)), add(x, number(2))),
      "\\left(x+1\\right)\\left(x+2\\right)"
    );
  });
});

describe("a function of its own inverse", () => {
  test("cancels, in the direction that is always true", () => {
    check(fn("sin", fn("arcsin", x)), "x");
    check(fn("tan", fn("arctan", x)), "x");
    check(fn("ln", pow(id("e"), x)), "x");
  });

  test("and across, by the right-angled triangle", () => {
    check(fn("cos", fn("arcsin", x)), String.raw`\sqrt{1-x^{2}}`);
    check(fn("sin", fn("arctan", x)), String.raw`\frac{x}{\sqrt{x^{2}+1}}`);
  });

  test("but not the other way round", () => {
    // arcsin(sin x) is x only for |x| ≤ π/2.
    const node = fn("arcsin", fn("sin", x));
    check(node, emit(node));
  });
});
