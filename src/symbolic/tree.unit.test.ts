/**
 * The vocabulary, checked on its own.
 *
 * These are small enough to look correct and are the foundation everything else
 * stands on: `topLevelTerms` deciding wrongly where a sum ends would make the
 * factoriser pull a factor out of something that is not a term, and the error
 * would surface three files away as an answer that is quietly the wrong
 * function. So each one is pinned here rather than only exercised through its
 * callers.
 */
import {
  constantValue,
  dependsOn,
  exceedsNodeCount,
  greatestCommonDivisor,
  identifiersIn,
  nodeCount,
  quotientFactors,
  rationalNode,
  rationalOf,
  rebuildSum,
  sameTree,
  splitCoefficient,
  topLevelTerms,
  visit,
  type Node,
} from "./tree";
import { toLatex } from "./latex";
import { AugBuilders, buildConfig } from "../../text-mode-core";

const { binop, functionCall, id, negative, number } = AugBuilders;

const cfg = buildConfig({ commandNames: "sin cos exp ln sqrt" });
const emit = (node: Node) => toLatex(cfg, node);

const x = id("x");
const y = id("y");
const mul = (a: Node, b: Node) => binop("Multiply", a, b);
const div = (a: Node, b: Node) => binop("Divide", a, b);
const add = (a: Node, b: Node) => binop("Add", a, b);
const sub = (a: Node, b: Node) => binop("Subtract", a, b);
const pow = (a: Node, b: Node) => binop("Exponent", a, b);
const fn = (name: string, arg: Node) => functionCall(id(name), [arg]);

describe("walking a tree", () => {
  test("visit reaches every node, parents first", () => {
    const seen: string[] = [];
    visit(add(mul(number(2), x), fn("sin", y)), (node) => seen.push(node.type));
    expect(seen).toEqual([
      "BinaryOperator",
      "BinaryOperator",
      "Constant",
      "Identifier",
      "FunctionCall",
      "Identifier",
      "Identifier",
    ]);
  });

  test("it descends into a node type no rewrite here handles", () => {
    // The reason the walk reads the node's own keys instead of switching on
    // its shape. A `Seq` is not something anything in this directory rewrites,
    // and an answer of "no, this does not depend on x" for `(x, 1)` would be
    // wrong in a way nothing downstream could recover from.
    const seq: Node = { type: "Seq", parenWrapped: true, args: [x, number(1)] };
    expect(dependsOn(seq, "x")).toBe(true);
    expect(nodeCount(seq)).toBe(3);
  });

  test("identifiersIn lists each name once, in the order it appears", () => {
    expect(identifiersIn(add(mul(y, x), fn("sin", y)))).toEqual([
      "y",
      "x",
      "sin",
    ]);
  });

  test("exceedsNodeCount stops early and still agrees", () => {
    const tree = add(mul(number(2), x), fn("sin", y));
    expect(nodeCount(tree)).toBe(7);
    expect(exceedsNodeCount(tree, 6)).toBe(true);
    expect(exceedsNodeCount(tree, 7)).toBe(false);
    expect(exceedsNodeCount(tree, 0)).toBe(true);
  });
});

describe("taking a sum apart and putting it back", () => {
  test("terms come out with their signs", () => {
    const terms = topLevelTerms(sub(add(x, y), number(3)));
    expect(terms.map((t) => [emit(t.term), t.negated])).toEqual([
      ["x", false],
      ["y", false],
      ["3", true],
    ]);
  });

  test("it stops at the top level", () => {
    // A break inside a product, or under a fraction bar, reads as a different
    // expression, so neither is a term of the sum above it.
    expect(topLevelTerms(mul(number(2), add(x, y)))).toHaveLength(1);
    expect(topLevelTerms(div(add(x, y), number(2)))).toHaveLength(1);
  });

  test("a subtraction inside a subtraction flips twice", () => {
    // `a - (b - c)` is `a - b + c`, and getting the second sign wrong is the
    // classic way to lose a term.
    const terms = topLevelTerms(sub(x, sub(y, number(1))));
    expect(terms.map((t) => [emit(t.term), t.negated])).toEqual([
      ["x", false],
      ["y", true],
      ["1", false],
    ]);
  });

  test("rebuildSum is the inverse", () => {
    for (const original of [
      sub(add(x, y), number(3)),
      sub(x, sub(y, number(1))),
      negative(x),
      x,
    ]) {
      const rebuilt = rebuildSum(
        topLevelTerms(original).map(({ term, negated }) => ({
          value: term,
          negated,
        }))
      );
      // Not the same tree — `a - (b - c)` comes back as `a - b + c` — so this
      // is checked the way it is true, as the same list of signed terms.
      expect(
        topLevelTerms(rebuilt).map((t) => [emit(t.term), t.negated])
      ).toEqual(topLevelTerms(original).map((t) => [emit(t.term), t.negated]));
    }
  });

  test("an empty list is zero, not undefined", () => {
    expect(emit(rebuildSum([]))).toBe("0");
  });
});

describe("taking a product apart", () => {
  test("factors come out with the side of the bar they were on", () => {
    const out: { node: Node; inNumerator: boolean }[] = [];
    quotientFactors(div(mul(x, y), mul(number(2), fn("sin", x))), true, out);
    expect(out.map((f) => [emit(f.node), f.inNumerator])).toEqual([
      ["x", true],
      ["y", true],
      ["2", false],
      ["\\sin\\left(x\\right)", false],
    ]);
  });

  test("a sign is a factor of minus one", () => {
    // Left wrapped round the term it would hide every factor inside it from
    // the fold, which is how an integrating factor fails to cancel.
    const out: { node: Node; inNumerator: boolean }[] = [];
    quotientFactors(negative(mul(x, y)), true, out);
    expect(out.map((f) => emit(f.node))).toEqual(["-1", "x", "y"]);
  });

  test("a nested quotient flips the side again", () => {
    const out: { node: Node; inNumerator: boolean }[] = [];
    quotientFactors(div(x, div(y, number(2))), true, out);
    expect(out.map((f) => [emit(f.node), f.inNumerator])).toEqual([
      ["x", true],
      ["y", false],
      ["2", true],
    ]);
  });
});

describe("reading numbers off a term", () => {
  test("constantValue sees through a sign", () => {
    expect(constantValue(number(3))).toBe(3);
    expect(constantValue(negative(number(3)))).toBe(-3);
    expect(constantValue(x)).toBeUndefined();
  });

  test("splitCoefficient separates a leading number", () => {
    expect(splitCoefficient(mul(number(2), x))[0]).toBe(2);
    expect(emit(splitCoefficient(mul(number(2), x))[1])).toBe("x");
    expect(splitCoefficient(negative(mul(number(2), x)))[0]).toBe(-2);
    // A bare constant reports its own value against a remainder of one, so two
    // constants collect the same way two multiples of x do.
    expect(splitCoefficient(number(5))).toEqual([5, number(1)]);
    expect(splitCoefficient(x)[0]).toBe(1);
  });

  test("rationalOf reads integers and fractions of them", () => {
    expect(rationalOf(number(3))).toEqual({ n: 3, d: 1 });
    expect(rationalOf(div(number(1), number(2)))).toEqual({ n: 1, d: 2 });
    expect(rationalOf(negative(div(number(1), number(2))))).toEqual({
      n: -1,
      d: 2,
    });
    expect(rationalOf(div(div(number(1), number(2)), number(3)))).toEqual({
      n: 1,
      d: 6,
    });
    // Not a rational: a decimal would have to be guessed at, and the guess is
    // what this whole layer exists to avoid.
    expect(rationalOf(number(0.5))).toBeUndefined();
    expect(rationalOf(div(x, number(2)))).toBeUndefined();
    expect(rationalOf(div(number(1), number(0)))).toBeUndefined();
  });

  test("rationalNode reduces, and keeps the sign in front", () => {
    expect(emit(rationalNode({ n: 4, d: 2 }))).toBe("2");
    expect(emit(rationalNode({ n: 3, d: 6 }))).toBe("\\frac{1}{2}");
    expect(emit(rationalNode({ n: 1, d: -2 }))).toBe("-\\frac{1}{2}");
    expect(emit(rationalNode({ n: -1, d: 2 }))).toBe("-\\frac{1}{2}");
    expect(emit(rationalNode({ n: 0, d: 5 }))).toBe("0");
  });

  test("greatestCommonDivisor", () => {
    expect(greatestCommonDivisor(12, 18)).toBe(6);
    expect(greatestCommonDivisor(7, 13)).toBe(1);
    expect(greatestCommonDivisor(5, 0)).toBe(5);
  });
});

describe("comparing two trees", () => {
  test("a rebuilt copy is the same tree", () => {
    const original = pow(add(x, number(1)), number(2));
    expect(sameTree(original, pow(add(x, number(1)), number(2)))).toBe(true);
    expect(sameTree(original, pow(add(x, number(2)), number(2)))).toBe(false);
  });

  test("a difference deep inside is still a difference", () => {
    const deep = (leaf: Node) => fn("sin", mul(number(2), fn("exp", leaf)));
    expect(sameTree(deep(x), deep(x))).toBe(true);
    expect(sameTree(deep(x), deep(y))).toBe(false);
  });

  test("a missing field is not the same as a field that matches", () => {
    const call = fn("sin", x);
    const { args, ...withoutArgs } = call;
    void args;
    expect(sameTree(call, withoutArgs as unknown as Node)).toBe(false);
    expect(sameTree(withoutArgs as unknown as Node, call)).toBe(false);
  });
});
