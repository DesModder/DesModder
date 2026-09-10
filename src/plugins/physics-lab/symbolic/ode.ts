/**
 * Solving the first-order differential equations an AP course sets.
 *
 * The scope is the syllabus rather than the literature. AP Calculus BC examines
 * separable equations, slope fields and Euler's method; AP Physics adds RC
 * circuits, Newton's cooling, radioactive decay and terminal velocity. Every one
 * of those is `dy/dx = f(x, y)` where f is either free of y, or affine in y, or
 * a product of a function of x with a function of y. Those three cases are what
 * this solves, and it refuses everything else rather than reaching for a method
 * the answer would then have to be trusted about.
 *
 * The constant of integration is emitted as the identifier `C`, which Desmos
 * treats as an undefined variable and offers a slider for. That is not a
 * workaround — it is the best possible outcome. The general solution of a
 * first-order equation is a one-parameter family, and a slider is a family you
 * can drag through, sitting directly over the slope field it came from.
 *
 * ## Nothing is reported without being checked
 *
 * Every solution is verified numerically before it is returned: the candidate is
 * substituted back into the original equation at a spread of points and several
 * values of C, and if it does not satisfy the equation it is discarded and an
 * error is reported instead.
 *
 * This is not belt-and-braces. A symbolic slip here produces a perfectly
 * plausible curve — right shape, right family, wrong constant — that a reader
 * has no way of catching, and the whole promise of showing the solution over the
 * slope field is that the two agree. The check costs a few hundred
 * floating-point operations and it is the difference between a teaching tool and
 * an answer machine.
 */
import { Aug, AugBuilders, type Config } from "../../../../text-mode-core";
import {
  dependsOn,
  integrate,
  IntegrationError,
  linearIn,
  simplify,
  visit,
} from "./integrate";
import { agreesOnSamples, evaluate, numericDerivative } from "./evaluate";
import { toLatex } from "./latex";

const { number, binop, id, negative } = AugBuilders;

type Node = Aug.Latex.AnyChild;

const add = (a: Node, b: Node) => binop("Add", a, b);
const multiply = (a: Node, b: Node) => binop("Multiply", a, b);
const divide = (a: Node, b: Node) => binop("Divide", a, b);
const power = (a: Node, b: Node) => binop("Exponent", a, b);
const subtract = (a: Node, b: Node) => binop("Subtract", a, b);

/** The constant of integration, which Desmos will offer a slider for. */
const CONSTANT = "C";

export interface ODESolution {
  /** The solution as Desmos LaTeX, ready to put in the expression list. */
  latex: string;
  /** How it was solved, for the panel to say. */
  method: string;
  /**
   * Whether y is given in terms of x, or only related to it.
   *
   * Worth saying on screen. An implicit solution is a complete answer to the
   * question and is not a curve Desmos can plot as `y = …`, so a reader needs to
   * know which of the two they have before they try to graph it.
   */
  explicit: boolean;
}

export type ODEResult =
  | { ok: true; solution: ODESolution }
  | { ok: false; error: string };

const SAMPLE_XS = [-1.7, -0.6, 0.4, 1.3, 2.2, 3.1];
const SAMPLE_CS = [-1.4, 0.6, 2.3];

/**
 * Solves `dy/dx = f`, where `f` is the parsed right-hand side.
 *
 * The order the cases are tried in is the order that produces the most useful
 * answer, not the order of increasing generality: an equation that is both free
 * of y and separable should be reported as a plain antiderivative, because that
 * is what it is.
 */
export function solveFirstOrder(
  cfg: Config,
  f: Node,
  independent = "x",
  dependent = "y"
): ODEResult {
  const emit = (node: Node) => toLatex(cfg, node);

  // An equation whose right-hand side mentions neither variable is still
  // solvable — dy/dx = k is the constant-velocity case — so nothing is rejected
  // for being too simple.
  const asAffine = linearIn(f, dependent);

  if (asAffine !== undefined && isZero(asAffine.a)) {
    return direct(emit, f, independent, dependent);
  }

  if (asAffine !== undefined) {
    return affine(emit, f, asAffine, independent, dependent);
  }

  return separable(emit, f, independent, dependent);
}

/**
 * `dy/dx = f(x)` — the antiderivative, and the case AB spends most of its time
 * on.
 */
function direct(
  emit: (node: Node) => string,
  f: Node,
  independent: string,
  dependent: string
): ODEResult {
  let antiderivative: Node;
  try {
    antiderivative = integrate(f, independent);
  } catch (error) {
    return failed(error);
  }
  const solution = simplify(add(antiderivative, id(CONSTANT)));
  return verified(
    {
      // Written as `+C` on the end rather than emitted from the tree. The
      // simplifier is free to reorder a sum — it turns `-cos(x)+C` into
      // `C-cos(x)`, which is the same number and not the form anybody writes an
      // antiderivative in. The constant of integration goes last, always. The
      // tree keeps it where it is, because the tree is what gets verified.
      latex: `${dependent}=${emit(simplify(antiderivative))}+${CONSTANT}`,
      method: "Direct antiderivative",
      explicit: true,
    },
    solution,
    f,
    independent,
    dependent
  );
}

/**
 * `dy/dx = a·y + b` — the case nearly every applied first-order problem is.
 *
 * With a and b constant this is `y = -b/a + Ce^{ax}`, which is exponential
 * growth and decay when b is zero and Newton's cooling, RC charging and
 * terminal velocity when it is not: the `-b/a` is the equilibrium the solution
 * approaches, and it is the number the physics question is usually asking for.
 *
 * With a depending on x and b zero it is `y = Ce^{∫a dx}`. The fully general
 * linear case needs an integrating factor and an integral of `b·e^{-∫a}` that
 * usually does not exist in closed form; it is attempted and refused honestly
 * when it fails.
 */
function affine(
  emit: (node: Node) => string,
  f: Node,
  parts: { a: Node; b: Node },
  independent: string,
  dependent: string
): ODEResult {
  const { a, b } = parts;
  const aHasX = dependsOn(a, independent);
  const bIsZero = isZero(b);

  let antiderivativeOfA: Node;
  try {
    antiderivativeOfA = integrate(a, independent);
  } catch (error) {
    return failed(error);
  }
  // e^{∫a dx}, which is the whole solution when b is zero.
  const growth = power(id("e"), antiderivativeOfA);

  if (bIsZero) {
    const solution = simplify(multiply(id(CONSTANT), growth));
    return verified(
      {
        latex: `${dependent}=${emit(solution)}`,
        method: aHasX
          ? "Separable, with y on one side"
          : "Exponential growth and decay",
        explicit: true,
      },
      solution,
      f,
      independent,
      dependent
    );
  }

  if (!aHasX && !dependsOn(b, independent)) {
    // Constant coefficients: the equilibrium plus a decaying offset.
    const equilibrium = divide(negative(b), a);
    const solution = simplify(add(equilibrium, multiply(id(CONSTANT), growth)));
    return verified(
      {
        latex: `${dependent}=${emit(solution)}`,
        method: `Approaches the equilibrium ${emit(simplify(equilibrium))}`,
        explicit: true,
      },
      solution,
      f,
      independent,
      dependent
    );
  }

  // The general linear equation, through an integrating factor.
  let particular: Node;
  try {
    const factor = power(id("e"), simplify(negative(antiderivativeOfA)));
    particular = integrate(simplify(multiply(b, factor)), independent);
  } catch (error) {
    return failed(error);
  }
  // Distributed rather than left as `e^{∫a}(… + C)`. The integrating factor
  // cancels against the exponentials inside `particular` once it is multiplied
  // through, and that cancellation is what turns the answer to `dy/dx = x - y`
  // from `e^{-x}(xe^{x}-e^{x}+C)` into the `x-1+Ce^{-x}` an answer key prints.
  // Left factored there is nothing for the fold to act on.
  const solution = simplify(
    add(distribute(growth, particular), multiply(id(CONSTANT), growth))
  );
  return verified(
    {
      latex: `${dependent}=${emit(solution)}`,
      method: "Linear, solved with an integrating factor",
      explicit: true,
    },
    solution,
    f,
    independent,
    dependent
  );
}

/**
 * `dy/dx = g(x)·h(y)` — separated, integrated, and left as a relation.
 *
 * The result is implicit on purpose. Solving `∫dy/h(y) = ∫g(x)dx + C` for y
 * means inverting whatever the left-hand integral turned out to be, which is a
 * different problem for every h and is exactly where a general solver would
 * start guessing. The cases worth having explicitly — h linear in y — are
 * already handled above, so what reaches here is genuinely the implicit kind.
 */
function separable(
  emit: (node: Node) => string,
  f: Node,
  independent: string,
  dependent: string
): ODEResult {
  const split = separate(f, independent, dependent);
  if (split === undefined) {
    return {
      ok: false,
      error:
        "This is not separable into a function of x times a function of y, and no other method is available here.",
    };
  }
  let left: Node;
  let right: Node;
  try {
    left = integrate(split.hInverse, dependent);
    right = integrate(split.g, independent);
  } catch (error) {
    return failed(error);
  }
  const relation = simplify(subtract(left, add(right, id(CONSTANT))));
  const solution: ODESolution = {
    latex: `${emit(simplify(left))}=${emit(simplify(add(right, id(CONSTANT))))}`,
    method: "Separable, left as a relation between x and y",
    explicit: false,
  };
  return verifiedImplicit(relation, solution, f, independent, dependent);
}

/**
 * Splits `f` into a product of something free of y and something free of x.
 *
 * Factors are collected across multiplication and division so that `x/y` and
 * `xy` are both recognised, and a factor mentioning both variables ends the
 * attempt — that is precisely the equation that is not separable.
 */
function separate(
  f: Node,
  independent: string,
  dependent: string
): { g: Node; hInverse: Node } | undefined {
  const collected: { node: Node; inNumerator: boolean }[] = [];
  collect(f, true, collected);

  let g: Node = number(1);
  // Built already inverted, rather than as h and then 1/h. Separating
  // `dy/dx = x/y` gives h = 1/y, and `1/(1/y)` is a quotient whose denominator
  // is not linear in y — the integrator would refuse it, for a reason that has
  // nothing to do with the integral actually being asked for. Flipping each
  // factor as it is collected hands over a plain `y` instead.
  let hInverse: Node = number(1);
  for (const { node, inNumerator } of collected) {
    const hasX = dependsOn(node, independent);
    const hasY = dependsOn(node, dependent);
    if (hasX && hasY) return undefined;
    if (hasY) {
      hInverse = inNumerator
        ? divide(hInverse, node)
        : multiply(hInverse, node);
    } else {
      // Anything free of y belongs with x, including plain constants.
      g = inNumerator ? multiply(g, node) : divide(g, node);
    }
  }
  return { g: simplify(g), hInverse: simplify(hInverse) };
}

function collect(
  node: Node,
  inNumerator: boolean,
  out: { node: Node; inNumerator: boolean }[]
) {
  if (node.type === "BinaryOperator") {
    if (node.name === "Multiply" || node.name === "CrossMultiply") {
      collect(node.left, inNumerator, out);
      collect(node.right, inNumerator, out);
      return;
    }
    if (node.name === "Divide") {
      collect(node.left, inNumerator, out);
      collect(node.right, !inNumerator, out);
      return;
    }
  }
  if (node.type === "Negative") {
    // The sign is a constant factor and must not be left attached to a y-only
    // factor, where it would land on the wrong side of the separation.
    out.push({ node: number(-1), inNumerator });
    collect(node.arg, inNumerator, out);
    return;
  }
  out.push({ node, inNumerator });
}

// ---- verification --------------------------------------------------------

/**
 * Every name in the equation that is neither variable nor the constant of
 * integration, bound to an arbitrary value.
 *
 * `dy/dx = ky` has to be checkable, and it cannot be while `k` evaluates to
 * NaN — every sample point would be skipped and the check would pass by never
 * having tested anything. The values are arbitrary but deliberately not 0 or 1,
 * since both of those hide a factor that is in the wrong place.
 */
function parameterBindings(nodes: readonly Node[], exclude: readonly string[]) {
  const names: string[] = [];
  for (const node of nodes) {
    visit(node, (child) => {
      if (
        child.type === "Identifier" &&
        !exclude.includes(child.symbol) &&
        child.symbol !== "pi" &&
        child.symbol !== "e" &&
        !names.includes(child.symbol)
      )
        names.push(child.symbol);
    });
  }
  const bindings: Record<string, number> = {};
  names.forEach((name, index) => {
    bindings[name] = [1.3, 0.7, 2.1, 0.4, 1.9][index % 5];
  });
  return bindings;
}

const samples = (
  independent: string,
  dependent: string,
  parameters: Record<string, number>
) =>
  SAMPLE_XS.flatMap((x) =>
    SAMPLE_CS.map((c) => ({
      ...parameters,
      [independent]: x,
      [CONSTANT]: c,
      [dependent]: 0,
    }))
  );

/**
 * Substitutes an explicit solution back into the equation.
 *
 * `y` is bound to the candidate's own value at each point before the right-hand
 * side is evaluated, which is what makes this a test of the equation rather
 * than of the antiderivative alone.
 */
function verified(
  solution: ODESolution,
  candidate: Node,
  f: Node,
  independent: string,
  dependent: string
): ODEResult {
  const parameters = parameterBindings(
    [f, candidate],
    [independent, dependent, CONSTANT]
  );
  const ok = agreesOnSamples(
    (bindings) => numericDerivative(candidate, independent, bindings),
    (bindings) =>
      evaluate(f, { ...bindings, [dependent]: evaluate(candidate, bindings) }),
    samples(independent, dependent, parameters)
  );
  return ok
    ? { ok: true, solution }
    : {
        ok: false,
        error:
          "A candidate solution was found but does not satisfy the equation, so it has not been reported.",
      };
}

/**
 * Checks an implicit relation `F(x, y) = 0` by the implicit function theorem:
 * the slope it defines, `-F_x / F_y`, has to be the f the equation gave.
 */
function verifiedImplicit(
  relation: Node,
  solution: ODESolution,
  f: Node,
  independent: string,
  dependent: string
): ODEResult {
  const parameters = parameterBindings(
    [f, relation],
    [independent, dependent, CONSTANT]
  );
  const points = SAMPLE_XS.flatMap((x) =>
    [0.7, 1.4, 2.5].map((y) => ({
      ...parameters,
      [independent]: x,
      [dependent]: y,
      [CONSTANT]: 0,
    }))
  );
  const ok = agreesOnSamples(
    (bindings) =>
      -numericDerivative(relation, independent, bindings) /
      numericDerivative(relation, dependent, bindings),
    (bindings) => evaluate(f, bindings),
    points
  );
  return ok
    ? { ok: true, solution }
    : {
        ok: false,
        error:
          "A candidate relation was found but does not satisfy the equation, so it has not been reported.",
      };
}

function failed(error: unknown): ODEResult {
  if (error instanceof IntegrationError)
    return { ok: false, error: error.message };
  throw error;
}

function isZero(node: Node) {
  return node.type === "Constant" && node.value === 0;
}

/**
 * Multiplies `factor` through a sum, so each term meets it separately.
 *
 * Only across the top-level additions, and only here. General distribution is a
 * normalisation with no obvious stopping point — it turns `2(x+1)` into `2x+2`
 * and a nested product into a wall — whereas this exists for one reason: the
 * integrating factor has to reach the exponentials it is meant to cancel.
 */
function distribute(factor: Node, sum: Node): Node {
  if (sum.type === "BinaryOperator") {
    if (sum.name === "Add")
      return add(distribute(factor, sum.left), distribute(factor, sum.right));
    if (sum.name === "Subtract")
      return subtract(
        distribute(factor, sum.left),
        distribute(factor, sum.right)
      );
  }
  return simplify(multiply(factor, sum));
}
