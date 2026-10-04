import {
  differentiate,
  evaluate,
  fold,
  implicitProducts,
  sameTree,
  toLatex,
} from "./index";
import { Aug, AugBuilders, buildConfig } from "../../text-mode-core";

const { binop, functionCall, id, number } = AugBuilders;

type Node = Aug.Latex.AnyChild;

/**
 * The trees are built by hand in the shapes Desmos's parser produces, which
 * the round-trip suite pins against the real parser: `x(y-1)` is a call of x,
 * `x(y-1)^2` is a power of that call, and `(x(y-1))^2` is the same power with
 * the call marked `parenWrapped`.
 */
const cfg = buildConfig({ commandNames: "sin cos" });
const emit = (node: Node) => toLatex(cfg, node);

const x = id("x");
const y = id("y");
const sub = (a: Node, b: Node) => binop("Subtract", a, b);
const add = (a: Node, b: Node) => binop("Add", a, b);
const mul = (a: Node, b: Node) => binop("Multiply", a, b);
const pow = (a: Node, b: Node) => binop("Exponent", a, b);
const callOf = (name: string, ...args: Node[]) => functionCall(id(name), args);
const bracketed = (call: Aug.Latex.FunctionCall) => ({
  ...call,
  parenWrapped: true,
});

const coordinates = new Set(["x", "y"]);

describe("implicitProducts", () => {
  test("a call of a value is multiplication", () => {
    const read = implicitProducts(callOf("x", sub(y, number(1))), coordinates);
    expect(sameTree(read, mul(x, sub(y, number(1))))).toBe(true);
  });

  test("a call of anything else is left a call", () => {
    // f may be defined in the graph, and sin certainly is a function.
    for (const name of ["f", "sin"]) {
      const call = callOf(name, x);
      expect(sameTree(implicitProducts(call, coordinates), call)).toBe(true);
    }
  });

  test("a call with two arguments is left alone, value or not", () => {
    const call = callOf("x", y, number(1));
    expect(sameTree(implicitProducts(call, coordinates), call)).toBe(true);
  });

  test("calls nested in calls are read from the inside out", () => {
    // y(x(y)) = y·(x·y)
    const read = implicitProducts(callOf("y", callOf("x", y)), coordinates);
    expect(sameTree(read, mul(y, mul(x, y)))).toBe(true);
    // sin(x(y)) keeps its call and loses the inner one.
    const inside = implicitProducts(callOf("sin", callOf("x", y)), coordinates);
    expect(sameTree(inside, callOf("sin", mul(x, y)))).toBe(true);
  });

  test("a power after the bracket belongs to the bracket", () => {
    // x(y-1)^2 = x·(y-1)², which is how Desmos evaluates it.
    const read = implicitProducts(
      pow(callOf("x", sub(y, number(1))), number(2)),
      coordinates
    );
    expect(emit(read)).toBe(emit(mul(x, pow(sub(y, number(1)), number(2)))));
  });

  test("a power of a bracketed call squares the whole product", () => {
    // (x(y-1))^2 = (x·(y-1))²
    const read = implicitProducts(
      pow(bracketed(callOf("x", sub(y, number(1)))), number(2)),
      coordinates
    );
    expect(emit(read)).toBe(emit(pow(mul(x, sub(y, number(1))), number(2))));
  });

  test("the bracket mark does not make two calls different trees", () => {
    // Physics Lab's rules rebuild sin(3x) and must cancel it against the
    // user's (sin(3x)).
    const call = callOf("sin", mul(number(3), x));
    expect(sameTree(bracketed(call), call)).toBe(true);
    expect(sameTree(call, bracketed(call))).toBe(true);
  });

  test("a factorial after the bracket belongs to the bracket", () => {
    const read = implicitProducts(
      { type: "Factorial", arg: callOf("x", y) },
      coordinates
    );
    expect(emit(read)).toBe(emit(mul(x, { type: "Factorial", arg: y })));
    const whole = implicitProducts(
      { type: "Factorial", arg: bracketed(callOf("x", y)) },
      coordinates
    );
    expect(emit(whole)).toBe(emit({ type: "Factorial", arg: mul(x, y) }));
  });

  test("a power of a function's call is still the power of its value", () => {
    // sin(x)^2 is (sin x)², and the x inside is still read.
    const read = implicitProducts(
      pow(callOf("sin", callOf("x", y)), number(2)),
      coordinates
    );
    expect(sameTree(read, pow(callOf("sin", mul(x, y)), number(2)))).toBe(true);
  });

  test("the field F = (x(y-1), y(x+2)) differentiates", () => {
    const P = implicitProducts(callOf("x", sub(y, number(1))), coordinates);
    const Q = implicitProducts(callOf("y", add(x, number(2))), coordinates);
    // ∇·F = (y-1) + (x+2), and the scalar curl ∂Q/∂x − ∂P/∂y = y − x.
    const divergence = fold(add(differentiate(P, "x"), differentiate(Q, "y")));
    const curl = fold(sub(differentiate(Q, "x"), differentiate(P, "y")));
    for (const [at, div, rot] of [
      [{ x: 0, y: 0 }, 1, 0],
      [{ x: 2, y: 3 }, 6, 1],
      [{ x: -1, y: 4 }, 4, 5],
    ] as const) {
      expect(evaluate(divergence, at)).toBeCloseTo(div);
      expect(evaluate(curl, at)).toBeCloseTo(rot);
    }
  });

  test("without the rewrite the same field is refused, not guessed", () => {
    expect(() => differentiate(callOf("x", sub(y, number(1))), "x")).toThrow(
      "The derivative of x is not known."
    );
  });
});
