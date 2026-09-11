/**
 * The second half of an exam question: the particular solution through a point.
 *
 * Each case here solves the equation first and then puts a point through the
 * answer, so these exercise the real pairing rather than a hand-written
 * solution shape.
 */
import { solveFirstOrder } from "./ode";
import { particularConstant } from "./initial";
import { Aug, AugBuilders, buildConfig } from "../../../../text-mode-core";

const { binop, functionCall, id, number } = AugBuilders;

type Node = Aug.Latex.AnyChild;

const cfg = buildConfig({
  commandNames: "sin cos tan ln log exp sqrt pi",
});

const x = id("x");
const y = id("y");
const mul = (a: Node, b: Node) => binop("Multiply", a, b);
const div = (a: Node, b: Node) => binop("Divide", a, b);
const sub = (a: Node, b: Node) => binop("Subtract", a, b);

/** Solves the equation, then sends it through (x0, y0). */
function through(f: Node, x0: Node, y0: Node) {
  const solved = solveFirstOrder(cfg, f);
  if (!solved.ok) throw new Error(`could not solve: ${solved.error}`);
  return particularConstant(cfg, solved.solution, x0, y0);
}

const constantOf = (f: Node, x0: Node, y0: Node) => {
  const result = through(f, x0, y0);
  if (!result.ok) throw new Error(`no constant: ${result.error}`);
  return result;
};

describe("the constant that puts a solution through a point", () => {
  test("a direct antiderivative", () => {
    // dy/dx = 2x gives y = x² + C; through (1, 5) needs C = 4.
    expect(constantOf(mul(number(2), x), number(1), number(5)).latex).toBe(
      "C=4"
    );
  });

  test("exponential growth, where C is a multiplier rather than an offset", () => {
    // dy/dx = 2y gives y = Ce^{2x}; through (0, 3) needs C = 3.
    const found = constantOf(mul(number(2), y), number(0), number(3));
    expect(found.value).toBeCloseTo(3, 10);
  });

  test("Newton's cooling, where the constant sits beside an equilibrium", () => {
    // dy/dx = 2(10 - y) gives y = 10 + Ce^{-2x}; from 90 degrees, C = 80.
    const found = constantOf(
      mul(number(2), sub(number(10), y)),
      number(0),
      number(90)
    );
    expect(found.value).toBeCloseTo(80, 10);
  });

  test("the logistic equation, where C is in a denominator", () => {
    // dy/dx = y(1-y) gives y = 1/(1+Ce^{-x}); through (0, 1/2) needs C = 1.
    const found = constantOf(
      mul(y, sub(number(1), y)),
      number(0),
      div(number(1), number(2))
    );
    expect(found.value).toBeCloseTo(1, 10);
  });

  test("an implicit relation, where C is the gap between the two sides", () => {
    // dy/dx = x/y gives y²/2 = x²/2 + C; through (0, 2) needs C = 2.
    const found = constantOf(div(x, y), number(0), number(2));
    expect(found.value).toBeCloseTo(2, 10);
  });

  test("the condition may itself be exact", () => {
    // dy/dx = cos(x) gives y = sin(x) + C; through (0, pi) needs C = pi.
    const found = constantOf(functionCall(id("cos"), [x]), number(0), id("pi"));
    expect(found.latex).toBe("C=\\pi");
  });
});

describe("what it will not claim", () => {
  test("a point the family cannot reach", () => {
    // y = Ce^{2x} is zero at x = 0 for no C but C = 0, and y = 0 is the one
    // member that stays there — asking for (0, 0) picks C = 0, which is fine.
    // Asking for a y at an x where the constant has dropped out is not.
    const solved = solveFirstOrder(cfg, mul(number(2), y));
    if (!solved.ok) throw new Error("expected a solution");
    const result = particularConstant(
      cfg,
      { tree: number(5) },
      number(0),
      number(3)
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/drops out/i);
  });

  test("a solution with nothing to substitute into", () => {
    const result = particularConstant(cfg, {}, number(0), number(1));
    expect(result.ok).toBe(false);
  });
});
