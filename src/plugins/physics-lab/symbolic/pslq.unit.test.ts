/** PSLQ on relations whose answers are known. */
import { integerRelation } from "./pslq";
import { decimalContext } from "../../../symbolic";

const D = decimalContext(80);
const pi = D.acos(-1);
const e = D.exp(1);
const sqrt5 = D.sqrt(5);

const find = (xs: InstanceType<typeof D>[], digits = 40, max = 1000) =>
  integerRelation(xs, { digits, maxCoefficient: max })?.map(Number);

test("the golden ratio: 2φ − 1 − √5 = 0", () => {
  const phi = new D(1).plus(sqrt5).div(2);
  expect(find([phi, new D(1), sqrt5])).toEqual([2, -1, -1]);
});

test("π²/6 against 1 and π²: 6x − π² = 0", () => {
  const x = pi.pow(2).div(6);
  expect(find([x, new D(1), pi.pow(2)])).toEqual([6, 0, -1]);
});

test("a product through logarithms: ln(π² e / √2)", () => {
  const value = pi.pow(2).times(e).div(D.sqrt(2));
  // 2 ln v = 4 ln π + 2 − ln 2.
  expect(find([D.ln(value), new D(1), D.ln(2), D.ln(pi)])).toEqual([
    2, -2, 1, -4,
  ]);
});

test("no relation among numbers that have none", () => {
  expect(find([pi, e, new D(1)], 40, 10_000)).toBeUndefined();
});

test("too few digits to trust: nothing claimed at coefficient bound", () => {
  // At 8 digits a random-looking relation with coefficients near 100 is
  // expected by chance; bounded at 5, none is found.
  expect(find([pi, e, new D(1)], 8, 5)).toBeUndefined();
});
