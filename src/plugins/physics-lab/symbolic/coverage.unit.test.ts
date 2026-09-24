/**
 * Fifty-eight integrals from a calculus course, run end to end.
 *
 * The other suites check one technique each, with the integrand chosen to
 * exercise it. This one is the opposite: a list of integrals somebody might
 * actually type, with no regard for which rule finishes them, and the only
 * assertion that matters is whether the answer differentiates back to the
 * integrand.
 *
 * Two things it is here to catch that a per-technique suite cannot. A rewrite
 * that stops firing because an earlier one now matches first: the count is
 * pinned, so an integral that quietly starts being refused fails the test. And
 * an answer that is *wrong* rather than absent, which is the failure mode the
 * whole layer is built to avoid and the one no amount of reading catches.
 *
 * The refusals are listed by name rather than counted, so that a new capability
 * has to be recorded here deliberately and a lost one cannot hide behind a
 * number.
 */
import { integrate } from "./integrate";
import { seriesAntiderivative } from "./series";
import {
  agreesOnSamples,
  evaluate,
  numericDerivative,
  toLatex,
  type Node,
} from "../../../symbolic";
import { AugBuilders, buildConfig } from "../../../../text-mode-core";

const { binop, functionCall, id, number } = AugBuilders;
const cfg = buildConfig({
  commandNames:
    "sin cos tan sec csc cot ln log exp sqrt sinh cosh tanh arcsin arccos arctan",
});
const emit = (n: Node) => toLatex(cfg, n);
const x = id("x");
const e = id("e");
const mul = (a: Node, b: Node) => binop("Multiply", a, b);
const div = (a: Node, b: Node) => binop("Divide", a, b);
const add = (a: Node, b: Node) => binop("Add", a, b);
const sub = (a: Node, b: Node) => binop("Subtract", a, b);
const pow = (a: Node, b: Node) => binop("Exponent", a, b);
const fn = (n: string, a: Node) => functionCall(id(n), [a]);
const neg = (a: Node): Node => ({ type: "Negative", arg: a });
const n = number;

const FAR: number[] = [2.3, 3.1, 4.2, 5.4];
const VERY_FAR: number[] = [3.4, 4.5, 6.1, 8.2];

const CASES: [string, Node, number[]?][] = [
  // --- partial fractions beyond two linear factors
  [
    "1/((x+1)(x+2)(x+3))",
    div(n(1), mul(mul(add(x, n(1)), add(x, n(2))), add(x, n(3)))),
  ],
  ["1/(x(x+1)^2)", div(n(1), mul(x, pow(add(x, n(1)), n(2))))],
  ["1/(x^3-x)", div(n(1), sub(pow(x, n(3)), x))],
  ["(x+1)/(x^2(x-1))", div(add(x, n(1)), mul(pow(x, n(2)), sub(x, n(1))))],
  ["x/((x-1)(x+2))", div(x, mul(sub(x, n(1)), add(x, n(2))))],
  ["1/(x^2(x^2+1))", div(n(1), mul(pow(x, n(2)), add(pow(x, n(2)), n(1))))],
  // --- even trig powers above two
  ["sin^4 x", pow(fn("sin", x), n(4))],
  ["cos^4 x", pow(fn("cos", x), n(4))],
  ["sin^6 x", pow(fn("sin", x), n(6))],
  ["tan^3 x", pow(fn("tan", x), n(3))],
  ["tan^4 x", pow(fn("tan", x), n(4))],
  ["sec^4 x", pow(fn("sec", x), n(4))],
  ["sin^2 x cos^2 x", mul(pow(fn("sin", x), n(2)), pow(fn("cos", x), n(2)))],
  ["sin^2 x cos^3 x", mul(pow(fn("sin", x), n(2)), pow(fn("cos", x), n(3)))],
  ["sin(3x)cos(2x)", mul(fn("sin", mul(n(3), x)), fn("cos", mul(n(2), x)))],
  // --- rational in sin/cos
  ["1/(1+cos x)", div(n(1), add(n(1), fn("cos", x)))],
  ["1/(2+sin x)", div(n(1), add(n(2), fn("sin", x)))],
  // --- roots
  [
    "1/(x^2 sqrt(1+x^2))",
    div(n(1), mul(pow(x, n(2)), fn("sqrt", add(n(1), pow(x, n(2)))))),
  ],
  ["1/(1+x^2)^{3/2}", div(n(1), pow(add(n(1), pow(x, n(2))), div(n(3), n(2))))],
  ["sqrt(x^2-1)", fn("sqrt", sub(pow(x, n(2)), n(1))), FAR],
  ["1/sqrt(x^2-4)", div(n(1), fn("sqrt", sub(pow(x, n(2)), n(4)))), FAR],
  ["x/sqrt(x+1)", div(x, fn("sqrt", add(x, n(1))))],
  ["sqrt(x)/(1+x)", div(fn("sqrt", x), add(n(1), x))],
  [
    "1/(x sqrt(x^2-1))",
    div(n(1), mul(x, fn("sqrt", sub(pow(x, n(2)), n(1))))),
    FAR,
  ],
  // --- completing the square
  [
    "1/sqrt(3-2x-x^2)",
    div(n(1), fn("sqrt", sub(sub(n(3), mul(n(2), x)), pow(x, n(2))))),
  ],
  ["1/(x^2+4x+8)", div(n(1), add(add(pow(x, n(2)), mul(n(4), x)), n(8)))],
  // --- parts, repeated
  ["x^3 e^x", mul(pow(x, n(3)), pow(e, x))],
  ["x^2 e^{-x}", mul(pow(x, n(2)), pow(e, neg(x)))],
  ["ln(x)^2", pow(fn("ln", x), n(2))],
  ["x (ln x)^2", mul(x, pow(fn("ln", x), n(2)))],
  ["arcsin(x)^2", pow(fn("arcsin", x), n(2))],
  ["e^x sin x cos x", mul(pow(e, x), mul(fn("sin", x), fn("cos", x)))],
  // --- misc standards
  ["1/(e^x+1)", div(n(1), add(pow(e, x), n(1)))],
  ["e^x/(e^{2x}+1)", div(pow(e, x), add(pow(e, mul(n(2), x)), n(1)))],
  ["x 2^x", mul(x, pow(n(2), x))],
  ["cos(ln x)", fn("cos", fn("ln", x))],
  ["ln(x)/x^2", div(fn("ln", x), pow(x, n(2)))],
  ["x/(x^4+1)", div(x, add(pow(x, n(4)), n(1)))],
  [
    "1/(x ln x ln(ln x))",
    div(n(1), mul(mul(x, fn("ln", x)), fn("ln", fn("ln", x)))),
    VERY_FAR,
  ],
  ["sqrt(1+sqrt(x))", fn("sqrt", add(n(1), fn("sqrt", x)))],
  ["(2x+1)^{10}", pow(add(mul(n(2), x), n(1)), n(10))],
  ["x^2 sqrt(x+1)", mul(pow(x, n(2)), fn("sqrt", add(x, n(1))))],
  ["1/(sqrt(x)+x)", div(n(1), add(fn("sqrt", x), x))],
  ["sinh^2 x", pow(fn("sinh", x), n(2))],
  ["x cosh x", mul(x, fn("cosh", x))],
  ["arctan(sqrt(x))", fn("arctan", fn("sqrt", x))],
  // --- irrational factors, reductions, and parts on one factor of three
  ["1/(x^4+1)", div(n(1), add(pow(x, n(4)), n(1)))],
  ["1/(sin x + cos x)", div(n(1), add(fn("sin", x), fn("cos", x)))],
  ["sqrt(tan x)", fn("sqrt", fn("tan", x))],
  ["sec^5 x", pow(fn("sec", x), n(5))],
  ["1/(x^2+1)^2", div(n(1), pow(add(pow(x, n(2)), n(1)), n(2)))],
  ["tan^5 x", pow(fn("tan", x), n(5))],
  [
    "1/(x^2 sqrt(x^2+4))",
    div(n(1), mul(pow(x, n(2)), fn("sqrt", add(pow(x, n(2)), n(4))))),
  ],
  // --- tabular integration over three factors
  ["x sin x e^x", mul(mul(x, fn("sin", x)), pow(e, x))],
  ["x^2 e^x sin x", mul(mul(pow(x, n(2)), pow(e, x)), fn("sin", x))],
  ["x^6 e^x", mul(pow(x, n(6)), pow(e, x))],
  // --- symbolic parameters
  ["k x e^{kx}", mul(mul(id("k"), x), pow(e, mul(id("k"), x)))],
  ["1/(x^2+a^2)", div(n(1), add(pow(x, n(2)), pow(id("a"), n(2))))],
];

/**
 * The integrals this still cannot do. Empty since `arcsin(x)^2` went through:
 * it needed parts with `dv = 2x dx/sqrt(1-x^2)`, one factor of three rather
 * than one side of a product, and the flattened choice now makes it.
 */
const KNOWN_REFUSALS = new Set<string>([]);

test("the integrals a course asks for", () => {
  const rows: string[] = [];
  let ok = 0;
  let refused = 0;
  const wrongly: string[] = [];
  const refusals: string[] = [];
  for (const [label, node, points] of CASES) {
    const samples = (points ?? [0.13, 0.29, 0.44, 0.61, 0.77]).map((v) => ({
      x: v,
      k: 1.4,
      a: 2.1,
    }));
    let out: string;
    try {
      const r = integrate(node, "x");
      const good = agreesOnSamples(
        (b) => numericDerivative(r, "x", b),
        (b) => evaluate(node, b),
        samples,
        1e-5
      );
      if (good) {
        ok += 1;
        out = "OK    " + emit(r).slice(0, 95);
      } else {
        wrongly.push(`${label} -> ${emit(r)}`);
        out = "WRONG " + emit(r).slice(0, 95);
      }
    } catch (error) {
      refused += 1;
      refusals.push(label);
      let note = "";
      try {
        const s = seriesAntiderivative(node, "x");
        note = "  (series: " + emit(s.term).slice(0, 50) + ")";
      } catch {
        note = "";
      }
      out = "REF   " + (error as Error).message.slice(0, 60) + note;
    }
    rows.push(label.padEnd(26) + out);
  }
  // Named, not counted: the message says which integral and what it answered.
  expect({ wrong: wrongly }).toEqual({ wrong: [] });
  expect({ refused: refusals.sort() }).toEqual({
    refused: [...KNOWN_REFUSALS].sort(),
  });
  expect(ok).toBe(CASES.length - KNOWN_REFUSALS.size);
  // The table is built either way and only looked at on a failure, where the
  // assertions above have already named the integral.
  void rows;
  void refused;
});
