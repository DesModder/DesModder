/**
 * The Limit tab's engine, on the limits a course asks for: each answer, how
 * it was found, and the form it started as. The method is asserted as well as
 * the value because the method is what the tab teaches, and a right number
 * reached by a technique nobody would name is half an answer.
 */
import {
  checkLimit,
  numericEvidence,
  describeLimitMethod,
  findLimit,
  type LimitSide,
} from "./limit";
import type { Bound } from "./definite";
import * as X from "./exact";
import * as Q from "./rational";
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
const negative = (arg: Node): Node => ({ type: "Negative", arg });

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
    case "one-side-only":
      return `only ${answer.side > 0 ? "right" : "left"} ${show(answer.limit)}`;
    case "no-approach":
      return "no approach";
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

type Operator = "<" | "<=" | "=" | ">=" | ">";
const compare = (left: Node, operator: Operator, right: Node) =>
  ({ type: "Comparator", left, operator, right }) as unknown as Node;
const piecewise = (condition: Node, consequent: Node, alternate: Node) =>
  ({ type: "Piecewise", condition, consequent, alternate }) as unknown as Node;
/** How Desmos parses a missing "otherwise". */
const UNDEFINED = { type: "Constant", value: NaN } as unknown as Node;

describe("piecewise functions and jumps, side by side", () => {
  const ONE = at(n(1), 1);
  const TWO = at(n(2), 2);

  test("a jump between two formulas: 1 from the left, 3 from the right", () => {
    const f = piecewise(
      compare(x, "<", n(1)),
      pow(x, n(2)),
      add(mul(n(2), x), n(1))
    );
    expect(limit(f, ONE)).toBe("DNE 1 3");
    expect(limit(f, ONE, "left")).toBe("1");
    expect(limit(f, ONE, "right")).toBe("3");
    expect(method(f, ONE, "left")).toContain("formula in force");
  });

  test("≤ instead of < changes the value at 1, not the limit", () => {
    const f = piecewise(
      compare(x, "<=", n(1)),
      pow(x, n(2)),
      add(mul(n(2), x), n(1))
    );
    expect(limit(f, ONE)).toBe("DNE 1 3");
  });

  test("two formulas that meet: the limit exists", () => {
    const f = piecewise(
      compare(x, "<", n(1)),
      pow(x, n(2)),
      sub(mul(n(2), x), n(1))
    );
    expect(limit(f, ONE)).toBe("1");
    expect(limit(piecewise(compare(x, "<", n(0)), negative(x), x), ZERO)).toBe(
      "0"
    );
  });

  test("a condition that is not x < c is decided by its sign", () => {
    expect(
      limit(
        piecewise(compare(pow(x, n(2)), "<", n(1)), n(2), add(x, n(1))),
        ONE
      )
    ).toBe("2");
    // True everywhere except the point itself, which a limit never looks at.
    expect(
      limit(
        piecewise(compare(pow(sub(x, n(1)), n(2)), ">", n(0)), n(7), n(9)),
        ONE
      )
    ).toBe("7");
  });

  test("floor, ceiling, rounding and sign at their jumps", () => {
    expect(limit(fn("floor", x), TWO)).toBe("DNE 1 2");
    expect(limit(fn("ceil", x), TWO)).toBe("DNE 2 3");
    expect(limit(fn("round", x), at(div(n(1), n(2)), 0.5))).toBe("DNE 0 1");
    expect(limit(fn("sign", x), ZERO)).toBe("DNE -1 1");
    expect(limit(fn("floor", pow(x, n(2))), ONE)).toBe("DNE 0 1");
  });

  test("between jumps a floor is simply constant", () => {
    expect(limit(fn("floor", x), at(div(n(5), n(2)), 2.5))).toBe("2");
    // x² reaches 0 from above on both sides, so ⌊x²⌋ is 0 on both.
    expect(limit(fn("floor", pow(x, n(2))), ZERO)).toBe("0");
  });
});

describe("a side the function does not live on", () => {
  test("√x at 0: only the right side exists", () => {
    const f = fn("sqrt", x);
    expect(limit(f, ZERO)).toBe("only right 0");
    expect(limit(f, ZERO, "right")).toBe("0");
    expect(limit(f, ZERO, "left")).toBe("no approach");
  });

  test("under the domain convention the one side is the limit", () => {
    const { answer } = findLimit(fn("sqrt", x), "x", ZERO, "both", "domain");
    expect(answer.kind === "value" && answer.withinDomain).toBe(true);
  });

  test("√(1 - x) at 1 lives on the left; ln x at 0 on the right", () => {
    expect(limit(fn("sqrt", sub(n(1), x)), at(n(1), 1))).toBe("only left 0");
    expect(limit(fn("ln", x), ZERO)).toBe("only right -inf");
  });

  test("a piecewise function with no 'otherwise' has no other side", () => {
    expect(limit(piecewise(compare(x, ">", n(0)), x, UNDEFINED), ZERO)).toBe(
      "only right 0"
    );
  });
});

describe("oscillation, proved", () => {
  test("a vanishing term does not rescue sin(1/x): sin(1/x) + x", () => {
    expect(limit(add(fn("sin", div(n(1), x)), x), ZERO)).toBe("DNE oscillates");
  });

  test("unbounded oscillation: x sin x at infinity", () => {
    expect(limit(mul(x, fn("sin", x)), INF)).toBe("DNE oscillates");
  });

  test("a factor tending to a non-zero number: sin(x)(1 + 1/x)", () => {
    expect(limit(mul(fn("sin", x), add(n(1), div(n(1), x))), INF)).toBe(
      "DNE oscillates"
    );
  });

  test("any continuous unbounded argument will do: sin(x²), sin(1/x² + x)", () => {
    expect(limit(fn("sin", pow(x, n(2))), INF)).toBe("DNE oscillates");
    expect(limit(fn("sin", add(div(n(1), pow(x, n(2))), x)), ZERO)).toBe(
      "DNE oscillates"
    );
  });

  test("what is not an oscillation is not called one", () => {
    // x + sin x runs off to infinity; the sine only wobbles it.
    expect(limit(add(x, fn("sin", x)), INF)).toBe("+inf");
    // Two oscillations can interfere, and proving they do not is a
    // different theorem.
    expect(
      limit(add(fn("sin", x), fn("sin", mul(fn("sqrt", n(2)), x))), INF)
    ).toBe("unknown");
  });

  test("e^{1/x} at 0: 0 from the left, +∞ from the right", () => {
    expect(limit(pow(e, div(n(1), x)), ZERO)).toBe("DNE 0 +inf");
  });
});

describe("L'Hôpital's rule, guarded", () => {
  test("applied twice where it helps: (eˣ - 1 - x)/x²", () => {
    const f = div(sub(sub(pow(e, x), n(1)), x), pow(x, n(2)));
    expect(limit(f, ZERO)).toBe("\\frac{1}{2}");
    expect(method(f, ZERO)).toContain("applied twice");
  });

  test("not trusted where it loops: √(x² + 1)/x at ±∞", () => {
    const f = div(fn("sqrt", add(pow(x, n(2)), n(1))), x);
    expect(limit(f, INF)).toBe("1");
    expect(limit(f, NEG_INF)).toBe("-1");
    expect(method(f, INF)).not.toContain("L'Hôpital");
  });
});

describe("the numeric check", () => {
  const right = { kind: "point", node: n(0), value: 0, side: 1 } as const;
  const one = { kind: "finite", value: X.fromInteger(1) } as const;

  test("confirms a right answer", () => {
    expect(checkLimit(div(fn("sin", x), x), "x", right, one)).toBe(
      "consistent"
    );
  });

  test("rejects a wrong one the values settle away from", () => {
    const two = { kind: "finite", value: X.fromInteger(2) } as const;
    expect(checkLimit(div(fn("sin", x), x), "x", right, two)).toBe("conflict");
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
    ).toBe("inconclusive");
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

describe("the numeric check, at a hundred digits", () => {
  const right = { kind: "point", node: n(0), value: 0, side: 1 } as const;
  const half = {
    kind: "finite",
    value: X.fromRational(Q.rational(1n, 2n)),
  } as const;

  test("sees (1 − cos x)/x² arrive, where doubles saw only rounding", () => {
    const f = div(sub(n(1), fn("cos", x)), pow(x, n(2)));
    const found = numericEvidence(f, "x", right, half);
    expect(found.verdict).toBe("consistent");
    expect(found.digits).toBeGreaterThanOrEqual(30);
  });

  test("still calls a wrong answer a conflict", () => {
    const f = div(sub(n(1), fn("cos", x)), pow(x, n(2)));
    const third = {
      kind: "finite",
      value: X.fromRational(Q.rational(1n, 3n)),
    } as const;
    expect(numericEvidence(f, "x", right, third).verdict).toBe("conflict");
  });

  test("and still does not claim a limit too slow to see", () => {
    const zero = { kind: "finite", value: X.ZERO } as const;
    expect(
      numericEvidence(
        div(n(1), fn("ln", x)),
        "x",
        { kind: "infinite", sign: 1 },
        zero
      ).verdict
    ).toBe("inconclusive");
  });

  test("e^π to fourteen places and beyond", () => {
    const f = pow(add(n(1), div(pi, x)), x);
    const { answer } = findLimit(f, "x", INF, "both");
    if (answer.kind !== "value") throw new Error("expected a value");
    const found = numericEvidence(
      f,
      "x",
      { kind: "infinite", sign: 1 },
      answer.limit
    );
    expect(found.digits).toBeGreaterThanOrEqual(14);
  });
});

describe("growth races, on Hardy's scale", () => {
  const ln = (a: Node) => fn("ln", a);
  const ex = (a: Node) => pow(e, a);

  test("a power against an exponential, however large the power", () => {
    expect(limit(div(pow(x, n(100)), ex(x)), INF)).toBe("0");
    expect(limit(div(pow(x, n(2)), pow(n(2), x)), INF)).toBe("0");
    expect(limit(sub(ex(x), pow(x, n(5))), INF)).toBe("+inf");
    expect(method(div(pow(x, n(100)), ex(x)), INF)).toMatch(/grow/i);
  });

  test("a logarithm against a power, and exponentials against each other", () => {
    expect(limit(div(pow(ln(x), n(100)), pow(x, div(n(1), n(100)))), INF)).toBe(
      "0"
    );
    expect(limit(div(pow(n(2), x), pow(n(3), x)), INF)).toBe("0");
    expect(limit(div(pow(x, ln(x)), ex(x)), INF)).toBe("0");
    expect(limit(div(ex(add(pow(x, n(2)), n(1))), ex(pow(x, n(2)))), INF)).toBe(
      "e"
    );
  });

  test("at a point, moved to infinity first", () => {
    // x^{-100} e^{-1/x²} at 0 is t^{100} e^{-t²} at infinity.
    expect(
      limit(div(ex(negative(div(n(1), pow(x, n(2))))), pow(x, n(100))), ZERO)
    ).toBe("0");
    expect(limit(pow(fn("sin", x), x), ZERO, "right")).toBe("1");
    expect(limit(pow(x, fn("sin", x)), ZERO, "right")).toBe("1");
    expect(limit(div(sub(pow(x, x), n(1)), mul(x, ln(x))), ZERO, "right")).toBe(
      "1"
    );
  });

  test("terms that cancel are looked past, not guessed at", () => {
    expect(limit(sub(ln(add(n(1), ex(x))), x), INF)).toBe("0");
    expect(limit(sub(ln(add(ex(x), pow(x, n(3)))), x), INF)).toBe("0");
    expect(limit(sub(ln(add(x, n(1))), ln(x)), INF)).toBe("0");
  });

  test("a bounded term beside one that runs off", () => {
    expect(limit(div(add(x, fn("sin", x)), x), INF)).toBe("1");
    expect(limit(mul(add(n(2), fn("sin", x)), x), INF)).toBe("+inf");
  });
});

describe("answers this used to get wrong", () => {
  test("a pole is not a large number", () => {
    // tan(π/2) is 1.6·10¹⁶ in floating point, and was once read as a finite
    // non-zero factor, answering 0.
    expect(
      limit(
        mul(sub(div(pi, n(2)), x), fn("tan", x)),
        at(div(pi, n(2)), Math.PI / 2)
      )
    ).toBe("1");
    expect(
      limit(mul(sub(n(1), x), fn("tan", div(mul(pi, x), n(2)))), at(n(1), 1))
    ).toBe(String.raw`\frac{2}{\pi}`);
  });

  test("an exponential is only faster than every power if its exponent outgrows ln x", () => {
    // e^{√ln x} runs off to infinity and is still smaller than x.
    expect(limit(div(pow(e, fn("sqrt", fn("ln", x))), x), INF)).not.toBe(
      "+inf"
    );
  });

  test("tanh at infinity finishes", () => {
    expect(limit(fn("tanh", x), INF)).toBe("1");
  });
});
