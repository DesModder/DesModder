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
  coefficientsIn,
  integrate,
  IntegrationError,
  linearIn,
} from "./integrate";
import {
  agreesOnSamples,
  dependsOn,
  evaluate,
  fold as simplify,
  numericDerivative,
  visit,
  toLatex,
} from "../../../symbolic";

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
  /**
   * The right-hand side of `y = …`, kept so a point can be put through it.
   * A general solution is only half an exam answer; the particular one needs
   * the tree, not the string.
   */
  tree?: Node;
  /** `left = right + C`, for a solution left as a relation. */
  relation?: { left: Node; right: Node };
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
  f = resolveImplicitCalls(f, [independent, dependent]);

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

  // Before the general separable path, because separating the logistic equation
  // succeeds and answers with a relation between logarithms — a complete
  // answer, and not the one anybody wants. The closed form is what the syllabus
  // teaches and what a carrying capacity is read off.
  const asLogistic = logistic(emit, f, independent, dependent);
  if (asLogistic !== undefined) return asLogistic;

  return separable(emit, f, independent, dependent);
}

/**
 * Reads `y(1-y)` as y times (1-y) rather than as y applied to (1-y).
 *
 * Desmos's parser resolves juxtaposition before a bracket as function
 * application, so `y\left(1-y\right)` arrives as a `FunctionCall` whose callee
 * is `y`. That is the correct reading of the notation in general and the wrong
 * one here, and it is not a corner case: `y(1-y)` and `ky(1-y/M)` are how the
 * logistic equation is written in every textbook, so without this the headline
 * equation is refused in the only form anybody types.
 *
 * Restricted to the two variables of the equation. A call to `f` or `g` really
 * might be a function the graph defines, and rewriting that as multiplication
 * would silently change what the user asked. Nobody defines a function named
 * `y` while using y as the dependent variable — and if they did, Desmos's own
 * evaluation of the slope field would disagree with this too, which is a
 * conflict the panel would show rather than hide.
 */
function resolveImplicitCalls(node: Node, variables: readonly string[]): Node {
  switch (node.type) {
    case "FunctionCall": {
      const args = node.args.map((arg) => resolveImplicitCalls(arg, variables));
      if (variables.includes(node.callee.symbol) && args.length === 1)
        return multiply(id(node.callee.symbol), args[0]);
      return { ...node, args };
    }
    case "Negative":
      return negative(resolveImplicitCalls(node.arg, variables));
    case "BinaryOperator":
      return {
        ...node,
        left: resolveImplicitCalls(node.left, variables),
        right: resolveImplicitCalls(node.right, variables),
      };
    default:
      return node;
  }
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
      tree: simplify(add(antiderivative, id(CONSTANT))),
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
        tree: solution,
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
        tree: solution,
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
      tree: solution,
    },
    solution,
    f,
    independent,
    dependent
  );
}

/**
 * `dy/dx = ry(1 - y/K)` — the logistic equation, in closed form.
 *
 * Separating it works and produces `ln|y| - ln|1-y/K| = rx + C`, which is a
 * complete answer and is not the one the syllabus teaches. The explicit form is
 * `y = K/(1 + Ce^{-rx})`, and it is the one worth having because everything the
 * question asks is visible in it: K is the carrying capacity the population
 * settles at, r is how fast it gets there, and the inflection point is at K/2.
 *
 * Recognised as a quadratic in y with no constant term — `f = ry + ay²`, so
 * `y = 0` is an equilibrium — which covers `ky(1-y/M)`, `ky(M-y)` and `y(1-y)`
 * without caring which way round they were typed. The carrying capacity is
 * `-r/a`, and `a` is zero exactly when the equation is not logistic at all but
 * plain exponential growth, which the affine case has already taken.
 *
 * `undefined` means "not this shape", so the caller falls through to the
 * general separable path rather than reporting a failure.
 */
function logistic(
  emit: (node: Node) => string,
  f: Node,
  independent: string,
  dependent: string
): ODEResult | undefined {
  const coefficients = coefficientsIn(f, dependent, 2);
  if (coefficients === undefined || coefficients.length !== 3) return undefined;
  const [constant, linear, quadratic] = coefficients.map((c) => simplify(c));
  // A constant term moves both equilibria off zero and the closed form no
  // longer applies.
  if (!isZero(constant)) return undefined;
  if (isZero(quadratic)) return undefined;
  // A rate that varies with x is a different equation.
  if (dependsOn(linear, independent) || dependsOn(quadratic, independent))
    return undefined;

  const capacity = simplify(divide(negative(linear), quadratic));
  const solution = simplify(
    divide(
      capacity,
      add(
        number(1),
        multiply(
          id(CONSTANT),
          power(id("e"), simplify(multiply(negative(linear), id(independent))))
        )
      )
    )
  );
  return verified(
    {
      latex: `${dependent}=${emit(solution)}`,
      method: `Logistic, carrying capacity ${emit(capacity)}`,
      explicit: true,
      tree: solution,
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
    relation: { left: simplify(left), right: simplify(right) },
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

  // Each side is gathered as a numerator list and a denominator list and only
  // assembled at the end, rather than divided into step by step. Building it
  // incrementally nests the quotients — `1/y` then divided again by `(1-y/M)`
  // — and the integrator sees a fraction whose denominator is itself a
  // fraction, which no rule matches. Assembling once gives the single flat
  // reciprocal that partial fractions is looking for.
  const gNumerator: Node[] = [];
  const gDenominator: Node[] = [];
  const inverseNumerator: Node[] = [];
  const inverseDenominator: Node[] = [];

  for (const { node, inNumerator } of collected) {
    const hasX = dependsOn(node, independent);
    const hasY = dependsOn(node, dependent);
    if (hasX && hasY) return undefined;
    if (hasY) {
      // Inverted as it is collected, since what gets integrated is 1/h.
      (inNumerator ? inverseDenominator : inverseNumerator).push(node);
    } else {
      // Anything free of y belongs with x, including plain constants.
      (inNumerator ? gNumerator : gDenominator).push(node);
    }
  }
  return {
    g: simplify(assemble(gNumerator, gDenominator)),
    hInverse: simplify(assemble(inverseNumerator, inverseDenominator)),
  };
}

/** A quotient from its two lists of factors, with no redundant `1`s. */
function assemble(numerator: Node[], denominator: Node[]): Node {
  const product = (factors: Node[]) =>
    factors.length === 0
      ? number(1)
      : factors.reduce((left, right) => multiply(left, right));
  if (denominator.length === 0) return product(numerator);
  return divide(product(numerator), product(denominator));
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
