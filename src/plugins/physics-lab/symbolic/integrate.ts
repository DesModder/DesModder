/**
 * Antiderivatives over Desmos's own syntax tree.
 *
 * The mirror image of Vector Tools' `symbolic.ts`, and deliberately not as
 * capable, because the two problems are not the same size. Differentiation is
 * mechanical: every expression built from known pieces has a derivative, and a
 * table plus the chain and product rules gets all of them. Integration is not.
 * Most expressions have no antiderivative in closed form at all, and the ones
 * that do need choices — which substitution, which parts, which partial
 * fraction — that a table cannot make.
 *
 * So this covers the forms an AP course actually integrates, and **refuses
 * everything else by name** rather than guessing. That refusal is the feature.
 * A wrong antiderivative is not a small error: it is a solution curve that
 * confidently disagrees with the slope field it was derived from, and the whole
 * point of showing both is that they agree.
 *
 * The one structural simplification worth stating: arguments must be **linear**
 * in the variable. `sin(3x+1)` integrates, `sin(x²)` does not — and `sin(x²)`
 * genuinely has no elementary antiderivative, so refusing it is correct rather
 * than merely convenient. Linear arguments cover substitution's whole role at
 * this level, and doing them by the `1/a` factor rather than by a general
 * u-substitution keeps the result in the form a student would write.
 */
import { Aug } from "../../../../text-mode-core";
import {
  constantValue,
  differentiate,
  expand,
  fold,
  rationalNode,
  rationalOf,
  replaceIdentifier,
} from "../../../symbolic";
import {
  asSinesAndCosines,
  findSubstitution,
  oddTrigPower,
} from "./substitute";
import { rationalIntegral } from "./rationalIntegral";
import { findTrigSubstitution } from "./trigSubstitution";
import {
  add,
  binop,
  call,
  dependsOn,
  divide,
  id,
  multiply,
  negative,
  nodeCount,
  number,
  power,
  sameTree,
  subtract,
  type Node,
} from "../../../symbolic";

/** Thrown for anything this cannot integrate exactly. */
export class IntegrationError extends Error {}

/**
 * `node` as `a·variable + b` with a and b free of the variable, or `undefined`
 * if it is not linear in it.
 *
 * This is what decides whether a function call can be integrated at all, so it
 * is written to recognise the shapes people write rather than to be clever:
 * `x`, `3x`, `x/2`, `2x+1`, `1-x`, and sums and differences of those.
 */
export function linearIn(
  node: Node,
  variable: string
): { a: Node; b: Node } | undefined {
  const found = linearParts(node, variable);
  // Simplified because the slope is divided by, printed, and compared against
  // zero. An unsimplified `3·1` is all three of those done badly.
  return found === undefined
    ? undefined
    : { a: fold(found.a), b: fold(found.b) };
}

function linearParts(
  node: Node,
  variable: string
): { a: Node; b: Node } | undefined {
  if (!dependsOn(node, variable)) return { a: number(0), b: node };
  switch (node.type) {
    case "Identifier":
      return node.symbol === variable
        ? { a: number(1), b: number(0) }
        : undefined;
    case "Negative": {
      const inner = linearParts(node.arg, variable);
      return inner === undefined
        ? undefined
        : { a: negative(inner.a), b: negative(inner.b) };
    }
    case "BinaryOperator": {
      const { left, right } = node;
      switch (node.name) {
        case "Add":
        case "Subtract": {
          const l = linearParts(left, variable);
          const r = linearParts(right, variable);
          if (l === undefined || r === undefined) return undefined;
          const join = node.name === "Add" ? add : subtract;
          return { a: join(l.a, r.a), b: join(l.b, r.b) };
        }
        case "Multiply":
        case "CrossMultiply": {
          // Exactly one side may carry the variable, or the product is not
          // linear — `x·x` is not, and neither is `x·sin(x)`.
          const leftHas = dependsOn(left, variable);
          const rightHas = dependsOn(right, variable);
          if (leftHas && rightHas) return undefined;
          const [scalar, rest] = leftHas ? [right, left] : [left, right];
          const inner = linearParts(rest, variable);
          return inner === undefined
            ? undefined
            : { a: multiply(scalar, inner.a), b: multiply(scalar, inner.b) };
        }
        case "Divide": {
          if (dependsOn(right, variable)) return undefined;
          const inner = linearParts(left, variable);
          return inner === undefined
            ? undefined
            : { a: divide(inner.a, right), b: divide(inner.b, right) };
        }
        default:
          return undefined;
      }
    }
    default:
      return undefined;
  }
}

/**
 * Antiderivatives of the named functions of a bare variable. The `1/a` factor
 * for a linear argument is applied by the caller, not here.
 */
const FUNCTION_INTEGRALS: Record<string, (u: Node) => Node> = {
  sin: (u) => negative(call("cos", u)),
  cos: (u) => call("sin", u),
  exp: (u) => call("exp", u),
  // The three that are themselves a logarithm of something trigonometric.
  tan: (u) => negative(call("ln", call("abs", call("cos", u)))),
  cot: (u) => call("ln", call("abs", call("sin", u))),
  sec: (u) => call("ln", call("abs", add(call("sec", u), call("tan", u)))),
  csc: (u) =>
    negative(call("ln", call("abs", add(call("csc", u), call("cot", u))))),
  sinh: (u) => call("cosh", u),
  cosh: (u) => call("sinh", u),
  tanh: (u) => call("ln", call("cosh", u)),
  coth: (u) => call("ln", call("abs", call("sinh", u))),
  // Each of these is integration by parts with dv = du, done once and written
  // down rather than rediscovered: the parts rule below only reduces a
  // polynomial factor, and every one of these arrives with no factor at all.
  ln: (u) => subtract(multiply(u, call("ln", u)), u),
  log: (u) =>
    subtract(multiply(u, call("log", u)), divide(u, call("ln", number(10)))),
  arcsin: (u) =>
    add(
      multiply(u, call("arcsin", u)),
      call("sqrt", subtract(number(1), square(u)))
    ),
  arccos: (u) =>
    subtract(
      multiply(u, call("arccos", u)),
      call("sqrt", subtract(number(1), square(u)))
    ),
  arctan: (u) =>
    subtract(
      multiply(u, call("arctan", u)),
      divide(call("ln", add(number(1), square(u))), number(2))
    ),
  arcsinh: (u) =>
    subtract(
      multiply(u, call("arcsinh", u)),
      call("sqrt", add(square(u), number(1)))
    ),
  arctanh: (u) =>
    add(
      multiply(u, call("arctanh", u)),
      divide(call("ln", call("abs", subtract(number(1), square(u)))), number(2))
    ),
  sqrt: (u) =>
    divide(
      multiply(number(2), power(u, divide(number(3), number(2)))),
      number(3)
    ),
};

const square = (node: Node) => power(node, number(2));

/**
 * The antiderivative of `node` with respect to `variable`, without a constant
 * of integration — the caller adds that, because only the caller knows whether
 * it is `+C` or a definite bound.
 *
 * Throws {@link IntegrationError} for anything it cannot do exactly.
 */
export function integrate(node: Node, variable: string): Node {
  // Simplified going in as well as coming out. The rules below match on shape,
  // so an integrand that has not been folded first gets refused for the shape
  // it happens to have been written in rather than for what it is: `(x+1)(x+1)`
  // is not a recognised denominator and `(x+1)^2` is the same thing and is.
  const folded = fold(node);
  const direct = attempt(folded, variable);

  // Multiplied out and tried again, because there is no product rule for
  // integrals and there does not need to be one. `∫(x+1)(x+2)dx` has no rule
  // that matches it; `∫x²+3x+2 dx` is three applications of the power rule.
  // `∫(x²+1)/x dx` is a quotient with the variable on both sides of the bar,
  // which is refused, and is `∫x dx + ∫dx/x` once the fraction is split.
  // Expanding first is how the problem is done by hand.
  const opened = fold(expand(folded).node);
  // Expanding is only *always* the right idea when what comes out is a
  // polynomial, where integrating term by term is the whole technique. The
  // rest of the time it is a fallback, tried when no rule matched the
  // integrand as written.
  //
  // The case that settled this: `1/(x(1-x))` expands to `1/(x-x^2)`, which is
  // a perfectly good integral and comes back through the discriminant as
  // `ln|x/(x-1)|` -- one node shorter than the `ln|x| - ln|1-x|` that partial
  // fractions gives, and not the form anybody writes it in. A rule that
  // preferred it because of one node would be picking answers by accident.
  const worthExpanding =
    !sameTree(opened, folded) &&
    (!direct.ok || polynomialDegree(opened, variable) !== undefined);
  if (!worthExpanding) {
    if (direct.ok) return direct.value;
    throw direct.error;
  }
  const expanded = attempt(opened, variable);

  if (!expanded.ok) {
    // The message kept is the one about the expression the user actually
    // wrote, not about a form they have never seen and did not ask for.
    if (direct.ok) return direct.value;
    throw direct.error;
  }
  if (!direct.ok) return expanded.value;

  // Both routes worked, which happens more often than it sounds: integration
  // by parts succeeds on `(x+1)(x+2)` and answers
  // `(x+1)(x²/2+2x) - (x³/6+x²)`, which is a correct antiderivative and is not
  // what anybody writes. Two antiderivatives of one integrand differ by a
  // constant, so there is nothing to choose between them on correctness and
  // the shorter one is the answer.
  //
  // The tie goes to the unexpanded route, which is what keeps `∫(x+1)^7 dx`
  // answering `(x+1)^8/8` rather than eight terms of the same function.
  return nodeCount(expanded.value) < nodeCount(direct.value)
    ? expanded.value
    : direct.value;
}

/**
 * An antiderivative, or the error saying why there is none.
 *
 * Both routes above are tried in full before either is chosen, which is why
 * failure is returned here rather than thrown.
 */
function attempt(
  node: Node,
  variable: string
): { ok: true; value: Node } | { ok: false; error: IntegrationError } {
  try {
    return { ok: true, value: fold(antiderivative(node, variable)) };
  } catch (error) {
    if (!(error instanceof IntegrationError)) throw error;
    return { ok: false, error };
  }
}

/**
 * How deep a chain of substitutions may go before it is called a loop.
 *
 * Each substitution hands back a smaller integral, so a genuine chain is two or
 * three long. The cap is there because a substitution is a *search*, and a
 * search that keeps finding something to try is how a refusal turns into a
 * hang.
 */
const MAX_SUBSTITUTION_DEPTH = 4;

function antiderivative(node: Node, variable: string, depth = 0): Node {
  try {
    return byRule(node, variable, depth);
  } catch (error) {
    if (!(error instanceof IntegrationError)) throw error;
    // No rule matched the shape. Everything below rewrites the integrand into
    // something a rule can match, and each one is an identity, so a rewrite
    // that does not help costs a refusal and never a wrong answer.
    const rewritten = byRewrite(node, variable, depth);
    if (rewritten !== undefined) return rewritten;
    // The message kept is the one about the integrand as written.
    throw error;
  }
}

/**
 * The rewrites, tried in the order that gives the tidiest answer.
 *
 * Substitution first, because it is the one that most often turns an integral
 * into a rule rather than into another integral. The trigonometric rewrite
 * second, because the only thing it does is make a substitution possible.
 */
function byRewrite(
  node: Node,
  variable: string,
  depth: number
): Node | undefined {
  if (depth >= MAX_SUBSTITUTION_DEPTH) return undefined;

  const substituted = bySubstitution(node, variable, depth);
  if (substituted !== undefined) return substituted;

  // A root of a sum of squares is the one shape no substitution can clear,
  // because what is in the way is not a composition. Tried after the search,
  // since a root that *is* part of a composition is cheaper to undo that way.
  const trig = findTrigSubstitution(node, variable);
  if (trig !== undefined) {
    try {
      const inner = antiderivative(trig.integrand, trig.name, depth + 1);
      return trig.back(inner);
    } catch (error) {
      // A substitution that did not help is not an error about the integral.
      if (!(error instanceof IntegrationError)) throw error;
    }
  }

  const reduced = oddTrigPower(node, variable);
  if (reduced !== undefined) {
    // Multiplied out first, so the substitution that follows sees a sum of
    // terms rather than a power of one.
    return antiderivative(fold(expand(reduced).node), variable, depth + 1);
  }

  // Last, because it makes an expression longer whenever it does not help.
  const plain = asSinesAndCosines(node, variable);
  if (plain !== undefined) {
    try {
      return antiderivative(fold(plain), variable, depth + 1);
    } catch (error) {
      if (!(error instanceof IntegrationError)) throw error;
    }
  }

  return undefined;
}

/**
 * One substitution, found and carried out, or `undefined` if none was found or
 * the integral it produced could not be done either.
 *
 * Returning `undefined` rather than throwing on the inner failure is what keeps
 * a substitution from turning a good error message into a confusing one: the
 * caller still has the message about the integrand as it was written.
 */
function bySubstitution(
  node: Node,
  variable: string,
  depth: number
): Node | undefined {
  if (depth >= MAX_SUBSTITUTION_DEPTH) return undefined;
  const found = findSubstitution(node, variable);
  if (found === undefined) return undefined;
  try {
    // The inner integral is done in the new name, then the name is put back.
    // Undoing the substitution is the one step here that could be wrong, and
    // it is also the one the caller's numeric check catches.
    const inner = antiderivative(found.integrand, found.name, depth + 1);
    return fold(replaceIdentifier(inner, found.name, found.u));
  } catch (error) {
    if (!(error instanceof IntegrationError)) throw error;
    return undefined;
  }
}

function byRule(node: Node, variable: string, depth: number): Node {
  // Anything free of the variable is a constant, and integrates to c·x.
  if (!dependsOn(node, variable)) return multiply(node, id(variable));

  switch (node.type) {
    case "Identifier":
      // The variable itself.
      return divide(power(id(variable), number(2)), number(2));
    case "Negative":
      return negative(antiderivative(node.arg, variable, depth));
    case "BinaryOperator":
      return binaryIntegral(node, variable, depth);
    case "FunctionCall":
      return functionIntegral(node, variable);
    default:
      throw new IntegrationError(
        `${describe(node)} cannot be integrated symbolically.`
      );
  }
}

function binaryIntegral(
  node: Aug.Latex.BinaryOperator,
  variable: string,
  depth: number
): Node {
  const { left, right } = node;
  switch (node.name) {
    case "Add":
      return add(
        antiderivative(left, variable, depth),
        antiderivative(right, variable, depth)
      );
    case "Subtract":
      return subtract(
        antiderivative(left, variable, depth),
        antiderivative(right, variable, depth)
      );
    case "Multiply":
    case "CrossMultiply": {
      // A constant factor comes out. Two factors that both carry the variable
      // would need parts or a substitution, and there is no rule here that
      // chooses between them.
      const leftHas = dependsOn(left, variable);
      const rightHas = dependsOn(right, variable);
      if (leftHas && rightHas) {
        // The one product where parts never terminates and the answer is still
        // elementary, because applying it twice returns the original integral
        // with a coefficient and the equation can be solved for it.
        const cyclic = exponentialTimesWave(left, right, variable);
        if (cyclic !== undefined) return cyclic;
        // Substitution before parts, where both apply. `x√(1-x²)` is one
        // substitution away from a power rule and parts turns it into `x`
        // times an arcsine -- correct, three times the length, and the sort of
        // answer that makes a reader think they have misread the question.
        const substituted = bySubstitution(node, variable, depth);
        if (substituted !== undefined) return substituted;
        return byParts(left, right, variable, depth);
      }
      return leftHas
        ? multiply(right, antiderivative(left, variable, depth))
        : multiply(left, antiderivative(right, variable, depth));
    }
    case "Divide": {
      if (!dependsOn(right, variable)) {
        // A constant denominator is a constant factor.
        return divide(antiderivative(left, variable, depth), right);
      }
      if (dependsOn(left, variable)) {
        // One polynomial over another is its own family, decided by the
        // denominator's discriminant rather than by its shape.
        const rational = rationalIntegral(left, right, variable, (piece) =>
          antiderivative(piece, variable, depth)
        );
        if (rational !== undefined) return rational;
        throw new IntegrationError(
          "A quotient with the variable above and below the line needs a substitution or partial fractions, which this does not do."
        );
      }
      // c / u^n is a negative power, not a logarithm. Separating dy/dx = x·y²
      // produces exactly this, and sending it to the logarithm rule below would
      // reject a perfectly ordinary integral for having a denominator that is
      // not linear — when it is the *exponent* that matters, not the power.
      if (
        right.type === "BinaryOperator" &&
        right.name === "Exponent" &&
        right.right.type === "Constant"
      ) {
        return antiderivative(
          multiply(left, power(right.left, number(-right.right.value))),
          variable,
          depth
        );
      }
      // c / (L₁·L₂), two factors each linear in the variable: partial
      // fractions. This is the logistic equation and nothing else — separating
      // dy/dx = ky(1 - y/M) asks for exactly ∫dy/(y(1-y/M)), and without this
      // the equation on the BC syllabus is refused.
      const split = partialFractions(right, variable);
      if (split !== undefined) return multiply(left, split);

      // A constant over a quadratic is an arctangent, a pair of logarithms or
      // a power depending on the discriminant, and nothing else here can tell
      // those apart.
      //
      // After the factor-based split rather than before it, deliberately. Both
      // can do `1/(x(1-x))`; the one above writes it as `ln|x| - ln|1-x|`,
      // which is the answer in the book, and this one writes the same function
      // through `2ax+b±√D`, which is the answer in a table of integrals.
      const rational = rationalIntegral(left, right, variable, (piece) =>
        antiderivative(piece, variable, depth)
      );
      if (rational !== undefined) return rational;

      // c / sqrt(a - x^2) and its two relatives, which are the inverse
      // trigonometric and hyperbolic functions and nothing else. They arrive
      // as a quotient with a root underneath, which no other rule here reads.
      const root = rootDenominatorIntegral(left, right, variable);
      if (root !== undefined) return root;

      // c / (ax + b) is the logarithm, which is the case every separable
      // growth-and-decay problem turns into.
      const linear = linearIn(right, variable);
      if (linear === undefined) {
        throw new IntegrationError(
          "Only a denominator that is linear in the variable can be integrated here."
        );
      }
      return divide(multiply(left, call("ln", call("abs", right))), linear.a);
    }
    case "Exponent":
      return exponentIntegral(left, right, variable, depth);
  }
}

/**
 * `∫ dv / (L₁·L₂)` where both factors are linear in the variable, or
 * `undefined` when the denominator is not that shape.
 *
 * Done on the factors rather than by finding roots, which matters because the
 * coefficients are usually symbolic: the logistic equation's denominator is
 * `y(1 - y/M)`, whose roots are 0 and M, and a solver that needed numbers for
 * them would refuse the one form the equation is always written in.
 *
 * Writing `1/(L₁L₂) = A/L₁ + B/L₂` and matching coefficients gives
 * `A = a₁/D`, `B = -a₂/D` with `D = a₁b₂ - a₂b₁`, and integrating each term
 * collapses the whole thing to `ln|L₁/L₂| / D`. D is zero exactly when the two
 * factors are proportional — a repeated root, which needs a different
 * decomposition — and that case is refused rather than divided by.
 */
function partialFractions(
  denominator: Node,
  variable: string
): Node | undefined {
  if (
    denominator.type !== "BinaryOperator" ||
    (denominator.name !== "Multiply" && denominator.name !== "CrossMultiply")
  )
    return undefined;
  const first = linearIn(denominator.left, variable);
  const second = linearIn(denominator.right, variable);
  if (first === undefined || second === undefined) return undefined;
  // Both must genuinely involve the variable; a constant factor is not a pole
  // and belongs to the simpler logarithm rule below.
  if (isZeroConstant(first.a) || isZeroConstant(second.a)) return undefined;

  const cross = fold(
    subtract(multiply(first.a, second.b), multiply(second.a, first.b))
  );
  if (isZeroConstant(cross)) return undefined;

  return divide(
    subtract(
      call("ln", call("abs", denominator.left)),
      call("ln", call("abs", denominator.right))
    ),
    cross
  );
}

/**
 * `∫sec³u du` and `∫csc³u du`, the two that need the reduction formula.
 *
 * Neither is reachable by any of the other rules. Parts against `sec u` brings
 * the same integral back with a coefficient, exactly as the exponential and the
 * wave do, and the answer is what you get by solving for it:
 *
 *     ∫sec³ = (sec u tan u + ln|sec u + tan u|) / 2
 *
 * Written down rather than derived, for the same reason the cyclic pair is.
 */
function oddSecantCube(base: Node, variable: string): Node | undefined {
  if (base.type !== "FunctionCall" || base.args.length !== 1) return undefined;
  const name = base.callee.symbol;
  if (name !== "sec" && name !== "csc") return undefined;
  const [argument] = base.args;
  const linear = linearIn(argument, variable);
  if (linear === undefined || isZeroConstant(linear.a)) return undefined;

  if (name === "sec") {
    const inner = add(
      multiply(call("sec", argument), call("tan", argument)),
      call("ln", call("abs", add(call("sec", argument), call("tan", argument))))
    );
    return divide(inner, multiply(number(2), linear.a));
  }
  const inner = subtract(
    negative(multiply(call("csc", argument), call("cot", argument))),
    call("ln", call("abs", add(call("csc", argument), call("cot", argument))))
  );
  return divide(inner, multiply(number(2), linear.a));
}

/**
 * `∫ e^{ax} sin(bx) dx` and its cousin with a cosine.
 *
 * The integral that made integration by parts famous and the one it cannot
 * finish: parts takes it to another integral of the same shape, and parts again
 * takes it back to where it started. What finishes it is algebra rather than
 * calculus -- `I = ... - (b/a)^2 I`, solved for `I` -- and the result is short
 * enough to write down, so it is written down here instead of being
 * rediscovered every time.
 *
 * Both arguments must be linear, and in this the two coefficients are `a` and
 * `b`. Nothing else about the product matters.
 */
function exponentialTimesWave(
  left: Node,
  right: Node,
  variable: string
): Node | undefined {
  const pair = (first: Node, second: Node) => {
    const exponential = asExponential(first, variable);
    const wave = asWave(second, variable);
    return exponential === undefined || wave === undefined
      ? undefined
      : { exponential, wave };
  };
  const found = pair(left, right) ?? pair(right, left);
  if (found === undefined) return undefined;
  const { exponential, wave } = found;

  // a² + b², the denominator both forms share.
  const scale = add(square(exponential.rate), square(wave.rate));
  const sine = call("sin", wave.argument);
  const cosine = call("cos", wave.argument);
  const inner =
    wave.name === "sin"
      ? subtract(multiply(exponential.rate, sine), multiply(wave.rate, cosine))
      : add(multiply(exponential.rate, cosine), multiply(wave.rate, sine));
  return divide(multiply(exponential.node, inner), scale);
}

/** `e^{ax}` or `exp(ax)` with `a` free of the variable, as its rate. */
function asExponential(
  node: Node,
  variable: string
): { node: Node; rate: Node } | undefined {
  const exponent =
    node.type === "FunctionCall" &&
    node.callee.symbol === "exp" &&
    node.args.length === 1
      ? node.args[0]
      : node.type === "BinaryOperator" &&
          node.name === "Exponent" &&
          node.left.type === "Identifier" &&
          node.left.symbol === "e"
        ? node.right
        : undefined;
  if (exponent === undefined) return undefined;
  const linear = linearIn(exponent, variable);
  if (linear === undefined || isZeroConstant(linear.a)) return undefined;
  // A shift is a constant factor and comes along inside `node` untouched.
  return { node, rate: linear.a };
}

/** `sin(bx)` or `cos(bx)` with a linear argument, as its rate. */
function asWave(
  node: Node,
  variable: string
): { name: "sin" | "cos"; argument: Node; rate: Node } | undefined {
  if (node.type !== "FunctionCall" || node.args.length !== 1) return undefined;
  const name = node.callee.symbol;
  if (name !== "sin" && name !== "cos") return undefined;
  const linear = linearIn(node.args[0], variable);
  if (linear === undefined || isZeroConstant(linear.a)) return undefined;
  return { name, argument: node.args[0], rate: linear.a };
}

/** Beyond this a polynomial factor is not what anybody meant to type. */
const MAX_PARTS_DEGREE = 8;

/**
 * Integration by parts, for the one shape it reliably terminates on: a
 * polynomial times something that keeps its form when integrated.
 *
 * ∫u·w = u·W - ∫u'·W, with W the antiderivative of w. That recursion only ends
 * if u' is eventually zero, which is exactly what a polynomial guarantees and
 * what nothing else here does — attempting parts on a general product can
 * recurse until the stack runs out, or return to where it started.
 *
 * The restriction is not a shortcut. This is tabular integration, and the
 * polynomial-times-exponential case it covers is what solving `dy/dx = x - y`
 * comes down to: the integrating factor turns it into ∫x·e^x, which is the
 * integral behind every "y = x - 1 + Ce^{-x}" in an AP answer key.
 */
function byParts(
  left: Node,
  right: Node,
  variable: string,
  depth: number
): Node {
  const leftDegree = polynomialDegree(left, variable);
  const rightDegree = polynomialDegree(right, variable);
  // If both are polynomials the product is one too, and expanding it is not
  // this function's job — but it is also not a case parts is needed for.
  const usePolynomialLeft =
    leftDegree !== undefined &&
    (rightDegree === undefined || leftDegree <= rightDegree);
  const polynomial = usePolynomialLeft ? left : right;
  const rest = usePolynomialLeft ? right : left;
  const degree = usePolynomialLeft ? leftDegree : rightDegree;

  if (depth >= MAX_SUBSTITUTION_DEPTH) {
    throw new IntegrationError(
      "Integration by parts did not terminate on this product."
    );
  }
  // A logarithm or an inverse function against anything that can be integrated
  // at all, whether or not the other factor is a polynomial. `√x ln x` is the
  // ordinary example: neither factor is a polynomial and parts still finishes
  // in one step, because differentiating the logarithm is what ends it.
  const inverseLeft = isInverseOrLog(left);
  const inverseRight = isInverseOrLog(right);
  if (degree === undefined && (inverseLeft || inverseRight)) {
    const chosen = inverseLeft ? left : right;
    const other = inverseLeft ? right : left;
    const inner = antiderivative(other, variable, depth + 1);
    const chosenDerivative = fold(differentiate(chosen, variable));
    return subtract(
      multiply(chosen, inner),
      antiderivative(
        fold(multiply(chosenDerivative, inner)),
        variable,
        depth + 1
      )
    );
  }
  if (degree === undefined || degree > MAX_PARTS_DEGREE) {
    throw new IntegrationError(
      "A product of two expressions that both contain the variable needs integration by parts, and neither factor is a polynomial this can reduce."
    );
  }

  // Which factor becomes `u` is the whole of integration by parts, and putting
  // the polynomial there is right for every case except one. A logarithm or an
  // inverse trigonometric function has an antiderivative that still contains
  // itself: the integral of `arctan x` is `x arctan x - ...`, so taking
  // `dv = arctan x dx` produces a remaining integral with `x arctan x` in it,
  // which is the integral that was being done. It recurses forever.
  //
  // The usual name for choosing the other way round is LIATE, and the reason
  // behind the mnemonic is exactly this: those are the functions that get
  // simpler when differentiated and worse when integrated.
  if (isInverseOrLog(rest)) {
    const inner = antiderivative(polynomial, variable, depth + 1);
    const restDerivative = fold(differentiate(rest, variable));
    return subtract(
      multiply(rest, inner),
      antiderivative(fold(multiply(restDerivative, inner)), variable, depth + 1)
    );
  }

  const restIntegral = antiderivative(rest, variable, depth + 1);
  const derivative = polynomialDerivative(polynomial, variable);
  // The remaining integral has a polynomial one degree lower, so this bottoms
  // out at a constant, whose derivative is zero and whose term vanishes.
  if (isZeroConstant(derivative)) return multiply(polynomial, restIntegral);
  return subtract(
    multiply(polynomial, restIntegral),
    antiderivative(
      fold(multiply(derivative, restIntegral)),
      variable,
      depth + 1
    )
  );
}

/**
 * The L and I of LIATE: the functions whose antiderivative still contains them.
 *
 * Matched on the call rather than on anything deeper, because that is exactly
 * the shape that matters. `x·arctan(x)` is the case; `x·arctan(x)²` is not one
 * parts can finish at all, and the recursion guard refuses it rather than this
 * list pretending to.
 */
const INVERSE_OR_LOG = new Set([
  "ln",
  "log",
  "arcsin",
  "arccos",
  "arctan",
  "arccot",
  "arcsec",
  "arccsc",
  "arcsinh",
  "arccosh",
  "arctanh",
]);

function isInverseOrLog(node: Node) {
  return node.type === "FunctionCall" && INVERSE_OR_LOG.has(node.callee.symbol);
}

/**
 * `c / √(k ± (linear)²)`, which is where the inverse functions come from.
 *
 * Three integrals, told apart by two signs:
 *
 * - `1/√(k - u²)` is `arcsin(u/√k)`, the one every course does.
 * - `1/√(k + u²)` is `arcsinh(u/√k)`, which Desmos has under that name.
 * - `1/√(u² - k)` is `arccosh(u/√k)`, defined only where `u > √k`.
 *
 * Only a *linear* `u`, and only a numeric `k`. The linear part is the same
 * restriction every other rule here carries and for the same reason: the `1/a`
 * factor is what a substitution would have produced, and anything else needs a
 * real substitution, which the search will have already tried and failed at
 * before this is reached. The numeric part is because the sign of `k` decides
 * which of the three this is, exactly as the discriminant does for a quadratic
 * denominator.
 */
function rootDenominatorIntegral(
  numerator: Node,
  denominator: Node,
  variable: string
): Node | undefined {
  if (
    denominator.type !== "FunctionCall" ||
    denominator.callee.symbol !== "sqrt" ||
    denominator.args.length !== 1
  ) {
    return undefined;
  }
  // The numerator has to be a constant factor. Without this check
  // `x^2/sqrt(1-x^2)` would come back as `x^2 arcsin(x)`, which is not an
  // antiderivative of anything -- the one way a rule here can be wrong rather
  // than merely absent.
  if (dependsOn(numerator, variable)) return undefined;
  const inside = coefficientsIn(denominator.args[0], variable, 2);
  if (inside === undefined || inside.length !== 3) return undefined;
  const constant = constantValue(fold(inside[0]));
  const linearTerm = constantValue(fold(inside[1]));
  const quadratic = constantValue(fold(inside[2]));
  // A linear term would mean the square is not centred on the origin. It could
  // be completed, and doing so is the substitution `u = x + b/2a` that the
  // search reaches first, so there is nothing here for it to add.
  if (
    constant === undefined ||
    linearTerm !== 0 ||
    quadratic === undefined ||
    quadratic === 0
  ) {
    return undefined;
  }

  const scale = call("sqrt", number(Math.abs(constant / quadratic)));
  const argument = divide(id(variable), scale);
  const magnitude = call("sqrt", number(Math.abs(quadratic)));
  const named = (name: string) => divide(call(name, argument), magnitude);

  if (constant > 0 && quadratic < 0)
    return multiply(numerator, named("arcsin"));
  if (constant > 0 && quadratic > 0)
    return multiply(numerator, named("arcsinh"));
  if (constant < 0 && quadratic > 0)
    return multiply(numerator, named("arccosh"));
  // Both negative: the whole thing under the root is negative everywhere, so
  // there is no real function to integrate.
  return undefined;
}

/**
 * Powers of the six trigonometric functions, where there is a rule.
 *
 * `sec²` and `csc²` are derivatives of `tan` and `cot`, so they integrate
 * straight back. The squares of `sin` and `cos` go through the half-angle
 * identity, which is the only way to do them and the form every answer key
 * uses. `tan²` and `cot²` go through `sec² = 1 + tan²`.
 *
 * Odd powers are not here: they reduce to a substitution instead, which
 * `oddTrigPower` does, and handling them twice would mean two answers for one
 * integral depending on which rule was reached first.
 */
function trigPowerIntegral(
  base: Node,
  exponent: Node,
  variable: string,
  depth: number
): Node | undefined {
  if (exponent.type !== "Constant") return undefined;
  if (exponent.value === 3) return oddSecantCube(base, variable);
  if (exponent.value !== 2) return undefined;
  if (base.type !== "FunctionCall" || base.args.length !== 1) return undefined;
  const name = base.callee.symbol;
  const [argument] = base.args;
  const linear = linearIn(argument, variable);
  // The `1/a` factor every rule here needs, and the reason a non-linear
  // argument is refused rather than guessed at: `sec²(x²)` has no elementary
  // antiderivative at all.
  if (linear === undefined || isZeroConstant(linear.a)) return undefined;
  const over = (node: Node) => divide(node, linear.a);
  const x = id(variable);

  switch (name) {
    case "sec":
      return over(call("tan", argument));
    case "csc":
      return negative(over(call("cot", argument)));
    case "sech":
      return over(call("tanh", argument));
    case "csch":
      return negative(over(call("coth", argument)));
    case "tan":
      // tan² = sec² - 1.
      return subtract(over(call("tan", argument)), x);
    case "cot":
      return subtract(negative(over(call("cot", argument))), x);
    case "tanh":
      return subtract(x, over(call("tanh", argument)));
    case "coth":
      return subtract(x, over(call("coth", argument)));
    case "sin":
    case "cos": {
      // sin² = (1 - cos 2u)/2 and cos² = (1 + cos 2u)/2. The doubled argument
      // brings its own factor of two, which is where the 4 comes from.
      const doubled = call("sin", multiply(number(2), argument));
      const half = divide(x, number(2));
      const wave = divide(doubled, multiply(number(4), linear.a));
      return name === "sin" ? subtract(half, wave) : add(half, wave);
    }
    default:
      void depth;
      return undefined;
  }
}

/**
 * The degree of `node` as a polynomial in `variable`, or `undefined` if it is
 * not one. A constant is degree zero.
 */
function polynomialDegree(node: Node, variable: string): number | undefined {
  if (!dependsOn(node, variable)) return 0;
  switch (node.type) {
    case "Identifier":
      return node.symbol === variable ? 1 : 0;
    case "Negative":
      return polynomialDegree(node.arg, variable);
    case "BinaryOperator": {
      const left = polynomialDegree(node.left, variable);
      const right = polynomialDegree(node.right, variable);
      switch (node.name) {
        case "Add":
        case "Subtract":
          return left === undefined || right === undefined
            ? undefined
            : Math.max(left, right);
        case "Multiply":
        case "CrossMultiply":
          return left === undefined || right === undefined
            ? undefined
            : left + right;
        case "Divide":
          // Only division by something free of the variable keeps it a
          // polynomial.
          return right === 0 && left !== undefined ? left : undefined;
        case "Exponent": {
          if (node.right.type !== "Constant") return undefined;
          const exponent = node.right.value;
          if (!Number.isInteger(exponent) || exponent < 0) return undefined;
          return left === undefined ? undefined : left * exponent;
        }
      }
      return undefined;
    }
    default:
      return undefined;
  }
}

/**
 * The derivative of a polynomial. Deliberately narrow: this exists only to make
 * the parts recursion terminate, and a general differentiator would let it
 * accept products it could never finish reducing.
 */
function polynomialDerivative(node: Node, variable: string): Node {
  if (!dependsOn(node, variable)) return number(0);
  switch (node.type) {
    case "Identifier":
      return number(node.symbol === variable ? 1 : 0);
    case "Negative":
      return negative(polynomialDerivative(node.arg, variable));
    case "BinaryOperator": {
      const { left, right } = node;
      switch (node.name) {
        case "Add":
          return add(
            polynomialDerivative(left, variable),
            polynomialDerivative(right, variable)
          );
        case "Subtract":
          return subtract(
            polynomialDerivative(left, variable),
            polynomialDerivative(right, variable)
          );
        case "Multiply":
        case "CrossMultiply":
          return add(
            multiply(polynomialDerivative(left, variable), right),
            multiply(left, polynomialDerivative(right, variable))
          );
        case "Divide":
          return divide(polynomialDerivative(left, variable), right);
        case "Exponent": {
          if (right.type !== "Constant") {
            throw new IntegrationError(
              "A symbolic exponent is not a polynomial term."
            );
          }
          return multiply(
            multiply(right, power(left, number(right.value - 1))),
            polynomialDerivative(left, variable)
          );
        }
      }
      break;
    }
    default:
      break;
  }
  throw new IntegrationError("That is not a polynomial term.");
}

/**
 * The coefficients of `node` as a polynomial in `variable`, lowest power first,
 * or `undefined` if it is not one of degree at most `maxDegree`.
 *
 * The coefficients may be any expression free of the variable, which is the
 * whole point: the logistic equation is written `ky(1 - y/M)`, and reading its
 * quadratic coefficient as `-k/M` rather than demanding a number is what lets
 * it be recognised in the form it is always written in.
 */
export function coefficientsIn(
  node: Node,
  variable: string,
  maxDegree = 2
): Node[] | undefined {
  if (!dependsOn(node, variable)) return [node];
  switch (node.type) {
    case "Identifier":
      return node.symbol === variable ? [number(0), number(1)] : undefined;
    case "Negative": {
      const inner = coefficientsIn(node.arg, variable, maxDegree);
      return inner?.map((c) => negative(c));
    }
    case "BinaryOperator": {
      const { left, right } = node;
      switch (node.name) {
        case "Add":
        case "Subtract": {
          const l = coefficientsIn(left, variable, maxDegree);
          const r = coefficientsIn(right, variable, maxDegree);
          if (l === undefined || r === undefined) return undefined;
          const out: Node[] = [];
          for (let i = 0; i < Math.max(l.length, r.length); i++) {
            const a = l[i] ?? number(0);
            const b = r[i] ?? number(0);
            out.push(node.name === "Add" ? add(a, b) : subtract(a, b));
          }
          return out;
        }
        case "Multiply":
        case "CrossMultiply": {
          const l = coefficientsIn(left, variable, maxDegree);
          const r = coefficientsIn(right, variable, maxDegree);
          if (l === undefined || r === undefined) return undefined;
          if (l.length + r.length - 2 > maxDegree) return undefined;
          const out: Node[] = Array.from(
            { length: l.length + r.length - 1 },
            () => number(0) as Node
          );
          for (let i = 0; i < l.length; i++)
            for (let j = 0; j < r.length; j++)
              out[i + j] = add(out[i + j], multiply(l[i], r[j]));
          return out;
        }
        case "Divide": {
          if (dependsOn(right, variable)) return undefined;
          const l = coefficientsIn(left, variable, maxDegree);
          return l?.map((c) => divide(c, right));
        }
        case "Exponent": {
          if (right.type !== "Constant") return undefined;
          const power = right.value;
          if (!Number.isInteger(power) || power < 0 || power > maxDegree)
            return undefined;
          let out: Node[] = [number(1)];
          for (let i = 0; i < power; i++) {
            const next = coefficientsIn(
              binop("Multiply", rebuild(out, variable), left),
              variable,
              maxDegree
            );
            if (next === undefined) return undefined;
            out = next;
          }
          return out;
        }
      }
      return undefined;
    }
    default:
      return undefined;
  }
}

/** Rebuilds a polynomial from its coefficients, for the exponent case. */
function rebuild(coefficients: Node[], variable: string): Node {
  return coefficients.reduce<Node>(
    (sum, coefficient, index) =>
      index === 0
        ? coefficient
        : add(sum, multiply(coefficient, power(id(variable), number(index)))),
    number(0)
  );
}

function isZeroConstant(node: Node) {
  const simplified = fold(node);
  return simplified.type === "Constant" && simplified.value === 0;
}

/**
 * Powers split into the three cases that appear, and the first two are where
 * nearly all of AP integration lives.
 */
function exponentIntegral(
  base: Node,
  exponent: Node,
  variable: string,
  depth: number
): Node {
  const baseHas = dependsOn(base, variable);
  const exponentHas = dependsOn(exponent, variable);

  // A power of a trigonometric function is not a power rule. `sec²x` has no
  // base linear in x, so the rule below would refuse it, and it is one of the
  // half-dozen integrals a calculus course expects to be instant.
  const trigonometric = trigPowerIntegral(base, exponent, variable, depth);
  if (trigonometric !== undefined) return trigonometric;

  if (baseHas && !exponentHas) {
    const linear = linearIn(base, variable);
    if (linear === undefined) {
      throw new IntegrationError(
        "Only a power of an expression linear in the variable can be integrated here."
      );
    }
    // The power rule fails at exponent -1, where the answer is a logarithm
    // instead. A symbolic exponent could be either, so it is refused rather
    // than assumed: dividing by n+1 when n is -1 is a division by zero the
    // reader would never see.
    //
    // A *rational* exponent is not symbolic, and reading it as one used to
    // refuse `x^{1/2}` -- which is `√x`, and which the integrator itself
    // produces the moment anything is integrated against a square root.
    const rational = rationalOf(exponent);
    if (rational === undefined) {
      throw new IntegrationError(
        "A symbolic exponent could be -1, where the power rule does not apply, so this is not integrated."
      );
    }
    if (rational.n === -rational.d) {
      return divide(call("ln", call("abs", base)), linear.a);
    }
    const raised = rationalNode({
      n: rational.n + rational.d,
      d: rational.d,
    });
    return divide(divide(power(base, raised), raised), linear.a);
  }

  if (!baseHas && exponentHas) {
    const linear = linearIn(exponent, variable);
    if (linear === undefined) {
      throw new IntegrationError(
        "Only an exponential whose exponent is linear in the variable can be integrated here."
      );
    }
    // a^(kx+m) integrates to itself over k·ln a. For base e the logarithm is 1,
    // and writing it out would turn the familiar e^x/k into e^x/(k·ln e).
    const isE = base.type === "Identifier" && base.symbol === "e";
    const scale = isE ? linear.a : multiply(linear.a, call("ln", base));
    return divide(power(base, exponent), scale);
  }

  throw new IntegrationError(
    "An expression with the variable in both the base and the exponent cannot be integrated here."
  );
}

function functionIntegral(
  node: Aug.Latex.FunctionCall,
  variable: string
): Node {
  const name = node.callee.symbol;
  if (node.args.length !== 1) {
    throw new IntegrationError(
      `${name} takes more than one argument, so it cannot be integrated here.`
    );
  }
  const [argument] = node.args;
  const rule = FUNCTION_INTEGRALS[name];
  if (rule === undefined) {
    throw new IntegrationError(`The integral of ${name} is not known.`);
  }
  const linear = linearIn(argument, variable);
  if (linear === undefined) {
    throw new IntegrationError(
      `${name} of something that is not linear in the variable cannot be integrated here.`
    );
  }
  return divide(rule(argument), linear.a);
}

function describe(node: Node) {
  switch (node.type) {
    case "Integral":
      return "An integral";
    case "Derivative":
    case "Prime":
      return "A derivative";
    case "List":
    case "Range":
    case "ListComprehension":
      return "A list";
    case "Piecewise":
      return "A piecewise";
    case "RepeatedOperator":
      return "A sum or product";
    default:
      return `\`${node.type}\``;
  }
}
