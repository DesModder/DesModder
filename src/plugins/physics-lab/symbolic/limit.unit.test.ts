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
import { AugBuilders, buildConfig } from "../../../../text-mode-core";
import { toLatex, type Node } from "../../../symbolic";

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

describe("exact constants inside the limit", () => {
  // The parser config the tests use has no `\pi`; Desmos's does, and the
  // integration test checks the real spelling.
  const cfg = buildConfig({
    commandNames:
      "sin cos tan sec csc cot ln log exp sqrt sinh cosh tanh arcsin arccos arctan",
  });
  const exact = (node: Node, where: Bound) => {
    const { answer } = findLimit(node, "x", where, "both");
    if (answer.kind !== "value" || answer.limit.kind !== "finite")
      return "no finite value";
    return toLatex(cfg, X.toNode(answer.limit.value)).replace(
      /\\operatorname\{pi\}/g,
      String.raw`\pi`
    );
  };
  const sqrt2 = fn("sqrt", n(2));
  const onePlus = (a: Node) => add(n(1), a);

  test.each([
    ["(1 + π/x)^x", pow(onePlus(div(pi, x)), x), INF, String.raw`e^{\pi}`],
    ["(1 + e/x)^x", pow(onePlus(div(e, x)), x), INF, "e^{e}"],
    ["(1 - π/x)^x", pow(sub(n(1), div(pi, x)), x), INF, String.raw`e^{-\pi}`],
    [
      "(1 + √2/x)^{3x}",
      pow(onePlus(div(sqrt2, x)), mul(n(3), x)),
      INF,
      String.raw`e^{3\sqrt{2}}`,
    ],
    [
      "(1 + 1/(πx))^x",
      pow(onePlus(div(n(1), mul(pi, x))), x),
      INF,
      String.raw`e^{\frac{1}{\pi}}`,
    ],
    [
      "(1 + 1/x)^{πx}",
      pow(onePlus(div(n(1), x)), mul(pi, x)),
      INF,
      String.raw`e^{\pi}`,
    ],
    [
      "(1 + πx)^{1/x} at 0",
      pow(onePlus(mul(pi, x)), div(n(1), x)),
      ZERO,
      String.raw`e^{\pi}`,
    ],
    ["sin(πx)/x at 0", div(fn("sin", mul(pi, x)), x), ZERO, String.raw`\pi`],
    [
      "(e^{√2x} - 1)/x at 0",
      div(sub(pow(e, mul(sqrt2, x)), n(1)), x),
      ZERO,
      String.raw`\sqrt{2}`,
    ],
    [
      "(2^x - 1)/x at 0",
      div(sub(pow(n(2), x), n(1)), x),
      ZERO,
      String.raw`\ln\left(2\right)`,
    ],
    [
      "log(1 + x)/x at 0",
      div(fn("log", onePlus(x)), x),
      ZERO,
      String.raw`\frac{1}{\ln\left(10\right)}`,
    ],
    [
      "√(x² + πx) - x",
      sub(fn("sqrt", add(pow(x, n(2)), mul(pi, x))), x),
      INF,
      String.raw`\frac{\pi}{2}`,
    ],
    ["(1 + 2^x)^{1/x}", pow(onePlus(pow(n(2), x)), div(n(1), x)), INF, "2"],
    [
      "(sin x - 1/2)/(x - π/6) at π/6",
      div(sub(fn("sin", x), div(n(1), n(2))), sub(x, div(pi, n(6)))),
      at(div(pi, n(6)), Math.PI / 6),
      String.raw`\frac{\sqrt{3}}{2}`,
    ],
    [
      "(e^x - e^π)/(x - π) at π",
      div(sub(pow(e, x), pow(e, pi)), sub(x, pi)),
      at(pi, Math.PI),
      String.raw`e^{\pi}`,
    ],
    [
      "(x^π - 1)/(x - 1) at 1",
      div(sub(pow(x, pi), n(1)), sub(x, n(1))),
      at(n(1), 1),
      String.raw`\pi`,
    ],
    [
      "(ln x - 1)/(x - e) at e",
      div(sub(fn("ln", x), n(1)), sub(x, e)),
      at(e, Math.E),
      String.raw`\frac{1}{e}`,
    ],
  ] as [string, Node, Bound, string][])(
    "%s is %s",
    (_, node, where, expected) => {
      expect(exact(node, where)).toBe(expected);
    }
  );
});
