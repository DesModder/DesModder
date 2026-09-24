/**
 * The Limit tab's engine, on the limits a course asks for: each answer, how
 * it was found, and the form it started as. The method is asserted as well as
 * the value because the method is what the tab teaches, and a right number
 * reached by a technique nobody would name is half an answer.
 */
import {
  checkLimit,
  describeLimitMethod,
  findLimit,
  type LimitSide,
} from "./limit";
import type { Bound } from "./definite";
import * as X from "./exact";
import { AugBuilders } from "../../../../text-mode-core";
import type { Node } from "../../../symbolic";

const { binop, functionCall, id, number: n } = AugBuilders;
const x = id("x");
const e = id("e");
const pi = id("pi");
const mul = (a: Node, b: Node) => binop("Multiply", a, b);
const div = (a: Node, b: Node) => binop("Divide", a, b);
const add = (a: Node, b: Node) => binop("Add", a, b);
const sub = (a: Node, b: Node) => binop("Subtract", a, b);
const pow = (a: Node, b: Node) => binop("Exponent", a, b);
const fn = (name: string, a: Node) => functionCall(id(name), [a]);

const INF: Bound = { kind: "infinite", sign: 1 };
const NEG_INF: Bound = { kind: "infinite", sign: -1 };
const at = (node: Node, value: number): Bound => ({
  kind: "finite",
  node,
  value,
});
const ZERO = at(n(0), 0);

/** The answer as text: its exact form, `±inf`, `DNE ...`, or `unknown`. */
function limit(node: Node, where: Bound, side: LimitSide = "both") {
  const { answer } = findLimit(node, "x", where, side);
  const show = (l: { kind: string; sign?: number; value?: X.ExactValue }) =>
    l.kind === "infinite"
      ? l.sign! > 0
        ? "+inf"
        : "-inf"
      : X.toLatex(l.value!);
  switch (answer.kind) {
    case "value":
      return show(answer.limit);
    case "sides-differ":
      return `DNE ${show(answer.left)} ${show(answer.right)}`;
    case "oscillates":
      return "DNE oscillates";
    case "unknown":
      return "unknown";
  }
}

function method(node: Node, where: Bound, side: LimitSide = "both") {
  const { answer } = findLimit(node, "x", where, side);
  return answer.kind === "value" ? describeLimitMethod(answer.method) : "";
}

const form = (node: Node, where: Bound, side: LimitSide = "both") =>
  findLimit(node, "x", where, side).form;

describe("0/0 and ∞/∞", () => {
  test("sin(x)/x is 1, by L'Hôpital's rule, from a 0/0 form", () => {
    const f = div(fn("sin", x), x);
    expect(limit(f, ZERO)).toBe("1");
    expect(form(f, ZERO)).toBe("0/0");
    expect(method(f, ZERO)).toBe("L'Hôpital's rule");
  });

  test("the rule's lines are the derivatives of the top and bottom", () => {
    const { answer } = findLimit(
      div(fn("sin", mul(n(3), x)), fn("sin", mul(n(5), x))),
      "x",
      ZERO,
      "both"
    );
    expect(answer.kind === "value" && answer.method.lhopital.length).toBe(1);
    expect(
      limit(div(fn("sin", mul(n(3), x)), fn("sin", mul(n(5), x))), ZERO)
    ).toBe("\\frac{3}{5}");
  });

  test("a removable discontinuity: (x²-4)/(x-2) at 2 is 4", () => {
    const f = div(sub(pow(x, n(2)), n(4)), sub(x, n(2)));
    expect(limit(f, at(n(2), 2))).toBe("4");
  });

  test("(√(x+4) - 2)/x is 1/4, the one a course rationalises", () => {
    expect(limit(div(sub(fn("sqrt", add(x, n(4))), n(2)), x), ZERO)).toBe(
      "\\frac{1}{4}"
    );
  });

  test("a rational function at infinity is its leading terms, not L'Hôpital twice", () => {
    const f = div(
      add(mul(n(3), pow(x, n(2))), n(1)),
      sub(mul(n(2), pow(x, n(2))), x)
    );
    expect(limit(f, INF)).toBe("\\frac{3}{2}");
    expect(form(f, INF)).toBe("inf/inf");
    expect(method(f, INF)).toBe("Leading terms");
  });

  test("√(4x²+1)/x at -∞ is -2: the root's sign follows the side", () => {
    expect(
      limit(div(fn("sqrt", add(mul(n(4), pow(x, n(2))), n(1))), x), NEG_INF)
    ).toBe("-2");
  });

  test("at an irrational point: sin(x - π)/(x - π) at π", () => {
    expect(limit(div(fn("sin", sub(x, pi)), sub(x, pi)), at(pi, Math.PI))).toBe(
      "1"
    );
  });
});

describe("the other forms", () => {
  test("(1 + 1/x)^x is e, as a 1^∞ form", () => {
    const f = pow(add(n(1), div(n(1), x)), x);
    expect(limit(f, INF)).toBe("e");
    expect(form(f, INF)).toBe("1^inf");
    expect(method(f, INF)).toBe(
      "Rewritten as an exponential of a logarithm, then series expansion"
    );
  });

  test("x^x from the right of 0 is 1, and is not a substitution", () => {
    // Floating point says 0^0 = 1, which made this look continuous.
    const f = pow(x, x);
    expect(limit(f, ZERO, "right")).toBe("1");
    expect(form(f, ZERO, "right")).toBe("0^0");
    expect(method(f, ZERO, "right")).not.toContain("Direct substitution");
  });

  test("x - ln x at infinity: ∞ - ∞, decided by the dominant term", () => {
    const f = sub(x, fn("ln", x));
    expect(limit(f, INF)).toBe("+inf");
    expect(form(f, INF)).toBe("inf-inf");
    expect(method(f, INF)).toContain("Factoring out the dominant term");
  });

  test("x eˣ at -∞ is 0 by growth rates, from 0·∞", () => {
    const f = mul(x, pow(e, x));
    expect(limit(f, NEG_INF)).toBe("0");
    expect(form(f, NEG_INF)).toBe("0*inf");
  });

  test("ln(x)/√x at infinity is 0: a root is a power", () => {
    expect(limit(div(fn("ln", x), fn("sqrt", x)), INF)).toBe("0");
  });
});

describe("squeeze, sides, and limits that do not exist", () => {
  test("x sin(1/x) at 0 is 0 by the squeeze theorem", () => {
    const f = mul(x, fn("sin", div(n(1), x)));
    expect(limit(f, ZERO)).toBe("0");
    expect(method(f, ZERO)).toBe("Squeeze theorem");
  });

  test("cos(x)/x at infinity is 0 by the squeeze theorem", () => {
    expect(limit(div(fn("cos", x), x), INF)).toBe("0");
  });

  test("sin(1/x) at 0 oscillates, which is proved rather than failed at", () => {
    expect(limit(fn("sin", div(n(1), x)), ZERO)).toBe("DNE oscillates");
    expect(limit(fn("sin", x), INF)).toBe("DNE oscillates");
  });

  test("|x|/x at 0: each side exists, they differ, so the limit does not", () => {
    const f = div(fn("abs", x), x);
    expect(limit(f, ZERO)).toBe("DNE -1 1");
    expect(limit(f, ZERO, "right")).toBe("1");
    expect(method(f, ZERO, "right")).toContain("Absolute value written out");
  });

  test("1/x at 0 runs off to different infinities on each side", () => {
    expect(limit(div(n(1), x), ZERO)).toBe("DNE -inf +inf");
    expect(limit(div(n(1), pow(x, n(2))), ZERO)).toBe("+inf");
  });

  test("tan x from the left of π/2 is +∞", () => {
    expect(limit(fn("tan", x), at(div(pi, n(2)), Math.PI / 2), "left")).toBe(
      "+inf"
    );
  });

  test("a name with no value is not given a limit", () => {
    expect(limit(div(fn("sin", mul(id("a"), x)), x), ZERO)).toBe("unknown");
  });

  test("continuity: x² at 3 is 9 by substitution", () => {
    expect(limit(pow(x, n(2)), at(n(3), 3))).toBe("9");
    expect(method(pow(x, n(2)), at(n(3), 3))).toBe("Direct substitution");
  });
});

describe("the numeric check", () => {
  const right = { kind: "point", node: n(0), value: 0, side: 1 } as const;
  const one = { kind: "finite", value: X.fromInteger(1) } as const;

  test("confirms a right answer", () => {
    expect(checkLimit(div(fn("sin", x), x), "x", right, one)).toBe("checked");
  });

  test("rejects a wrong one the values settle away from", () => {
    const two = { kind: "finite", value: X.fromInteger(2) } as const;
    expect(checkLimit(div(fn("sin", x), x), "x", right, two)).toBe("wrong");
  });

  test("does not claim a slow limit it cannot see arrive", () => {
    // 1/ln x → 0 at infinity, and is still 0.05 at 10⁸.
    const zero = { kind: "finite", value: X.ZERO } as const;
    expect(
      checkLimit(
        div(n(1), fn("ln", x)),
        "x",
        { kind: "infinite", sign: 1 },
        zero
      )
    ).toBe("unchecked");
  });
});
