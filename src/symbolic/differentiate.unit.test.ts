import {
  differentiate,
  identifiersIn,
  implicitDerivative,
  SymbolicError,
  toLatex,
  fold as simplify,
} from "./index";
import { Aug, AugBuilders, buildConfig } from "../../text-mode-core";

const { binop, functionCall, id, negative, number } = AugBuilders;

type Node = Aug.Latex.AnyChild;

/**
 * Emitting needs operator and command names but not Desmos's parser, so the
 * whole differentiator is testable offline. Parsing real LaTeX is covered by
 * the integration test, which has a real Desmos to parse with.
 */
/**
 * A multi-letter name is emitted as `\cos` when the config lists it as a
 * command and `\operatorname{cos}` otherwise, so the names are pinned here to
 * keep these assertions about the derivative rather than about the emitter.
 * Whether real Desmos accepts what production emits is what the integration
 * test checks.
 */
const cfg = buildConfig({
  commandNames:
    "sin cos tan sec csc cot sinh cosh tanh arcsin arccos arctan ln log exp sqrt sign",
});
const emit = (node: Node) => toLatex(cfg, node);
const derive = (node: Node, variable: string) =>
  emit(differentiate(node, variable));

const x = id("x");
const y = id("y");
const mul = (a: Node, b: Node) => binop("Multiply", a, b);
const add = (a: Node, b: Node) => binop("Add", a, b);
const sub = (a: Node, b: Node) => binop("Subtract", a, b);
const div = (a: Node, b: Node) => binop("Divide", a, b);
const pow = (a: Node, b: Node) => binop("Exponent", a, b);
const fn = (name: string, arg: Node) => functionCall(id(name), [arg]);

describe("Vector Tools symbolic differentiation", () => {
  test("holds every other variable constant, which is what makes it partial", () => {
    // f(x,y) = 2xy. The whole point: ∂f/∂x is 2y, not 2y + 2x.
    const f = mul(mul(number(2), x), y);
    expect(derive(f, "x")).toBe("2y");
    expect(derive(f, "y")).toBe("2x");
    expect(derive(f, "z")).toBe("0");
  });

  test("differentiates a constant and the variable itself", () => {
    expect(derive(number(7), "x")).toBe("0");
    expect(derive(x, "x")).toBe("1");
    expect(derive(y, "x")).toBe("0");
  });

  test("applies the power rule", () => {
    expect(derive(pow(x, number(2)), "x")).toBe("2x");
    expect(derive(pow(x, number(3)), "x")).toBe("3x^{2}");
    // x^1 differentiates to a bare 1, not to 1*x^0.
    expect(derive(pow(x, number(1)), "x")).toBe("1");
  });

  test("applies the sum, product, and quotient rules", () => {
    expect(derive(add(pow(x, number(2)), pow(y, number(2))), "x")).toBe("2x");
    expect(derive(sub(pow(x, number(3)), x), "x")).toBe("3x^{2}-1");
    // d/dx (x*y) = y
    expect(derive(mul(x, y), "x")).toBe("y");
    // d/dx (x/y) = 1/y. The quotient rule produces `y/y^2`, and it is the
    // shared-base fold reaching across the bar that finishes the job.
    expect(derive(div(x, y), "x")).toBe("\\frac{1}{y}");
  });

  test("applies the chain rule through known functions", () => {
    expect(derive(fn("sin", x), "x")).toBe("\\cos\\left(x\\right)");
    expect(derive(fn("cos", x), "x")).toBe("-\\sin\\left(x\\right)");
    // The chain-rule factor is a constant, so it moves to the front.
    expect(derive(fn("exp", mul(number(2), x)), "x")).toBe(
      "2\\exp\\left(2x\\right)"
    );
    expect(derive(fn("ln", x), "x")).toBe("\\frac{1}{x}");
    // sin(xy) by y is cos(xy)*x — the chain rule carrying a partial through.
    expect(derive(fn("sin", mul(x, y)), "y")).toBe("\\cos\\left(xy\\right)x");
  });

  test("handles a variable exponent", () => {
    // d/dx 2^x = 2^x ln 2
    expect(derive(pow(number(2), x), "x")).toBe("2^{x}\\ln\\left(2\\right)");
  });

  test("refuses what it cannot do exactly, rather than guessing", () => {
    // An unknown function has no derivative rule, and inventing one would
    // produce a plausible, wrong answer.
    expect(() => differentiate(fn("mystery", x), "x")).toThrow(SymbolicError);
    expect(() => differentiate(fn("mystery", x), "x")).toThrow(
      "derivative of mystery is not known"
    );

    const integral: Node = {
      type: "Integral",
      differential: id("t"),
      start: number(0),
      end: x,
      integrand: id("t"),
    };
    expect(() => differentiate(integral, "x")).toThrow(
      "An integral cannot be differentiated"
    );
  });

  test("simplifies away the identities differentiation produces", () => {
    expect(emit(simplify(add(number(0), x)))).toBe("x");
    expect(emit(simplify(mul(number(1), x)))).toBe("x");
    expect(emit(simplify(mul(number(0), x)))).toBe("0");
    expect(emit(simplify(pow(x, number(1))))).toBe("x");
    expect(emit(simplify(pow(x, number(0))))).toBe("1");
    expect(emit(simplify(div(x, number(1))))).toBe("x");
    expect(emit(simplify(negative(negative(x))))).toBe("x");
    expect(emit(simplify(add(number(2), number(3))))).toBe("5");
    // A number that ends up on the right reads better on the left.
    expect(emit(simplify(mul(y, number(2))))).toBe("2y");
  });

  test("differentiates implicitly, which Desmos cannot do at all", () => {
    // The circle x² + y² = 25 has dy/dx = -x/y.
    expect(
      emit(
        implicitDerivative(
          add(pow(x, number(2)), pow(y, number(2))),
          number(25),
          "x",
          "y"
        )
      )
    ).toBe("-\\frac{x}{y}");

    // A shifted circle keeps its centre in the answer: (x-1)² + y² = 4.
    expect(
      emit(
        implicitDerivative(
          add(pow(sub(x, number(1)), number(2)), pow(y, number(2))),
          number(4),
          "x",
          "y"
        )
      )
    ).toBe("-\\frac{x-1}{y}");

    // The folium xy = 1 gives dy/dx = -y/x.
    expect(emit(implicitDerivative(mul(x, y), number(1), "x", "y"))).toBe(
      "-\\frac{y}{x}"
    );
  });

  test("cancels a shared numeric factor but does not invent cancellations", () => {
    // 2x/2y reduces; 4x/2y is left alone rather than half-reduced wrongly.
    expect(emit(simplify(div(mul(number(2), x), mul(number(2), y))))).toBe(
      "\\frac{x}{y}"
    );
    expect(emit(simplify(div(mul(number(4), x), mul(number(2), y))))).toBe(
      "\\frac{4x}{2y}"
    );
  });

  test("lists the identifiers an expression uses, in order", () => {
    expect(identifiersIn(add(mul(id("u"), id("v")), id("w")))).toEqual([
      "u",
      "v",
      "w",
    ]);
    // Repeats collapse, so this is the argument list a gradient would use.
    expect(identifiersIn(add(mul(x, y), x))).toEqual(["x", "y"]);
  });
});
