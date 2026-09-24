/**
 * The fallback for integrals with no elementary antiderivative: every term the
 * best way it can be done, and a report of which way that was.
 *
 * The numeric check here is the same one the rest of the suite leans on, made
 * local: a truncated series is only claimed to be right near zero, so its
 * derivative is compared with the integrand at a point close to it, where the
 * neglected terms are far below the tolerance.
 */
import { seriesFallback } from "./seriesSum";
import {
  evaluate,
  numericDerivative,
  toLatex,
  type Node,
} from "../../../symbolic";
import { AugBuilders, buildConfig } from "../../../../text-mode-core";

const { binop, functionCall, id, number } = AugBuilders;
const cfg = buildConfig({ commandNames: "sin cos tan ln exp sqrt arctan" });
const emit = (node: Node) => toLatex(cfg, node);
const x = id("x");
const e = id("e");
const mul = (a: Node, b: Node) => binop("Multiply", a, b);
const div = (a: Node, b: Node) => binop("Divide", a, b);
const add = (a: Node, b: Node) => binop("Add", a, b);
const pow = (a: Node, b: Node) => binop("Exponent", a, b);
const fn = (name: string, arg: Node) => functionCall(id(name), [arg]);

function differentiatesBack(node: Node, sum: Node) {
  for (const at of [0.1, 0.2, 0.3]) {
    const d = numericDerivative(sum, "x", { x: at });
    const f = evaluate(node, { x: at });
    expect(Math.abs(d - f)).toBeLessThan(1e-6);
  }
}

describe("a sum is integrated term by term", () => {
  test("one term in closed form and one as a series", () => {
    const node = add(pow(e, pow(x, number(2))), x);
    const found = seriesFallback(node, "x", 12)!;
    expect(found.parts.map((part) => part.kind)).toEqual(["series", "closed"]);
    expect(found.order).toBeUndefined();
    expect(emit(found.partial)).toBe(
      "x+\\frac{x^{3}}{3}+\\frac{x^{5}}{10}+\\frac{x^{7}}{42}+\\frac{x^{2}}{2}"
    );
    differentiatesBack(node, found.sum);
  });

  test("nothing to fall back from when every term has a closed form", () => {
    expect(seriesFallback(add(x, fn("sin", x)), "x", 12)).toBeUndefined();
  });
});

describe("a first term of 1/x is a logarithm", () => {
  test("the exponential integral, as it is written", () => {
    const node = div(pow(e, x), x);
    const found = seriesFallback(node, "x", 12)!;
    expect(emit(found.partial)).toBe(
      "\\ln\\left|x\\right|+x+\\frac{x^{2}}{4}+\\frac{x^{3}}{18}+\\frac{x^{4}}{96}"
    );
    differentiatesBack(node, found.sum);
  });
});

describe("no general term, so the first terms to a stated order", () => {
  test("a composition no table has", () => {
    const node = pow(e, fn("sin", x));
    const found = seriesFallback(node, "x", 12)!;
    expect(found.parts.map((part) => part.kind)).toEqual(["truncated"]);
    expect(found.order).toBe(13);
    expect(emit(found.partial)).toBe(
      "x+\\frac{x^{2}}{2}+\\frac{x^{3}}{6}-\\frac{x^{5}}{40}"
    );
    differentiatesBack(node, found.sum);
  });

  test("a product of two functions, each with a series", () => {
    const node = mul(fn("sin", x), pow(e, pow(x, number(2))));
    const found = seriesFallback(node, "x", 12)!;
    expect(emit(found.partial)).toBe(
      "\\frac{x^{2}}{2}+\\frac{5x^{4}}{24}+\\frac{41x^{6}}{720}+\\frac{461x^{8}}{40320}"
    );
    differentiatesBack(node, found.sum);
  });

  test("an elliptic integral, through the binomial series", () => {
    const node = fn("sqrt", add(number(1), pow(x, number(3))));
    const found = seriesFallback(node, "x", 12)!;
    expect(emit(found.partial)).toBe(
      "x+\\frac{x^{4}}{8}-\\frac{x^{7}}{56}+\\frac{x^{10}}{160}"
    );
    differentiatesBack(node, found.sum);
  });

  test("x^x has none, because ln x has none", () => {
    expect(seriesFallback(pow(x, x), "x", 12)).toBeUndefined();
  });
});
