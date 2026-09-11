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
import { Aug, AugBuilders } from "../../../../text-mode-core";

const { number, binop, functionCall, id, negative } = AugBuilders;

type Node = Aug.Latex.AnyChild;

/** Thrown for anything this cannot integrate exactly. */
export class IntegrationError extends Error {}

const add = (a: Node, b: Node) => binop("Add", a, b);
const subtract = (a: Node, b: Node) => binop("Subtract", a, b);
const multiply = (a: Node, b: Node) => binop("Multiply", a, b);
const divide = (a: Node, b: Node) => binop("Divide", a, b);
const power = (a: Node, b: Node) => binop("Exponent", a, b);
const call = (name: string, arg: Node) => functionCall(id(name), [arg]);

/** Whether `variable` appears anywhere in the tree. */
export function dependsOn(node: Node, variable: string): boolean {
  let found = false;
  visit(node, (child) => {
    if (child.type === "Identifier" && child.symbol === variable) found = true;
  });
  return found;
}

export function visit(node: Node, callback: (node: Node) => void) {
  callback(node);
  for (const value of Object.values(
    node as unknown as Record<string, unknown>
  )) {
    if (Array.isArray(value)) {
      for (const child of value) if (isNode(child)) visit(child, callback);
    } else if (isNode(value)) {
      visit(value, callback);
    }
  }
}

function isNode(value: unknown): value is Node {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { type?: unknown }).type === "string"
  );
}

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
    : { a: simplify(found.a), b: simplify(found.b) };
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
  return simplify(antiderivative(simplify(node), variable));
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

  const cross = simplify(
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
    antiderivative(simplify(multiply(derivative, restIntegral)), variable)
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

/**
 * Splits a leading numeric coefficient off a term: `2x` becomes `[2, x]`, and
 * anything without one becomes `[1, itself]`.
 *
 * A bare constant reports its own value against a remainder of 1, so two
 * constants collect the same way two multiples of x do.
 */
function splitCoefficient(node: Node): [number, Node] {
  if (node.type === "Constant") return [node.value, number(1)];
  if (node.type === "Negative") {
    const [factor, rest] = splitCoefficient(node.arg);
    return [-factor, rest];
  }
  if (
    node.type === "BinaryOperator" &&
    (node.name === "Multiply" || node.name === "CrossMultiply")
  ) {
    const factor = constantValue(node.left);
    if (factor !== undefined) return [factor, node.right];
  }
  return [1, node];
}

/** Structural equality, which is all that is needed to spot a shared base. */
function sameTree(a: Node, b: Node) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Every factor of a product or quotient, flattened, each marked with the side
 * of the bar it was on.
 *
 * Division has to be walked as well as multiplication. The integrating factor
 * meets its opposite through a fraction far more often than beside it —
 * `e^{3x}·(x·e^{-3x}/-3)` is what solving `dy/dx = x + 3y` produces, and a
 * flattener that stopped at the fraction would leave the two exponentials in
 * plain sight and never cancel them.
 */
function quotientFactors(
  node: Node,
  inNumerator: boolean,
  out: { node: Node; inNumerator: boolean }[]
) {
  if (node.type === "BinaryOperator") {
    if (node.name === "Multiply" || node.name === "CrossMultiply") {
      quotientFactors(node.left, inNumerator, out);
      quotientFactors(node.right, inNumerator, out);
      return;
    }
    if (node.name === "Divide") {
      quotientFactors(node.left, inNumerator, out);
      quotientFactors(node.right, !inNumerator, out);
      return;
    }
  }
  if (node.type === "Negative") {
    // A sign is a factor of -1, and leaving it wrapped round the term would
    // hide every exponential inside it from the fold. `e^{3x}·-(e^{-3x}/3)/3`
    // is what the integrating factor produces, and the two exponentials only
    // meet once the minus stops being a lid on one of them.
    out.push({ node: number(-1), inNumerator });
    quotientFactors(node.arg, inNumerator, out);
    return;
  }
  out.push({ node, inNumerator });
}

/**
 * Folds powers of a shared base within one product: `e^{-x}·x·e^{x}` is `x`.
 *
 * The integrating factor makes this unavoidable. Solving a linear equation
 * multiplies by `e^{-∫a}` and then by `e^{∫a}` again, and without folding the
 * two the answer to `dy/dx = x - y` reads `e^{-x}(xe^{x}-e^{x}+C)` rather than
 * `x-1+Ce^{-x}` — the same function, and not the one in any answer key.
 *
 * Factors are flattened first because the two powers are rarely adjacent: they
 * arrive on opposite sides of whatever the polynomial part turned out to be.
 */
function foldSharedBases(node: Aug.Latex.BinaryOperator): Node | undefined {
  const entries: { node: Node; inNumerator: boolean }[] = [];
  quotientFactors(node, true, entries);
  if (entries.length < 2) return undefined;

  // Exponents accumulate per base, counting a factor below the bar as negative
  // — which is what makes a fraction cancel against a factor above it.
  const powers: { base: Node; exponent: Node }[] = [];
  const others: { node: Node; inNumerator: boolean }[] = [];
  let folded = false;
  for (const entry of entries) {
    const { node: factor, inNumerator } = entry;
    // Every factor is a power: one without an exponent has an exponent of 1.
    // Reading them that way is what lets `(x+1)(x+1)` become `(x+1)^2`, which
    // the power rule can then integrate — the alternative is refusing a
    // repeated factor that partial fractions has already, correctly, declined.
    const isPower =
      factor.type === "BinaryOperator" && factor.name === "Exponent";
    const base = isPower ? factor.left : factor;
    const exponent = isPower ? factor.right : number(1);
    // A number is a coefficient rather than a base worth collecting; folding
    // `2·2` into `2^2` is arithmetic the constant rules already do better.
    if (base.type === "Constant") {
      others.push(entry);
      continue;
    }
    const contribution = inNumerator ? exponent : negative(exponent);
    const match = powers.findIndex((existing) => sameTree(existing.base, base));
    if (match >= 0) {
      powers[match] = {
        base: powers[match].base,
        exponent: binop("Add", powers[match].exponent, contribution),
      };
      folded = true;
    } else {
      powers.push({ base, exponent: contribution });
    }
  }
  if (!folded) return undefined;

  // Rebuilt with plain nodes rather than by simplifying each pair. Every nested
  // `simplify` on a product re-enters this function, which re-flattens the
  // whole thing from scratch, so folding pair by pair costs progressively more
  // work at each level. The caller simplifies the result once instead, and that
  // pass finds no shared base left to fold, so it terminates.
  let numerator: Node = number(1);
  let denominator: Node = number(1);
  for (const { base, exponent } of powers)
    numerator = binop("Multiply", numerator, binop("Exponent", base, exponent));
  for (const { node: factor, inNumerator } of others) {
    if (inNumerator) numerator = binop("Multiply", numerator, factor);
    else denominator = binop("Multiply", denominator, factor);
  }
  return binop("Divide", numerator, denominator);
}

/**
 * Removes factors that appear on both sides of a fraction.
 *
 * The logistic equation's carrying capacity is what needs this. Reading
 * `ky(1 - y/M)` gives a linear coefficient of `k` and a quadratic one of
 * `-k/M`, so the capacity `-linear/quadratic` arrives as `-k / -(k·(1/M))` —
 * which is M, and reads as nothing at all. Cancelling the `-1` and the `k`
 * leaves the answer the question was asking for.
 *
 * Worth stating plainly: cancelling `k` from both sides assumes `k` is not
 * zero. That is the ordinary convention for a symbolic simplifier, and here it
 * is additionally safe in the only way that matters — the result is checked
 * numerically against the original equation before anybody sees it, at
 * parameter values that are not zero.
 */
function cancelCommonFactors(node: Aug.Latex.BinaryOperator): Node | undefined {
  const entries: { node: Node; inNumerator: boolean }[] = [];
  quotientFactors(node, true, entries);
  const numerator = entries.filter((e) => e.inNumerator).map((e) => e.node);
  const denominator = entries.filter((e) => !e.inNumerator).map((e) => e.node);
  if (numerator.length === 0 || denominator.length === 0) return undefined;

  let cancelled = false;
  for (let i = numerator.length - 1; i >= 0; i--) {
    const match = denominator.findIndex((d) => sameTree(d, numerator[i]));
    if (match < 0) continue;
    numerator.splice(i, 1);
    denominator.splice(match, 1);
    cancelled = true;
  }
  if (!cancelled) return undefined;

  // Plain nodes, simplified once by the caller — the same reason foldSharedBases
  // does not simplify pair by pair.
  const product = (factors: Node[]) =>
    factors.length === 0
      ? (number(1) as Node)
      : factors.reduce((a, b) => binop("Multiply", a, b));
  return denominator.length === 0
    ? product(numerator)
    : binop("Divide", product(numerator), product(denominator));
}

function isZeroConstant(node: Node) {
  const simplified = simplify(node);
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

/**
 * Folds the arithmetic that the rules above produce in bulk.
 *
 * Without it `∫2x dx` comes out as `2·(x²/2)` rather than `x²`, which is
 * correct and is not what anybody writes. This is the same fold Vector Tools'
 * differentiator uses, for the same reason.
 */
export function simplify(node: Node): Node {
  switch (node.type) {
    case "Negative": {
      const arg = simplify(node.arg);
      if (arg.type === "Constant") return number(-arg.value);
      if (arg.type === "Negative") return arg.arg;
      // A sign in front of a product with a numeric coefficient belongs on the
      // coefficient: `-(2x)` is written `-2x`, and the bracket the emitter puts
      // round the product otherwise is pure noise.
      if (
        arg.type === "BinaryOperator" &&
        (arg.name === "Multiply" || arg.name === "CrossMultiply")
      ) {
        const coefficient = constantValue(arg.left);
        if (coefficient !== undefined)
          return simplify(binop("Multiply", number(-coefficient), arg.right));
      }
      return negative(arg);
    }
    case "FunctionCall": {
      const args = node.args.map(simplify);
      const folded = foldKnownValue(node.callee.symbol, args);
      return folded ?? { ...node, args };
    }
    case "BinaryOperator":
      return simplifyBinary(node);
    default:
      return node;
  }
}

function simplifyBinary(node: Aug.Latex.BinaryOperator): Node {
  const left = simplify(node.left);
  const right = simplify(node.right);
  const lc = constantValue(left);
  const rc = constantValue(right);

  // Signs are hoisted out of products and folded through sums, so parts
  // produces `-x·cos(x) + sin(x)` rather than the literally correct
  // `x·-cos(x) - -sin(x)`. Each rewrite removes a Negative from below the
  // operator, so re-simplifying terminates.
  if (
    (node.name === "Multiply" || node.name === "CrossMultiply") &&
    (left.type === "Negative" || right.type === "Negative")
  ) {
    const bareLeft = left.type === "Negative" ? left.arg : left;
    const bareRight = right.type === "Negative" ? right.arg : right;
    const product = simplify(binop("Multiply", bareLeft, bareRight));
    // Two negatives cancel; one survives as the sign of the whole product.
    return left.type === "Negative" && right.type === "Negative"
      ? product
      : simplify(negative(product));
  }
  if (node.name === "Add" && right.type === "Negative")
    return simplify(binop("Subtract", left, right.arg));
  // A negative on the left of a sum is a subtraction the other way round, which
  // is also how `-x+x` gets to `x-x` and from there to zero.
  if (node.name === "Add" && left.type === "Negative")
    return simplify(binop("Subtract", right, left.arg));
  if (node.name === "Subtract" && right.type === "Negative")
    return simplify(binop("Add", left, right.arg));

  if (node.name === "Multiply" || node.name === "CrossMultiply") {
    const shared = foldSharedBases(binop("Multiply", left, right));
    if (shared !== undefined) return simplify(shared);
  }

  if (node.name === "Divide") {
    const cancelled = cancelCommonFactors(binop("Divide", left, right));
    if (cancelled !== undefined) return simplify(cancelled);
  }

  switch (node.name) {
    case "Add":
      if (lc === 0) return right;
      if (rc === 0) return left;
      if (lc !== undefined && rc !== undefined) return number(lc + rc);
      break;
    case "Subtract":
      if (rc === 0) return left;
      if (lc === 0) return simplify(negative(right));
      if (lc !== undefined && rc !== undefined) return number(lc - rc);
      // Anything minus itself is zero, and the integrating factor produces
      // exactly that in an exponent: folding e^{-x}·e^{x} leaves e^{-x--x},
      // which has to reach e^{0} before it can become 1.
      if (sameTree(left, right)) return number(0);
      break;
  }

  // Two fractions add, subtract and multiply exactly, without either of them
  // becoming a decimal on the way. The power rule needs this: differentiating
  // `x^{1/2}` lowers the exponent by one, and unfolded that reads `x^{1/2-1}`.
  if (
    node.name === "Add" ||
    node.name === "Subtract" ||
    node.name === "Multiply"
  ) {
    const a = rationalOf(left);
    const b = rationalOf(right);
    if (a !== undefined && b !== undefined) {
      if (node.name === "Multiply")
        return rationalNode({ n: a.n * b.n, d: a.d * b.d });
      const sign = node.name === "Add" ? 1 : -1;
      return rationalNode({
        n: a.n * b.d + sign * b.n * a.d,
        d: a.d * b.d,
      });
    }
  }

  // Like terms are collected, which is what actually cancels the exponent the
  // integrating factor leaves behind. `3x + -3x` has no `Negative` node in it
  // once the sign has been folded into the coefficient, so matching whole trees
  // is not enough — the coefficients have to be added.
  if (node.name === "Add" || node.name === "Subtract") {
    const [leftFactor, leftRest] = splitCoefficient(left);
    const [rightFactor, rightRest] = splitCoefficient(right);
    if (sameTree(leftRest, rightRest)) {
      const combined =
        node.name === "Add"
          ? leftFactor + rightFactor
          : leftFactor - rightFactor;
      return simplify(binop("Multiply", number(combined), leftRest));
    }
  }

  switch (node.name) {
    case "Multiply":
    case "CrossMultiply": {
      if (lc === 0 || rc === 0) return number(0);
      if (lc === 1) return right;
      if (rc === 1) return left;
      // A coefficient of -1 is a sign, not a factor. `-1x` is how the power
      // rule spells a negation, and it reads as a typo.
      if (lc === -1) return simplify(negative(right));
      if (rc === -1) return simplify(negative(left));
      if (lc !== undefined && rc !== undefined) return number(lc * rc);
      // A coefficient buried on the right comes to the front: `x²·(3cos 3x)` is
      // written `3x²cos 3x`. The chain rule produces exactly that shape — the
      // inner derivative arrives as a factor after the outer one — and left
      // alone the answer carries a bracket around a number.
      if (
        lc === undefined &&
        right.type === "BinaryOperator" &&
        (right.name === "Multiply" || right.name === "CrossMultiply") &&
        constantValue(right.left) !== undefined
      ) {
        // Left-nested deliberately. The Aug emitter brackets a product that
        // hangs off the right of another, so `3·(x²cos 3x)` prints with the
        // bracket still in it; `(3·x²)·cos 3x` prints as `3x²cos 3x`.
        return simplify(
          binop("Multiply", binop("Multiply", right.left, left), right.right)
        );
      }
      // `3·(2x)` is `6x`. Multiplication associates, and the constant multiple
      // rule produces exactly this shape whenever a coefficient meets the power
      // rule — which is most of the derivatives anybody takes.
      if (
        lc !== undefined &&
        right.type === "BinaryOperator" &&
        (right.name === "Multiply" || right.name === "CrossMultiply")
      ) {
        const inner = constantValue(right.left);
        if (inner !== undefined)
          return simplify(binop("Multiply", number(lc * inner), right.right));
      }
      // c · (d/e) folds to (cd)/e, which is what turns 2·(x²/2) into x².
      if (
        lc !== undefined &&
        right.type === "BinaryOperator" &&
        right.name === "Divide"
      ) {
        return simplify(
          binop("Divide", binop("Multiply", left, right.left), right.right)
        );
      }
      if (rc !== undefined && lc === undefined)
        return binop("Multiply", right, left);
      break;
    }
    case "Divide": {
      if (lc === 0) return number(0);
      if (rc === 1) return left;
      // Dividing by -1 is negating, and the reciprocal rule above hands this
      // one over constantly.
      if (rc === -1) return simplify(negative(left));
      // A negative on either side of the bar belongs in front of the fraction.
      // `x/-3` and `-1/9` are both correct and neither is how it is written.
      if (rc !== undefined && rc < 0)
        return simplify(negative(binop("Divide", left, number(-rc))));
      if (lc !== undefined && lc < 0)
        return simplify(negative(binop("Divide", number(-lc), right)));
      // A quotient of two numbers folds only when it comes out whole. `1/2`
      // stays the fraction it was written as, because a decimal is the one
      // thing an exact answer must not quietly become.
      if (
        lc !== undefined &&
        rc !== undefined &&
        rc !== 0 &&
        Number.isInteger(lc / rc)
      )
        return number(lc / rc);
      // A numeric factor above the line cancels against one below it, which is
      // what turns the power rule's own 3x^3/3 back into x^3. Without this every
      // answer carries the arithmetic that produced it.
      if (
        rc !== undefined &&
        rc !== 0 &&
        left.type === "BinaryOperator" &&
        (left.name === "Multiply" || left.name === "CrossMultiply")
      ) {
        const factor = constantValue(left.left);
        // Only when it divides exactly. Folding 3x²/2 into 1.5x² trades a
        // fraction anyone can read for a decimal, and this is the one pipeline
        // in the plugin whose whole purpose is keeping values exact.
        if (factor !== undefined && Number.isInteger(factor / rc))
          return simplify(binop("Multiply", number(factor / rc), left.right));
      }
      // (a/b)/c folds to a/(bc), so a linear argument's 1/a factor does not
      // leave a stack of fractions behind it.
      if (
        left.type === "BinaryOperator" &&
        left.name === "Divide" &&
        rc !== undefined
      ) {
        const inner = constantValue(left.right);
        if (inner !== undefined)
          return simplify(binop("Divide", left.left, number(inner * rc)));
      }
      break;
    }
    case "Exponent":
      if (rc === 1) return left;
      if (rc === 0) return number(1);
      // A negative power is written as a fraction. `y^{-1}` is a correct answer
      // to ∫dy/y² and `-1/y` is the one in the book, and the power rule
      // produces the former on every separable problem with a power of y in it.
      if (rc !== undefined && Number.isInteger(rc) && rc < 0)
        return simplify(
          binop("Divide", number(1), binop("Exponent", left, number(-rc)))
        );
      // Same rule for powers: 2^{1/2} is not 1.4142135623730951.
      if (lc !== undefined && rc !== undefined && Number.isInteger(lc ** rc))
        return number(lc ** rc);
      break;
  }
  return node.name === "CrossMultiply"
    ? { ...node, left, right }
    : binop(node.name, left, right);
}

/**
 * The exact value of a known function at a known argument, where there is one.
 *
 * Only the values that are exactly representable — no decimals sneak in, so
 * `sin(1)` is left alone while `sin(0)` becomes 0. That is a narrow table on
 * purpose, and it earns its place because of where these arise: an initial
 * condition is almost always given at x = 0, and substituting it produces
 * `\sin(0)`, `\cos(0)` and `e^{0}` in every solution that has a trig term or an
 * exponential in it. Left unfolded, the constant a student is supposed to read
 * off comes out as `C = \pi - \sin(0)`.
 */
function foldKnownValue(name: string, args: Node[]): Node | undefined {
  if (args.length !== 1) return undefined;
  const argument = constantValue(args[0]);
  if (argument === undefined) return undefined;
  switch (name) {
    case "sin":
    case "tan":
    case "sinh":
    case "tanh":
      return argument === 0 ? number(0) : undefined;
    case "cos":
    case "cosh":
      return argument === 0 ? number(1) : undefined;
    case "exp":
      return argument === 0 ? number(1) : undefined;
    case "ln":
      return argument === 1 ? number(0) : undefined;
    case "log":
      return argument === 1 ? number(0) : undefined;
    case "abs":
      return number(Math.abs(argument));
    case "sign":
      return number(Math.sign(argument));
    case "sqrt": {
      // Only a perfect square, so no irrational is turned into a decimal.
      const root = Math.sqrt(argument);
      return Number.isInteger(root) ? number(root) : undefined;
    }
    default:
      return undefined;
  }
}

/**
 * A node as an exact rational, where it is one.
 *
 * `constantValue` only sees a plain number, which is why `\frac{1}{2} - 1` used
 * to survive simplification untouched: a fraction of two integers is a Divide
 * node, not a Constant, so neither side folded and the power rule produced
 * `x^{1/2 - 1}`. Reading fractions as well means the arithmetic happens without
 * ever passing through a decimal.
 */
function rationalOf(node: Node): { n: number; d: number } | undefined {
  if (node.type === "Constant")
    return Number.isInteger(node.value) ? { n: node.value, d: 1 } : undefined;
  if (node.type === "Negative") {
    const inner = rationalOf(node.arg);
    return inner === undefined ? undefined : { n: -inner.n, d: inner.d };
  }
  if (node.type === "BinaryOperator" && node.name === "Divide") {
    const top = rationalOf(node.left);
    const bottom = rationalOf(node.right);
    if (top === undefined || bottom === undefined || bottom.n === 0)
      return undefined;
    return { n: top.n * bottom.d, d: top.d * bottom.n };
  }
  return undefined;
}

/** A rational back as a node: an integer where it is one, a fraction otherwise. */
function rationalNode(value: { n: number; d: number }): Node {
  let { n, d } = value;
  if (d < 0) {
    n = -n;
    d = -d;
  }
  const divisor = greatestCommonDivisor(Math.abs(n), d);
  if (divisor > 1) {
    n /= divisor;
    d /= divisor;
  }
  if (d === 1) return number(n);
  return n < 0
    ? negative(binop("Divide", number(-n), number(d)))
    : binop("Divide", number(n), number(d));
}

function greatestCommonDivisor(a: number, b: number): number {
  while (b !== 0) [a, b] = [b, a % b];
  return a;
}

function constantValue(node: Node): number | undefined {
  if (node.type === "Constant") return node.value;
  if (node.type === "Negative") {
    const inner = constantValue(node.arg);
    return inner === undefined ? undefined : -inner;
  }
  return undefined;
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
