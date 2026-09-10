/**
 * The equations an AP course actually sets, and the ones it does not.
 *
 * The solver verifies every answer numerically before returning it, so a wrong
 * result arrives here as `ok: false` rather than as a wrong string. That makes
 * these assertions about the *form* of the answer — whether it is the one a
 * student is expected to write — while the correctness check rides along inside
 * the solver itself.
 */
import { solveFirstOrder } from "./ode";
import { Aug, AugBuilders, buildConfig } from "../../../../text-mode-core";

const { binop, functionCall, id, negative, number } = AugBuilders;

type Node = Aug.Latex.AnyChild;

const cfg = buildConfig({
  commandNames: "sin cos tan sec csc cot ln log exp sqrt sinh cosh tanh",
});

const x = id("x");
const y = id("y");
const k = id("k");
const mul = (a: Node, b: Node) => binop("Multiply", a, b);
const div = (a: Node, b: Node) => binop("Divide", a, b);
const add = (a: Node, b: Node) => binop("Add", a, b);
const sub = (a: Node, b: Node) => binop("Subtract", a, b);
const pow = (a: Node, b: Node) => binop("Exponent", a, b);
const fn = (name: string, arg: Node) => functionCall(id(name), [arg]);

const solve = (f: Node) => solveFirstOrder(cfg, f);
const solved = (f: Node) => {
  const result = solve(f);
  if (!result.ok) throw new Error(`expected a solution, got: ${result.error}`);
  return result.solution;
};

describe("dy/dx = f(x), the direct antiderivative", () => {
  test("a polynomial right-hand side", () => {
    expect(solved(mul(number(2), x)).latex).toBe("y=x^{2}+C");
    expect(solved(x).latex).toBe("y=\\frac{x^{2}}{2}+C");
  });

  test("a constant rate, which is not too simple to solve", () => {
    expect(solved(number(3)).latex).toBe("y=3x+C");
    expect(solved(k).latex).toBe("y=kx+C");
  });

  test("the one whose answer is a logarithm", () => {
    expect(solved(div(number(1), x)).latex).toBe("y=\\ln\\left|x\\right|+C");
  });

  test("trigonometric, with the sign students lose", () => {
    expect(solved(fn("sin", x)).latex).toBe("y=-\\cos\\left(x\\right)+C");
  });
});

describe("dy/dx = ky, the equation every growth problem becomes", () => {
  test("exponential growth and decay", () => {
    const solution = solved(mul(k, y));
    expect(solution.latex).toBe("y=Ce^{kx}");
    expect(solution.method).toBe("Exponential growth and decay");
    expect(solution.explicit).toBe(true);
  });

  test("a numeric rate", () => {
    expect(solved(mul(number(3), y)).latex).toBe("y=Ce^{3x}");
    expect(solved(negative(mul(number(2), y))).latex).toBe("y=Ce^{-2x}");
  });

  test("y alone", () => {
    expect(solved(y).latex).toBe("y=Ce^{x}");
  });
});

describe("dy/dx = k(A - y), which is cooling, charging and terminal velocity", () => {
  test("the equilibrium is named, because it is what the question asks for", () => {
    // dy/dx = 2(10 - y): Newton's cooling toward an ambient 10.
    const solution = solved(mul(number(2), sub(number(10), y)));
    expect(solution.explicit).toBe(true);
    // The solution approaches 10 from wherever it starts.
    expect(solution.latex).toBe("y=10+Ce^{-2x}");
    expect(solution.method).toBe("Approaches the equilibrium 10");
  });

  test("and with the offset the other way round", () => {
    // dy/dx = y - 4 grows away from 4 rather than toward it.
    expect(solved(sub(y, number(4))).latex).toBe("y=4+Ce^{x}");
  });
});

describe("separable equations that stay implicit", () => {
  test("dy/dx = x/y is reported as a relation, and said to be one", () => {
    const solution = solved(div(x, y));
    expect(solution.explicit).toBe(false);
    // y²/2 = x²/2 + C — the circles-and-hyperbolas family.
    expect(solution.latex).toBe("\\frac{y^{2}}{2}=\\frac{x^{2}}{2}+C");
  });

  test("dy/dx = x·y² separates the same way", () => {
    const solution = solved(mul(x, pow(y, number(2))));
    expect(solution.explicit).toBe(false);
    expect(solution.latex).toBe("-\\frac{1}{y}=\\frac{x^{2}}{2}+C");
  });
});

describe("what it will not pretend to solve", () => {
  const refused = (f: Node) => {
    const result = solve(f);
    expect(result.ok).toBe(false);
    return result.ok ? "" : result.error;
  };

  test("an equation that does not separate", () => {
    // x + y is affine in y with a constant coefficient, so it does solve; the
    // genuinely inseparable one has them tangled inside a function.
    expect(refused(fn("sin", add(x, y)))).toMatch(/not separable/i);
  });

  test("a right-hand side with no antiderivative", () => {
    expect(refused(fn("sin", pow(x, number(2))))).toMatch(
      /cannot be integrated|not linear/i
    );
  });

  test("a product parts cannot reduce, because neither factor is a polynomial", () => {
    expect(refused(mul(fn("exp", x), fn("sin", x)))).toMatch(/parts/i);
  });
});

describe("the linear case that needs an integrating factor", () => {
  test("dy/dx = x - y comes out in the form an answer key prints", () => {
    // The equation the slope field draws by default, and the one whose solution
    // curves the integration test lays over the marks.
    const solution = solved(sub(x, y));
    expect(solution.explicit).toBe(true);
    // Not `e^{-x}(xe^{x}-e^{x}+C)`, which is the same function and is what the
    // integrating factor produces before the exponentials are folded together.
    expect(solution.latex).toBe("y=x-1+Ce^{-x}");
  });

  test("and the same equation the other way up", () => {
    expect(solved(add(x, y)).latex).toBe("y=-x-1+Ce^{x}");
  });
});
