/**
 * The cases that matter here are the ones Desmos answers with a decimal.
 * Every assertion below is a place where the calculator says
 * `2.82842712475` and a student is expected to write `2\sqrt2`.
 *
 * Trees are built directly rather than parsed, the way `symbolic.unit.test.ts`
 * does, so the arithmetic is testable without a real Desmos to parse with.
 */
import {
  add,
  divide,
  evaluateExact,
  E_VALUE,
  fromInteger,
  multiply,
  PI_VALUE,
  power,
  subtract,
  toLatex,
  toNumber,
  ZERO,
} from "./exact";
import * as Q from "./rational";
import { Aug, AugBuilders } from "../../../../text-mode-core";

const { binop, functionCall, id, negative, number } = AugBuilders;

type Node = Aug.Latex.AnyChild;

const sqrt = (n: Node) => functionCall(id("sqrt"), [n]);
const pow = (a: Node, b: Node) => binop("Exponent", a, b);
const div = (a: Node, b: Node) => binop("Divide", a, b);
const mul = (a: Node, b: Node) => binop("Multiply", a, b);
const plus = (a: Node, b: Node) => binop("Add", a, b);
const pi = id("pi");

/** The exact form of what the expression says, as LaTeX. */
const exact = (node: Node) => {
  const value = evaluateExact(node);
  return value === undefined ? undefined : toLatex(value);
};

describe("exact constants — the forms Desmos only ever shows as decimals", () => {
  test("a root of a perfect power comes out whole", () => {
    expect(exact(sqrt(number(4)))).toBe("2");
    expect(exact(sqrt(number(9)))).toBe("3");
    expect(exact(pow(number(8), div(number(1), number(3))))).toBe("2");
  });

  test("(sqrt2)^3 is 2sqrt2, which is the whole point", () => {
    expect(exact(pow(sqrt(number(2)), number(3)))).toBe("2\\sqrt{2}");
  });

  test("a surd keeps its square factor outside the radical", () => {
    expect(exact(sqrt(number(8)))).toBe("2\\sqrt{2}");
    expect(exact(sqrt(number(12)))).toBe("2\\sqrt{3}");
    expect(exact(sqrt(number(72)))).toBe("6\\sqrt{2}");
  });

  test("pi and e survive as themselves rather than collapsing to decimals", () => {
    expect(exact(pi)).toBe("\\pi");
    expect(exact(id("e"))).toBe("e");
    expect(exact(pow(pi, number(2)))).toBe("\\pi^{2}");
  });

  test("(pi^2)/2 stays exactly that", () => {
    expect(exact(div(pow(pi, number(2)), number(2)))).toBe(
      "\\frac{\\pi^{2}}{2}"
    );
  });

  test("a multiple of a constant is recognised as a multiple", () => {
    expect(exact(mul(number(3), pi))).toBe("3\\pi");
    expect(exact(mul(number(5), sqrt(number(2))))).toBe("5\\sqrt{2}");
    // 3π + 4π is 7π, not 21.99.
    expect(exact(plus(mul(number(3), pi), mul(number(4), pi)))).toBe("7\\pi");
  });

  test("a radical in a denominator is rationalised, as it would be by hand", () => {
    expect(exact(div(number(1), sqrt(number(2))))).toBe("\\frac{\\sqrt{2}}{2}");
    expect(exact(div(number(1), sqrt(number(3))))).toBe("\\frac{\\sqrt{3}}{3}");
    expect(exact(div(number(6), sqrt(number(3))))).toBe("2\\sqrt{3}");
  });

  test("separate radicals combine into one", () => {
    expect(exact(mul(sqrt(number(2)), sqrt(number(3))))).toBe("\\sqrt{6}");
    // √2·√2 is 2 and should leave no radical at all.
    expect(exact(mul(sqrt(number(2)), sqrt(number(2))))).toBe("2");
  });

  test("unlike surds stay apart instead of being averaged into a decimal", () => {
    expect(exact(plus(sqrt(number(2)), sqrt(number(3))))).toBe(
      "\\sqrt{2}+\\sqrt{3}"
    );
  });

  test("a cube root keeps its index", () => {
    expect(exact(pow(number(2), div(number(1), number(3))))).toBe(
      "\\sqrt[3]{2}"
    );
    expect(exact(pow(number(16), div(number(1), number(3))))).toBe(
      "2\\sqrt[3]{2}"
    );
  });

  test("a negative base is refused under an even root and kept under an odd one", () => {
    expect(exact(sqrt(negative(number(4))))).toBeUndefined();
    expect(exact(pow(negative(number(8)), div(number(1), number(3))))).toBe(
      "-2"
    );
  });

  test("a decimal literal is read as the fraction it was typed as", () => {
    expect(exact(number(0.5))).toBe("\\frac{1}{2}");
    expect(exact(mul(number(0.25), pi))).toBe("\\frac{\\pi}{4}");
  });

  test("what it cannot hold exactly, it refuses rather than approximating", () => {
    // A variable has no exact value.
    expect(exact(id("x"))).toBeUndefined();
    // 2^π is real and is not of this shape.
    expect(exact(pow(number(2), pi))).toBeUndefined();
    // √(1+√2) likewise.
    expect(exact(sqrt(plus(number(1), sqrt(number(2)))))).toBeUndefined();
    // A sum in a denominator needs a conjugate this deliberately does not do.
    expect(
      exact(div(number(1), plus(number(1), sqrt(number(2)))))
    ).toBeUndefined();
    // An unknown function is not guessed at.
    expect(exact(functionCall(id("sin"), [pi]))).toBeUndefined();
  });
});

describe("exact constant arithmetic", () => {
  test("the numeric value always agrees with the exact form", () => {
    const cases: Node[] = [
      pow(sqrt(number(2)), number(3)),
      div(pow(pi, number(2)), number(2)),
      div(number(6), sqrt(number(3))),
      plus(sqrt(number(2)), sqrt(number(3))),
      pow(number(16), div(number(1), number(3))),
      mul(number(0.25), pi),
    ];
    for (const node of cases) {
      const value = evaluateExact(node);
      expect(value).toBeDefined();
      // The exact form is a claim about a number; this is the claim being
      // checked against the number Desmos would have shown.
      expect(toNumber(value!)).toBeCloseTo(numericly(node), 10);
    }
  });

  test("adding a value to its own negation gives exactly zero", () => {
    const root2 = power(fromInteger(2), Q.rational(1n, 2n))!;
    expect(subtract(root2, root2)).toEqual(ZERO);
    expect(toLatex(subtract(root2, root2))).toBe("0");
  });

  test("division by zero is refused rather than producing an infinity", () => {
    expect(divide(fromInteger(1), ZERO)).toBeUndefined();
  });

  test("pi and e multiply without either being evaluated", () => {
    const product = multiply(PI_VALUE, E_VALUE);
    expect(toLatex(product)).toBe("\\pi e");
    expect(toNumber(product)).toBeCloseTo(Math.PI * Math.E, 10);
  });

  test("a large power stays exact", () => {
    expect(toLatex(power(fromInteger(2), Q.rational(40n))!)).toBe(
      "1099511627776"
    );
  });

  test("a sum keeps the plain number last, the way it is written", () => {
    const value = add(
      fromInteger(1),
      power(fromInteger(2), Q.rational(1n, 2n))!
    );
    expect(toLatex(value)).toBe("\\sqrt{2}+1");
  });
});

/** Evaluates the tree numerically, for cross-checking the exact answer. */
function numericly(node: Node): number {
  switch (node.type) {
    case "Constant":
      return node.value;
    case "Identifier":
      return node.symbol === "pi"
        ? Math.PI
        : node.symbol === "e"
          ? Math.E
          : NaN;
    case "Negative":
      return -numericly(node.arg);
    case "FunctionCall":
      return node.callee.symbol === "sqrt"
        ? Math.sqrt(numericly(node.args[0]))
        : NaN;
    case "BinaryOperator": {
      const l = numericly(node.left);
      const r = numericly(node.right);
      switch (node.name) {
        case "Add":
          return l + r;
        case "Subtract":
          return l - r;
        case "Multiply":
        case "CrossMultiply":
          return l * r;
        case "Divide":
          return l / r;
        case "Exponent":
          return Math.pow(l, r);
      }
      return NaN;
    }
    default:
      return NaN;
  }
}
