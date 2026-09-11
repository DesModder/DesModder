/**
 * The three shapes of a second-order solution, and the physics each one is.
 *
 * As with the first-order solver, every answer here has already been checked
 * numerically inside `solveSecondOrder` — substituted back into `y'' = f(y, v)`
 * with both derivatives taken numerically — so a wrong result arrives as
 * `ok: false` rather than as a wrong string. These assertions are about whether
 * the answer is in the form a student would recognise.
 */
import { solveSecondOrder } from "./secondOrder";
import { Aug, AugBuilders, buildConfig } from "../../../../text-mode-core";

const { binop, functionCall, id, negative, number } = AugBuilders;

type Node = Aug.Latex.AnyChild;

const cfg = buildConfig({
  commandNames: "sin cos tan ln log exp sqrt sinh cosh tanh",
});

const y = id("y");
const v = id("v");
const mul = (a: Node, b: Node) => binop("Multiply", a, b);
const add = (a: Node, b: Node) => binop("Add", a, b);
const sub = (a: Node, b: Node) => binop("Subtract", a, b);

const solve = (f: Node) => solveSecondOrder(cfg, f);
const solved = (f: Node) => {
  const result = solve(f);
  if (!result.ok) throw new Error(`expected a solution, got: ${result.error}`);
  return result.solution;
};

describe("oscillation, which is what the equation is famous for", () => {
  test("simple harmonic motion", () => {
    // y'' = -4y, so omega is 2 and the period is pi.
    const solution = solved(negative(mul(number(4), y)));
    expect(solution.method).toBe("Simple harmonic motion");
    expect(solution.latex).toBe(
      "y=C_{1}\\cos\\left(2x\\right)+C_{2}\\sin\\left(2x\\right)"
    );
  });

  test("a damped oscillator keeps its envelope", () => {
    // y'' = -2v - 5y: roots -1 ± 2i, so e^{-x} times an oscillation at 2.
    const solution = solved(
      sub(negative(mul(number(2), v)), mul(number(5), y))
    );
    expect(solution.method).toBe(
      "Complex characteristic roots, a damped oscillation"
    );
    expect(solution.latex).toBe(
      "y=e^{-x}\\left(C_{1}\\cos\\left(2x\\right)+C_{2}\\sin\\left(2x\\right)\\right)"
    );
  });
});

describe("the two real-root cases", () => {
  test("distinct roots give a sum of exponentials", () => {
    // y'' = -3v - 2y: roots -1 and -2.
    const solution = solved(
      sub(negative(mul(number(3), v)), mul(number(2), y))
    );
    expect(solution.method).toBe("Two real characteristic roots");
    expect(solution.latex).toBe("y=C_{1}e^{-x}+C_{2}e^{-2x}");
  });

  test("a repeated root brings the x that the second solution needs", () => {
    // y'' = -2v - y: a repeated root at -1. Without the x the two terms are
    // the same function and cannot meet two initial conditions.
    const solution = solved(sub(negative(mul(number(2), v)), y));
    expect(solution.method).toBe(
      "A repeated characteristic root, critically damped"
    );
    expect(solution.latex).toBe("y=\\left(C_{1}+C_{2}x\\right)e^{-x}");
  });

  test("an irrational root stays a radical, which is the whole point", () => {
    // y'' = 2y: roots ±√2. A decimal in an exponent is not a rounding — it is
    // the difference between e^{√2x} and e^{1.4142135623730951x}, and only one
    // of them answers the question.
    //
    // The bracket in the second exponent is the Aug emitter's own precedence
    // handling of a negated product, the same one the integrator's tests
    // record. It is left alone rather than stripped textually, because
    // deciding when a leading minus binds tightly enough is how a sign error
    // gets introduced.
    expect(solved(mul(number(2), y)).latex).toBe(
      "y=C_{1}e^{\\sqrt{2}x}+C_{2}e^{-\\left(\\sqrt{2}x\\right)}"
    );
  });
});

describe("a constant term", () => {
  test("shifts the family by the equilibrium it holds", () => {
    // y'' = -y + 3 settles at y = 3 and oscillates about it.
    const solution = solved(add(negative(y), number(3)));
    expect(solution.latex).toContain("3+");
    expect(solution.latex).toContain("\\cos");
  });
});

describe("what it will not pretend to solve", () => {
  test("a symbolic coefficient, because the discriminant has no sign", () => {
    const result = solve(negative(mul(id("k"), y)));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/exact numbers|discriminant/i);
  });

  test("a coefficient that varies with x", () => {
    const result = solve(mul(id("x"), y));
    expect(result.ok).toBe(false);
  });

  test("a right-hand side that is not linear in y", () => {
    const result = solve(functionCall(id("sin"), [y]));
    expect(result.ok).toBe(false);
  });
});
