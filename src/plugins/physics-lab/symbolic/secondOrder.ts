/**
 * Second-order linear equations with constant coefficients.
 *
 * `y'' = p·v + q·y + r`, where **v means dy/dx**. That substitution is not a
 * notation this plugin invented, and it is not a workaround either — it is the
 * reduction of order every textbook performs, and in physics v is the velocity
 * the equation is usually about. It is also the only option: `y'` does not
 * parse in Desmos at all. Asking its parser for `y'` returns an error node, so
 * an input built around primes could never be read back, and the briefing's
 * rule that Desmos cannot be taught new notation applies exactly here.
 *
 * What this covers is what the equation is famous for. `y'' = -4y` is simple
 * harmonic motion, `y'' = -2v - 5y` is a damped oscillator, and the same
 * equation with the signs the other way round is an RLC circuit or a hanging
 * cable. All three root cases appear in those problems, so all three are here.
 *
 * ## Why the roots are exact
 *
 * The characteristic equation `s² - ps - q = 0` has roots
 * `(p ± √(p² + 4q))/2`, and those roots go straight into an exponent. A
 * decimal there is not a rounding — it is the difference between `e^{√2 x}` and
 * `e^{1.4142135623730951 x}`, and only one of them is the answer to the
 * question. So the discriminant is carried through `exact.ts`, and a radical
 * that does not reduce stays a radical.
 *
 * Coefficients therefore have to be exact constants. A symbolic one — `y'' =
 * -ω²y`, which a physicist would write — is refused, because the sign of the
 * discriminant decides which of three completely different solutions is
 * correct and there is no way to know the sign of ω² without knowing ω.
 */
import { Aug, AugBuilders, type Config } from "../../../../text-mode-core";
import { linearIn, simplify } from "./integrate";
import {
  add as exactAdd,
  asRational,
  evaluateExact,
  fromRational,
  multiply as exactMultiply,
  power as exactPower,
  subtract as exactSubtract,
  toNode as exactToNode,
  type ExactValue,
} from "./exact";
import * as Q from "./rational";
import type { Rational } from "./rational";
import {
  agreesOnSamples,
  evaluate,
  numericDerivative,
  numericSecondDerivative,
} from "./evaluate";
import { toLatex } from "./latex";
import type { ODEResult, ODESolution } from "./ode";

const { binop, functionCall, id } = AugBuilders;

type Node = Aug.Latex.AnyChild;

const add = (a: Node, b: Node) => binop("Add", a, b);
const multiply = (a: Node, b: Node) => binop("Multiply", a, b);
const power = (a: Node, b: Node) => binop("Exponent", a, b);
const call = (name: string, arg: Node) => functionCall(id(name), [arg]);

/** The two constants a second-order solution needs. Desmos gives each a slider. */
const FIRST = "C_1";
const SECOND = "C_2";

/** The symbol standing for dy/dx in the right-hand side the user types. */
export const VELOCITY = "v";

const SAMPLE_XS = [-1.3, -0.4, 0.5, 1.2, 2.1, 2.9];
const SAMPLE_PAIRS = [
  [1.3, -0.7],
  [-0.6, 1.9],
  [2.2, 0.8],
];

/**
 * Solves `d²y/dx² = f`, where `f` may mention y and v.
 *
 * The three cases are the three shapes of the characteristic roots, and they
 * are genuinely different functions rather than variations on one: two real
 * roots give a sum of exponentials, a repeated root needs the `x` that stops
 * the two terms being the same function, and complex roots give an oscillation
 * whose envelope is the real part.
 */
export function solveSecondOrder(
  cfg: Config,
  f: Node,
  independent = "x",
  dependent = "y"
): ODEResult {
  const emit = (node: Node) => toLatex(cfg, node);

  // Split off v first, then y from what is left. Both coefficients and the
  // remainder have to be free of both, which is what "constant coefficients"
  // means and is the whole condition for this method.
  const inVelocity = linearIn(f, VELOCITY);
  if (inVelocity === undefined)
    return notLinear("dy/dx", dependent, independent);
  const inPosition = linearIn(inVelocity.b, dependent);
  if (inPosition === undefined)
    return notLinear(dependent, dependent, independent);

  const p = exactCoefficient(inVelocity.a);
  const q = exactCoefficient(inPosition.a);
  const r = exactCoefficient(inPosition.b);
  if (p === undefined || q === undefined || r === undefined) {
    return {
      ok: false,
      error:
        "The coefficients have to be exact numbers. Which of the three solution shapes is right depends on the sign of the discriminant, and a symbolic coefficient does not have one.",
    };
  }

  // s² - p·s - q = 0, so the discriminant is p² + 4q.
  const discriminant = Q.add(Q.multiply(p, p), Q.multiply(Q.rational(4n), q));
  const half = Q.rational(1n, 2n);
  const halfP = Q.multiply(p, half);

  // A constant forcing term shifts the whole family by the equilibrium it
  // holds: y'' and v are both zero there, so q·y + r = 0.
  let equilibrium: Node | undefined;
  if (!Q.isZero(r)) {
    if (Q.isZero(q)) {
      return {
        ok: false,
        error:
          "A constant term with no y to balance it makes this non-homogeneous in a way this does not solve.",
      };
    }
    equilibrium = exactToNode(fromRational(Q.negate(Q.divide(r, q))));
  }

  const built = Q.isZero(discriminant)
    ? repeatedRoot(halfP)
    : Q.compare(discriminant, Q.ZERO) > 0
      ? distinctRealRoots(halfP, discriminant, half)
      : complexRoots(halfP, discriminant, half);
  if (built === undefined) {
    return {
      ok: false,
      error:
        "The characteristic roots are not exact constants this can represent.",
    };
  }

  const solution = simplify(
    equilibrium === undefined ? built.tree : add(equilibrium, built.tree)
  );
  return verifiedSecondOrder(
    {
      latex: `${dependent}=${emit(solution)}`,
      method: built.method,
      explicit: true,
    },
    solution,
    f,
    independent,
    dependent
  );
}

/** `y = C₁e^{s₁x} + C₂e^{s₂x}` — overdamping, and the generic case. */
function distinctRealRoots(
  halfP: Rational,
  discriminant: Rational,
  half: Rational
) {
  const root = exactPower(fromRational(discriminant), half);
  if (root === undefined) return undefined;
  const spread = exactMultiply(fromRational(half), root);
  const centre = fromRational(halfP);
  const first = exactToNode(exactAdd(centre, spread));
  const second = exactToNode(exactSubtract(centre, spread));
  return {
    tree: add(
      multiply(id(FIRST), power(id("e"), multiply(first, id("x")))),
      multiply(id(SECOND), power(id("e"), multiply(second, id("x"))))
    ),
    method: "Two real characteristic roots",
  };
}

/**
 * `y = (C₁ + C₂x)e^{sx}` — critical damping.
 *
 * The `x` is the whole content of this case. With a repeated root the two
 * exponentials are the same function, so they span a one-dimensional space and
 * cannot satisfy two initial conditions; multiplying one by x is what recovers
 * the second solution.
 */
function repeatedRoot(halfP: Rational) {
  const root = exactToNode(fromRational(halfP));
  return {
    tree: multiply(
      add(id(FIRST), multiply(id(SECOND), id("x"))),
      power(id("e"), multiply(root, id("x")))
    ),
    method: "A repeated characteristic root, critically damped",
  };
}

/** `y = e^{αx}(C₁cos βx + C₂sin βx)` — oscillation, damped when α is not zero. */
function complexRoots(halfP: Rational, discriminant: Rational, half: Rational) {
  const magnitude = exactPower(fromRational(Q.negate(discriminant)), half);
  if (magnitude === undefined) return undefined;
  const beta = exactToNode(exactMultiply(fromRational(half), magnitude));
  const oscillation = add(
    multiply(id(FIRST), call("cos", multiply(beta, id("x")))),
    multiply(id(SECOND), call("sin", multiply(beta, id("x"))))
  );
  if (Q.isZero(halfP)) {
    // No damping at all: simple harmonic motion, and the envelope would be a
    // factor of 1.
    return { tree: oscillation, method: "Simple harmonic motion" };
  }
  return {
    tree: multiply(
      power(id("e"), multiply(exactToNode(fromRational(halfP)), id("x"))),
      oscillation
    ),
    method: "Complex characteristic roots, a damped oscillation",
  };
}

/** A coefficient as an exact rational, or `undefined` if it is not one. */
function exactCoefficient(node: Node): Rational | undefined {
  const value: ExactValue | undefined = evaluateExact(node);
  if (value === undefined) return undefined;
  return asRational(value);
}

function notLinear(what: string, dependent: string, independent: string) {
  return {
    ok: false as const,
    error: `This has to be linear in ${dependent} and ${what}, with coefficients that do not depend on ${independent}. Write dy/dx as ${VELOCITY}.`,
  };
}

/**
 * Substitutes the candidate back into `y'' = f(y, v)`.
 *
 * Both derivatives are taken numerically and both are fed back in — v is bound
 * to the candidate's own first derivative at each point, which is what makes
 * this a test of the equation rather than of one differentiation.
 */
function verifiedSecondOrder(
  solution: ODESolution,
  candidate: Node,
  f: Node,
  independent: string,
  dependent: string
): ODEResult {
  const samples = SAMPLE_XS.flatMap((x) =>
    SAMPLE_PAIRS.map(([c1, c2]) => ({
      [independent]: x,
      [FIRST]: c1,
      [SECOND]: c2,
    }))
  );
  const ok = agreesOnSamples(
    (bindings) => numericSecondDerivative(candidate, independent, bindings),
    (bindings) =>
      evaluate(f, {
        ...bindings,
        [dependent]: evaluate(candidate, bindings),
        [VELOCITY]: numericDerivative(candidate, independent, bindings),
      }),
    samples,
    // Looser than the first-order check, and it has to be: a second difference
    // divides by h², so it carries roughly the square root of the precision the
    // first derivative does. Tightening this rejects correct answers.
    2e-3
  );
  return ok
    ? { ok: true, solution }
    : {
        ok: false,
        error:
          "A candidate solution was found but does not satisfy the equation, so it has not been reported.",
      };
}

export const SECOND_ORDER_CONSTANTS = [FIRST, SECOND];

/** Exposed for the panel's hint, so the two cannot drift apart. */
export const secondOrderHint = `Write dy/dx as ${VELOCITY} — for example, ${VELOCITY}-2y for a damped oscillator.`;
