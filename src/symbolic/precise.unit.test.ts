/**
 * The precise evaluator against constants known to many more digits than a
 * double holds, and on the rounding that makes doubles useless near a limit.
 */
import { AugBuilders } from "../../text-mode-core";
import { decimalContext, evaluatePrecise } from "./precise";
import { evaluate } from "./evaluate";
import type { Node } from "./tree";

const { binop, functionCall, id, number: n } = AugBuilders;
const x = id("x");
const fn = (name: string, a: Node) => functionCall(id(name), [a]);
const pow = (a: Node, b: Node) => binop("Exponent", a, b);
const sub = (a: Node, b: Node) => binop("Subtract", a, b);
const D = decimalContext();

/** Digits of the value, cut off (not rounded) after `places` decimal places. */
const fixed = (node: Node, places: number) =>
  evaluatePrecise(node, {}).toFixed(places, D.ROUND_DOWN);

describe("known constants, far past sixteen digits", () => {
  test.each([
    ["π", id("pi"), "3.14159265358979323846264338327950288419716939937510"],
    ["e", id("e"), "2.71828182845904523536028747135266249775724709369995"],
    [
      "√2",
      fn("sqrt", n(2)),
      "1.41421356237309504880168872420969807856967187537694",
    ],
    [
      "ln 2",
      fn("ln", n(2)),
      "0.69314718055994530941723212145817656807550013436025",
    ],
    [
      "sin 1",
      fn("sin", n(1)),
      "0.84147098480789650665250232163029899962256306079837",
    ],
    [
      "e^π",
      pow(id("e"), id("pi")),
      "23.14069263277926900572908636794854738026610624260021",
    ],
  ] as [string, Node, string][])("%s", (_, node, digits) => {
    const places = digits.split(".")[1].length;
    expect(fixed(node, places)).toBe(digits);
  });
});

test("1 − cos x near 0: a double sees 0, the precise value does not", () => {
  const f = sub(n(1), fn("cos", x));
  expect(evaluate(f, { x: 1e-9 })).toBe(0);
  const precise = evaluatePrecise(f, { x: new D("1e-9") });
  // 1 − cos h = h²/2 − h⁴/24 + …: 5·10⁻¹⁹ to every digit shown.
  expect(precise.toExponential(14)).toBe("5.00000000000000e-19");
});

test("what a double cannot evaluate, this cannot either: NaN in the same places", () => {
  expect(evaluatePrecise(fn("ln", n(-1)), {}).isNaN()).toBe(true);
  expect(evaluatePrecise(fn("sqrt", n(-4)), {}).isNaN()).toBe(true);
  expect(
    evaluatePrecise(pow(n(-8), binop("Divide", n(1), n(3))), {}).isNaN()
  ).toBe(true);
  expect(evaluatePrecise(id("a"), {}).isNaN()).toBe(true);
});
