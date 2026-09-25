/**
 * The double-exponential rules against integrals whose values are known to
 * many more digits than a double holds, including the endpoint singularities
 * they exist for, and the integrals that must not come back as a number.
 */
import { preciseIntegral } from "./quadrature";
import type { Bound } from "./definite";
import { AugBuilders } from "../../../../text-mode-core";
import type { Node } from "../../../symbolic";

const { binop, functionCall, id, number: n } = AugBuilders;
const x = id("x");
const fn = (name: string, a: Node) => functionCall(id(name), [a]);
const div = (a: Node, b: Node) => binop("Divide", a, b);
const add = (a: Node, b: Node) => binop("Add", a, b);
const sub = (a: Node, b: Node) => binop("Subtract", a, b);
const pow = (a: Node, b: Node) => binop("Exponent", a, b);
const negative = (arg: Node): Node => ({ type: "Negative", arg });

const INF: Bound = { kind: "infinite", sign: 1 };
const NEG_INF: Bound = { kind: "infinite", sign: -1 };
const at = (value: number): Bound => ({
  kind: "finite",
  node: n(value),
  value,
});

/** The first `places` decimals, cut off rather than rounded. */
const digits = (node: Node, lower: Bound, upper: Bound, places: number) => {
  const found = preciseIntegral(node, "x", lower, upper);
  if (found === undefined) throw new Error("did not settle");
  return found.value.toFixed(places, 1);
};

describe("known values, to thirty places", () => {
  test("the Gaussian over the whole line is √π", () => {
    expect(digits(pow(id("e"), negative(pow(x, n(2)))), NEG_INF, INF, 30)).toBe(
      "1.772453850905516027298167483341"
    );
  });

  test("ln(1 + x)/x on [0, 1] is π²/12", () => {
    expect(digits(div(fn("ln", add(n(1), x)), x), at(0), at(1), 30)).toBe(
      "0.822467033424113218236207583323"
    );
  });

  test("a singular endpoint costs nothing: 1/√(1 − x²) on [−1, 1] is π", () => {
    expect(
      digits(div(n(1), fn("sqrt", sub(n(1), pow(x, n(2))))), at(-1), at(1), 28)
    ).toBe("3.1415926535897932384626433832");
  });

  test("bounds the other way round change the sign", () => {
    expect(digits(pow(x, n(2)), at(1), at(0), 20)).toBe(
      "-0.33333333333333333333"
    );
  });
});

describe("what does not settle is not a number", () => {
  test("a divergent integral", () => {
    expect(preciseIntegral(div(n(1), x), "x", at(0), at(1))).toBeUndefined();
  });

  test("an oscillation out to infinity", () => {
    expect(
      preciseIntegral(div(fn("sin", x), x), "x", at(0), INF)
    ).toBeUndefined();
  });
});
