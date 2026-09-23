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
import { expand, fold } from "../../../symbolic";
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
  // ∫sec²  and ∫csc² are the two that come up, and they arrive as powers
  // rather than as calls, so they are handled in the exponent rule.
  sec: (u) => call("ln", call("abs", add(call("sec", u), call("tan", u)))),
  tan: (u) => negative(call("ln", call("abs", call("cos", u)))),
  sinh: (u) => call("cosh", u),
  cosh: (u) => call("sinh", u),
  sqrt: (u) =>
    divide(
      multiply(number(2), power(u, divide(number(3), number(2)))),
      number(3)
    ),
};

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
  if (sameTree(opened, folded)) {
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

function antiderivative(node: Node, variable: string): Node {
  // Anything free of the variable is a constant, and integrates to c·x.
  if (!dependsOn(node, variable)) return multiply(node, id(variable));

  switch (node.type) {
    case "Identifier":
      // The variable itself.
      return divide(power(id(variable), number(2)), number(2));
    case "Negative":
      return negative(antiderivative(node.arg, variable));
    case "BinaryOperator":
      return binaryIntegral(node, variable);
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
  variable: string
): Node {
  const { left, right } = node;
  switch (node.name) {
    case "Add":
      return add(
        antiderivative(left, variable),
        antiderivative(right, variable)
      );
    case "Subtract":
      return subtract(
        antiderivative(left, variable),
        antiderivative(right, variable)
      );
    case "Multiply":
    case "CrossMultiply": {
      // A constant factor comes out. Two factors that both carry the variable
      // would need parts or a substitution, and there is no rule here that
      // chooses between them.
      const leftHas = dependsOn(left, variable);
      const rightHas = dependsOn(right, variable);
      if (leftHas && rightHas) {
        return byParts(left, right, variable);
      }
      return leftHas
        ? multiply(right, antiderivative(left, variable))
        : multiply(left, antiderivative(right, variable));
    }
    case "Divide": {
      if (!dependsOn(right, variable)) {
        // A constant denominator is a constant factor.
        return divide(antiderivative(left, variable), right);
      }
      if (dependsOn(left, variable)) {
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
          variable
        );
      }
      // c / (L₁·L₂), two factors each linear in the variable: partial
      // fractions. This is the logistic equation and nothing else — separating
      // dy/dx = ky(1 - y/M) asks for exactly ∫dy/(y(1-y/M)), and without this
      // the equation on the BC syllabus is refused.
      const split = partialFractions(right, variable);
      if (split !== undefined) return multiply(left, split);

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
      return exponentIntegral(left, right, variable);
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
function byParts(left: Node, right: Node, variable: string): Node {
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

  if (degree === undefined || degree > MAX_PARTS_DEGREE) {
    throw new IntegrationError(
      "A product of two expressions that both contain the variable needs integration by parts, and neither factor is a polynomial this can reduce."
    );
  }

  const restIntegral = antiderivative(rest, variable);
  const derivative = polynomialDerivative(polynomial, variable);
  // The remaining integral has a polynomial one degree lower, so this bottoms
  // out at a constant, whose derivative is zero and whose term vanishes.
  if (isZeroConstant(derivative)) return multiply(polynomial, restIntegral);
  return subtract(
    multiply(polynomial, restIntegral),
    antiderivative(fold(multiply(derivative, restIntegral)), variable)
  );
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
function exponentIntegral(base: Node, exponent: Node, variable: string): Node {
  const baseHas = dependsOn(base, variable);
  const exponentHas = dependsOn(exponent, variable);

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
    if (exponent.type !== "Constant") {
      throw new IntegrationError(
        "A symbolic exponent could be -1, where the power rule does not apply, so this is not integrated."
      );
    }
    if (exponent.value === -1) {
      return divide(call("ln", call("abs", base)), linear.a);
    }
    const raised = number(exponent.value + 1);
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
