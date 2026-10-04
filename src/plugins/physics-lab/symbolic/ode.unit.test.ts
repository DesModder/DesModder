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

describe("the logistic equation, which BC examines and AB draws", () => {
  const M = id("M");

  test("comes out in closed form, not as a relation between logarithms", () => {
    // dy/dx = ky(1 - y/M), written the way every textbook writes it.
    const solution = solved(mul(mul(k, y), sub(number(1), div(y, M))));
    expect(solution.explicit).toBe(true);
    expect(solution.latex).toBe("y=\\frac{M}{1+Ce^{-\\left(kx\\right)}}");
  });

  test("names the carrying capacity, which is what the question asks for", () => {
    const solution = solved(
      mul(mul(number(0.5), y), sub(number(1), div(y, number(10))))
    );
    expect(solution.latex).toBe("y=\\frac{10}{1+Ce^{-0.5x}}");
    expect(solution.method).toBe("Logistic, carrying capacity 10");
  });

  test("and does not care which way round it was typed", () => {
    // ky(M - y) is the same equation with the capacity multiplied through.
    expect(solved(mul(y, sub(number(1), y))).latex).toBe(
      "y=\\frac{1}{1+Ce^{-x}}"
    );
    expect(solved(mul(y, sub(y, number(1)))).latex).toBe(
      "y=\\frac{1}{1+Ce^{x}}"
    );
  });

  test("read as multiplication when Desmos parsed it as a function call", () => {
    // `y\left(1-y\right)` is how the equation is written, and Desmos's parser
    // resolves juxtaposition before a bracket as application — so it arrives
    // as y applied to (1-y). Without rewriting that, the logistic equation is
    // refused in the only form anybody types it in.
    const asCall = functionCall(id("y"), [sub(number(1), y)]);
    expect(solved(asCall).latex).toBe("y=\\frac{1}{1+Ce^{-x}}");
    // With a coefficient in front, which is how it actually turns up.
    const withRate = mul(
      number(0.6),
      functionCall(id("y"), [sub(number(1), y)])
    );
    expect(solved(withRate).method).toMatch(/carrying capacity 1/);
  });

  test("a genuine function call is left alone", () => {
    // `g` might be a function the graph defines, and rewriting it as
    // multiplication would silently answer a different question.
    const result = solve(functionCall(id("g"), [y]));
    expect(result.ok).toBe(false);
  });

  test("a quadratic with a constant term is not logistic and is not claimed to be", () => {
    // Both equilibria move off zero, so the closed form does not apply. It
    // falls through to the separable path rather than being answered wrongly.
    const result = solve(add(mul(y, sub(number(1), y)), number(3)));
    if (result.ok) expect(result.solution.method).not.toMatch(/logistic/i);
  });
});

describe("separable equations that stay implicit", () => {
  test("dy/dx = x/y is reported as a relation, and said to be one", () => {
    const solution = solved(div(x, y));
    expect(solution.explicit).toBe(false);
    // y²/2 = x²/2 + C — the circles-and-hyperbolas family.
    expect(solution.latex).toBe("\\frac{y^{2}}{2}=\\frac{x^{2}}{2}+C");
  });

  test("dy/dx = y³ too: ∫dy/y³ is an even power, with two branches", () => {
    const solution = solved(pow(y, number(3)));
    expect(solution.explicit).toBe(false);
    expect(solution.latex).toBe("-\\frac{1}{2y^{2}}=x+C");
  });
});

describe("separable equations solved for y", () => {
  // When ∫dy/h is one odd power of y it has a single real inverse, so y is
  // given explicitly; C absorbs the sign a negative coefficient would carry.
  test("dy/dx = x·y² separates and inverts", () => {
    const solution = solved(mul(x, pow(y, number(2))));
    expect(solution.explicit).toBe(true);
    expect(solution.latex).toBe("y=\\frac{1}{C-\\frac{x^{2}}{2}}");
  });

  test("dy/dx = −y¹⁸, which the relation's own check used to refuse", () => {
    // ∫dy/y¹⁸ at y = 2.5 is 10⁻⁸ beside an x side near 1: differencing the
    // relation as one function lost it to rounding.
    const solution = solved(negative(pow(y, number(18))));
    expect(solution.explicit).toBe(true);
    expect(solution.latex).toBe(
      "y=\\left(17\\left(x+C\\right)\\right)^{-\\frac{1}{17}}"
    );
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
      /not (an )?elementary/i
    );
  });

  test("a product parts cannot reduce, because neither factor is a polynomial", () => {
    // `e^x sin x` used to be the example here and is now solved, by the one
    // rule that finishes a cyclic pair. `e^x tan x` is not cyclic and has no
    // elementary antiderivative at all.
    expect(refused(mul(fn("exp", x), fn("tan", x)))).toMatch(/parts/i);
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

describe("equations a substitution turns into one of the others", () => {
  const two = number(2);

  test("y' = y² is not logistic, and is answered by its family", () => {
    // Read once as logistic with capacity 0, and answered y = 0: an
    // equilibrium, which satisfies the equation and is not its solution.
    const result = solve(pow(y, two));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.solution.latex).toContain("C");
  });

  test("Bernoulli's equation, by v = y^{1−n}", () => {
    const result = solve(add(y, mul(x, pow(y, two))));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.solution.method).toContain("Bernoulli");
      expect(result.solution.explicit).toBe(true);
    }
  });

  test("a homogeneous equation, by v = y/x", () => {
    const result = solve(div(sub(y, x), add(y, x)));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.solution.method).toContain("Homogeneous");
  });

  test("an integrating factor from a logarithm is a power", () => {
    // y' = 1 + y/x: the factor e^{−ln x} is 1/x, not 1/|x|.
    const result = solve(add(number(1), div(y, x)));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.solution.latex).not.toContain("e^");
  });

  test("an exponential of a difference separates", () => {
    const result = solve(pow(id("e"), sub(x, y)));
    expect(result.ok).toBe(true);
  });
});
