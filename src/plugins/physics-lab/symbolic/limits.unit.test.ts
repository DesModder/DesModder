/**
 * The limit engine behind improper integrals, on the research brief's cases:
 * the rules for the easy forms, exp(B ln A) for a variable power, and an
 * exact series for what the rules leave indeterminate.
 */
import { limitOf } from "./definite";
import * as X from "./exact";
import type { Node } from "../../../symbolic";
import { AugBuilders } from "../../../../text-mode-core";

const { binop, functionCall, id, number } = AugBuilders;
const x = id("x");
const e = id("e");
const mul = (a: Node, b: Node) => binop("Multiply", a, b);
const div = (a: Node, b: Node) => binop("Divide", a, b);
const add = (a: Node, b: Node) => binop("Add", a, b);
const sub = (a: Node, b: Node) => binop("Subtract", a, b);
const pow = (a: Node, b: Node) => binop("Exponent", a, b);
const fn = (name: string, arg: Node) => functionCall(id(name), [arg]);

const atInfinity = { kind: "infinite", sign: 1 } as const;
const atZero = (side: 1 | -1 = 1) =>
  ({ kind: "point", node: number(0), value: 0, side }) as const;

/** The limit as text: its exact form, `±inf`, or `unknown`. */
function limit(node: Node, approach: Parameters<typeof limitOf>[2]) {
  const found = limitOf(node, "x", approach);
  if (found === undefined) return "unknown";
  if (found.kind === "infinite") return found.sign > 0 ? "+inf" : "-inf";
  return X.toLatex(found.value);
}

describe("limits a course asks for", () => {
  test("(1 + 1/x)^x is e", () => {
    expect(limit(pow(add(number(1), div(number(1), x)), x), atInfinity)).toBe(
      "e"
    );
  });

  test("x^(1/x) is 1: a power beats a logarithm at infinity", () => {
    expect(limit(pow(x, div(number(1), x)), atInfinity)).toBe("1");
  });

  test("sqrt(x^2 + x) - x is 1/2, through the series of the root", () => {
    expect(
      limit(sub(fn("sqrt", add(pow(x, number(2)), x)), x), atInfinity)
    ).toBe("\\frac{1}{2}");
  });

  test("sin(x)/x and (1 - cos x)/x^2 at zero", () => {
    expect(limit(div(fn("sin", x), x), atZero())).toBe("1");
    expect(
      limit(div(sub(number(1), fn("cos", x)), pow(x, number(2))), atZero())
    ).toBe("\\frac{1}{2}");
  });

  test("x ln x at zero from above, and e^x/x^10 at infinity", () => {
    expect(limit(mul(x, fn("ln", x)), atZero())).toBe("0");
    expect(limit(div(pow(e, x), pow(x, number(10))), atInfinity)).toBe("+inf");
  });

  test("what has no limit is not given one", () => {
    // sin x oscillates at infinity; so does e^{x sin x}.
    expect(limit(fn("sin", x), atInfinity)).toBe("unknown");
    expect(limit(pow(e, mul(x, fn("sin", x))), atInfinity)).toBe("unknown");
  });
});
