/**
 * The explanations: which textbook route leads for each classic limit, which
 * others are offered, and that every route ends on the proved answer.
 * `limitRoutes` already discards a route that does not, so the test that
 * matters is that the routes a course expects are still there.
 */
import { findLimit } from "./limit";
import { limitRoutes } from "./limitSteps";
import type { Approach, Bound } from "./definite";
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

const INF: Bound = { kind: "infinite", sign: 1 };
const at = (value: number): Bound => ({
  kind: "finite",
  node: n(value),
  value,
});

/** The route ids offered, leading one first. */
function routes(node: Node, where: Bound) {
  const { answer, form } = findLimit(node, "x", where, "both");
  if (answer.kind !== "value") return [`no value: ${answer.kind}`];
  const approach: Approach =
    where.kind === "infinite"
      ? { kind: "infinite", sign: where.sign }
      : { kind: "point", node: where.node, value: where.value, side: 1 };
  return limitRoutes({
    original: node,
    node: answer.method.resolved,
    variable: "x",
    approach,
    limit: answer.limit,
    method: answer.method,
    form,
  }).map((route) => route.id);
}

test("a continuous function: substitution", () => {
  expect(routes(add(pow(x, n(2)), n(1)), at(3))[0]).toBe("substitution");
});

test("(x² − 4)/(x − 2): factor and cancel first, L'Hôpital offered", () => {
  const found = routes(div(sub(pow(x, n(2)), n(4)), sub(x, n(2))), at(2));
  expect(found[0]).toBe("factor");
  expect(found).toContain("lhopital");
});

test("(x³ − 1)/(x − 1): the factor theorem finds the cube's factor", () => {
  expect(routes(div(sub(pow(x, n(3)), n(1)), sub(x, n(1))), at(1))[0]).toBe(
    "factor"
  );
});

test("(√(x + 4) − 2)/x and x/(√(x + 4) − 2): the conjugate", () => {
  const root = fn("sqrt", add(x, n(4)));
  expect(routes(div(sub(root, n(2)), x), at(0))[0]).toBe("conjugate");
  expect(routes(div(x, sub(root, n(2))), at(0))[0]).toBe("conjugate");
});

test("sin(3x)/sin(5x) and sin x/x: the standard trigonometric limit", () => {
  expect(
    routes(div(fn("sin", mul(n(3), x)), fn("sin", mul(n(5), x))), at(0))[0]
  ).toBe("trigonometric");
  const found = routes(div(fn("sin", x), x), at(0));
  expect(found[0]).toBe("trigonometric");
  expect(found).toEqual(expect.arrayContaining(["lhopital", "series"]));
});

test("a rational function at infinity: divide by the highest power", () => {
  expect(
    routes(
      div(add(mul(n(3), pow(x, n(2))), n(1)), sub(mul(n(2), pow(x, n(2))), x)),
      INF
    )[0]
  ).toBe("highest-power");
});

test("x sin(1/x) at 0: squeeze", () => {
  expect(routes(mul(x, fn("sin", div(n(1), x))), at(0))[0]).toBe("squeeze");
});

test("1/x² at 0: the sign of each part", () => {
  expect(routes(div(n(1), pow(x, n(2))), at(0))[0]).toBe("pole");
});

test("(1 + 1/x)^x: write it as e to a limit", () => {
  expect(routes(pow(add(n(1), div(n(1), x)), x), INF)[0]).toBe("exponential");
});

test("(eˣ − 1 − x)/x²: L'Hôpital twice, and the leading term", () => {
  const found = routes(div(sub(sub(pow(e, x), n(1)), x), pow(x, n(2))), at(0));
  expect(found).toEqual(expect.arrayContaining(["lhopital", "series"]));
});

describe("growth rates, explained", () => {
  test("x¹⁰⁰/eˣ is shown as a race eˣ wins", () => {
    const node = binop(
      "Divide",
      binop("Exponent", id("x"), n(100)),
      binop("Exponent", id("e"), id("x"))
    );
    const { answer } = findLimit(
      node,
      "x",
      { kind: "infinite", sign: 1 },
      "both"
    );
    if (answer.kind !== "value") throw new Error(answer.kind);
    const routes = limitRoutes({
      original: node,
      node,
      variable: "x",
      approach: { kind: "infinite", sign: 1 },
      limit: answer.limit,
      method: answer.method,
    });
    const growth = routes.find((r) => r.id === "growth");
    expect(growth?.name).toBe("Compare growth rates");
    expect(growth?.steps[0].why).toMatch(/ln t/);
  });
});
