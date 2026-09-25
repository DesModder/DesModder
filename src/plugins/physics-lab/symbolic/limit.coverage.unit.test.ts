/**
 * The coverage set from the limit research (docs/PHYSICS_LAB_LIMIT_RESEARCH_BRIEF.md
 * and GPT's answer to it): fifty limits spanning AP Calculus Unit 1 and the
 * limits Units 6 and 10 lean on, each with its established answer.
 *
 * Rows 45–48 are limits of integrals and partial sums, which belong to a
 * Sums tab rather than to this one, and row 43, (−1)^n, is a sequence with no
 * real function behind it; they are not here. Row 42 repeats row 40.
 *
 * Five rows are refusal fixtures — true answers this engine is not yet
 * entitled to — and three remain: 27, 30 and 50. Rows 29 and 49, sin(1/x² + x)
 * at 0 and sin(x²) at infinity, were fixtures in the research and are proved
 * here: their arguments are continuous and unbounded, which is all the
 * oscillation proof needs, with no inverse of the phase required.
 *
 * Every answered row is also held to two more things: at least one textbook
 * route reaches it, and the numbers near the point do not conflict with it.
 */
import { findLimit, numericEvidence, type LimitSide } from "./limit";
import { limitRoutes } from "./limitSteps";
import type { Approach, Bound } from "./definite";
import * as X from "./exact";
import { AugBuilders } from "../../../../text-mode-core";
import type { Node } from "../../../symbolic";

const { binop, functionCall, id, number: n } = AugBuilders;
const x = id("x");
const e = id("e");
const mul = (a: Node, b: Node) => binop("Multiply", a, b);
const div = (a: Node, b: Node) => binop("Divide", a, b);
const add = (a: Node, b: Node) => binop("Add", a, b);
const sub = (a: Node, b: Node) => binop("Subtract", a, b);
const pow = (a: Node, b: Node) => binop("Exponent", a, b);
const fn = (name: string, a: Node) => functionCall(id(name), [a]);
const neg = (arg: Node): Node => ({ type: "Negative", arg });
const piecewise = (bound: number, below: Node, otherwise: Node) =>
  ({
    type: "Piecewise",
    condition: { type: "Comparator", left: x, operator: "<", right: n(bound) },
    consequent: below,
    alternate: otherwise,
  }) as unknown as Node;

const INF: Bound = { kind: "infinite", sign: 1 };
const NEG_INF: Bound = { kind: "infinite", sign: -1 };
const at = (value: number): Bound => ({
  kind: "finite",
  node: n(value),
  value,
});

type Row = [number, string, Node, Bound, LimitSide, string];

const ROWS: Row[] = [
  [
    1,
    "(x²−4)/(x−2), x→2",
    div(sub(pow(x, n(2)), n(4)), sub(x, n(2))),
    at(2),
    "both",
    "4",
  ],
  [
    2,
    "(x²−9)/(x−3), x→3",
    div(sub(pow(x, n(2)), n(9)), sub(x, n(3))),
    at(3),
    "both",
    "6",
  ],
  [
    3,
    "(x³−1)/(x−1), x→1",
    div(sub(pow(x, n(3)), n(1)), sub(x, n(1))),
    at(1),
    "both",
    "3",
  ],
  [
    4,
    "(√(x+4)−2)/x, x→0",
    div(sub(fn("sqrt", add(x, n(4))), n(2)), x),
    at(0),
    "both",
    "\\frac{1}{4}",
  ],
  [
    5,
    "(√(1+x)−1)/x, x→0",
    div(sub(fn("sqrt", add(n(1), x)), n(1)), x),
    at(0),
    "both",
    "\\frac{1}{2}",
  ],
  [6, "sin x/x, x→0", div(fn("sin", x), x), at(0), "both", "1"],
  [
    7,
    "sin 3x/sin 5x, x→0",
    div(fn("sin", mul(n(3), x)), fn("sin", mul(n(5), x))),
    at(0),
    "both",
    "\\frac{3}{5}",
  ],
  [
    8,
    "(1−cos x)/x², x→0",
    div(sub(n(1), fn("cos", x)), pow(x, n(2))),
    at(0),
    "both",
    "\\frac{1}{2}",
  ],
  [
    9,
    "(1−cos²x)/x², x→0",
    div(sub(n(1), pow(fn("cos", x), n(2))), pow(x, n(2))),
    at(0),
    "both",
    "1",
  ],
  [10, "tan x/x, x→0", div(fn("tan", x), x), at(0), "both", "1"],
  [11, "x sin(1/x), x→0", mul(x, fn("sin", div(n(1), x))), at(0), "both", "0"],
  [
    12,
    "x² cos(1/x), x→0",
    mul(pow(x, n(2)), fn("cos", div(n(1), x))),
    at(0),
    "both",
    "0",
  ],
  [13, "|x|, x→0", fn("abs", x), at(0), "both", "0"],
  [14, "|x|/x, x→0", div(fn("abs", x), x), at(0), "both", "DNE -1 1"],
  [15, "1/x, x→0", div(n(1), x), at(0), "both", "DNE -inf +inf"],
  [16, "1/x², x→0", div(n(1), pow(x, n(2))), at(0), "both", "+inf"],
  [17, "−1/x², x→0", neg(div(n(1), pow(x, n(2)))), at(0), "both", "-inf"],
  [
    18,
    "1/(x−2)³, x→2",
    div(n(1), pow(sub(x, n(2)), n(3))),
    at(2),
    "both",
    "DNE -inf +inf",
  ],
  [
    19,
    "sin(1/x), x→0",
    fn("sin", div(n(1), x)),
    at(0),
    "both",
    "DNE oscillates",
  ],
  [
    20,
    "cos(1/x), x→0",
    fn("cos", div(n(1), x)),
    at(0),
    "both",
    "DNE oscillates",
  ],
  [
    21,
    "sin(1/x)+x, x→0",
    add(fn("sin", div(n(1), x)), x),
    at(0),
    "both",
    "DNE oscillates",
  ],
  [22, "e^(1/x), x→0", pow(e, div(n(1), x)), at(0), "both", "DNE 0 +inf"],
  [
    23,
    "{x<1: x², 2x+1}, x→1",
    piecewise(1, pow(x, n(2)), add(mul(n(2), x), n(1))),
    at(1),
    "both",
    "DNE 1 3",
  ],
  [24, "floor x, x→2", fn("floor", x), at(2), "both", "DNE 1 2"],
  [25, "sign x, x→0", fn("sign", x), at(0), "both", "DNE -1 1"],
  [
    26,
    "{x<1: x², 2x−1}, x→1",
    piecewise(1, pow(x, n(2)), sub(mul(n(2), x), n(1))),
    at(1),
    "both",
    "1",
  ],
  [
    27,
    "sin x + sin(√2 x), x→∞ (refusal fixture)",
    add(fn("sin", x), fn("sin", mul(fn("sqrt", n(2)), x))),
    INF,
    "both",
    "unknown",
  ],
  [28, "ln x, x→0⁺", fn("ln", x), at(0), "right", "-inf"],
  [
    29,
    "sin(1/x² + x), x→0 (proved here)",
    fn("sin", add(div(n(1), pow(x, n(2))), x)),
    at(0),
    "both",
    "DNE oscillates",
  ],
  [
    30,
    "floor(sin(x²)), x→∞ (refusal fixture)",
    fn("floor", fn("sin", pow(x, n(2)))),
    INF,
    "both",
    "unknown",
  ],
  [
    31,
    "(3x²+1)/(2x²−x), x→∞",
    div(add(mul(n(3), pow(x, n(2))), n(1)), sub(mul(n(2), pow(x, n(2))), x)),
    INF,
    "both",
    "\\frac{3}{2}",
  ],
  [32, "x/(x²+1), x→∞", div(x, add(pow(x, n(2)), n(1))), INF, "both", "0"],
  [
    33,
    "√(4x²+1)/x, x→−∞",
    div(fn("sqrt", add(mul(n(4), pow(x, n(2))), n(1))), x),
    NEG_INF,
    "both",
    "-2",
  ],
  [
    34,
    "(2x³−1)/(x²+1), x→∞",
    div(sub(mul(n(2), pow(x, n(3))), n(1)), add(pow(x, n(2)), n(1))),
    INF,
    "both",
    "+inf",
  ],
  [35, "cos x/x, x→∞", div(fn("cos", x), x), INF, "both", "0"],
  [36, "(eˣ−1)/x, x→0", div(sub(pow(e, x), n(1)), x), at(0), "both", "1"],
  [37, "ln(1+x)/x, x→0", div(fn("ln", add(n(1), x)), x), at(0), "both", "1"],
  [
    38,
    "(eˣ−1−x)/x², x→0",
    div(sub(sub(pow(e, x), n(1)), x), pow(x, n(2))),
    at(0),
    "both",
    "\\frac{1}{2}",
  ],
  [39, "xˣ, x→0⁺", pow(x, x), at(0), "right", "1"],
  [40, "(1+1/x)ˣ, x→∞", pow(add(n(1), div(n(1), x)), x), INF, "both", "e"],
  [
    41,
    "(2x+1)/(3x−2), x→∞",
    div(add(mul(n(2), x), n(1)), sub(mul(n(3), x), n(2))),
    INF,
    "both",
    "\\frac{2}{3}",
  ],
  [44, "x/(x+1), x→∞", div(x, add(x, n(1))), INF, "both", "1"],
  [
    49,
    "sin(x²), x→∞ (proved here)",
    fn("sin", pow(x, n(2))),
    INF,
    "both",
    "DNE oscillates",
  ],
  [
    50,
    "floor(sin(1/x)), x→0 (refusal fixture)",
    fn("floor", fn("sin", div(n(1), x))),
    at(0),
    "both",
    "unknown",
  ],
];

function summary(node: Node, where: Bound, side: LimitSide) {
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
    case "one-side-only":
      return `only ${answer.side > 0 ? "right" : "left"} ${show(answer.limit)}`;
    case "no-approach":
      return "no approach";
    case "unknown":
      return "unknown";
  }
}

describe("the fifty-limit coverage set", () => {
  test.each(ROWS)("row %i: %s", (_, __, node, where, side, expected) => {
    expect(summary(node, where, side)).toBe(expected);
  });
});

describe("every answer in it can be explained, and survives its numbers", () => {
  test.each(
    ROWS.filter(([, , , , , expected]) => !/DNE|unknown/.test(expected))
  )("row %i: %s", (_, __, node, where, side) => {
    const { answer, form } = findLimit(node, "x", where, side);
    if (answer.kind !== "value") throw new Error("expected a value");
    const s = answer.side ?? 1;
    const approach: Approach =
      where.kind === "infinite"
        ? { kind: "infinite", sign: where.sign }
        : { kind: "point", node: where.node, value: where.value, side: s };
    const routes = limitRoutes({
      original: node,
      node: answer.method.resolved,
      variable: "x",
      approach,
      limit: answer.limit,
      method: answer.method,
      form,
    });
    expect(routes.length).toBeGreaterThan(0);
    // Sampled at a hundred digits: every finite answer here is met to twelve
    // decimal places or more, and no answer is contradicted.
    const evidence = numericEvidence(node, "x", approach, answer.limit);
    expect(evidence.verdict).toBe("consistent");
    if (answer.limit.kind === "finite")
      expect(evidence.digits).toBeGreaterThanOrEqual(12);
  });
});
