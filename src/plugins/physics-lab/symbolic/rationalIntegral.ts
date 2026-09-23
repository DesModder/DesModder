/**
 * Integrals of one polynomial over another.
 *
 * The family that covers most of what is left once substitution has had its
 * turn, and the one where the answer depends on a *number* rather than on a
 * shape: `1/(x²+1)` is an arctangent, `1/(x²-1)` is a pair of logarithms and
 * `1/(x²+2x+1)` is a power, and the only thing that tells them apart is the
 * sign of the discriminant. No amount of pattern matching on the tree gets
 * there; it has to be worked out.
 *
 * ## What it handles
 *
 * A quotient `p(x)/q(x)` where both are polynomials in the variable and `q` has
 * degree one or two with numeric coefficients. If `p` is the bigger of the two,
 * it is divided first — `∫(x²+1)/(x+1)dx` is `∫x - 1 + 2/(x+1) dx`, which is
 * three ordinary integrals, and no rule matches it until the division is done.
 *
 * Then the quadratic, by its discriminant:
 *
 * - `D < 0`: complete the square and it is an arctangent.
 * - `D > 0`: two real roots, and the answer is a difference of logarithms —
 *   written through `2ax+b±√D` rather than through the roots themselves, so
 *   that `√D` stays a radical instead of becoming a decimal.
 * - `D = 0`: a repeated root, which is the power rule.
 *
 * A numerator of degree one is split first: `px+q` is `(p/2a)(2ax+b)` plus a
 * constant, the first part being exactly the derivative of the denominator over
 * itself, which is a logarithm.
 *
 * ## Why numeric coefficients, when the rest of this file avoids demanding them
 *
 * Because the discriminant is a *decision*, not a value to carry along. With
 * symbolic coefficients its sign is unknown, and each of the three branches
 * gives a different function; picking one would be a guess, and the guess would
 * be invisible in the answer. The symbolic case is still handled where it can
 * be — `partialFractions` in `integrate.ts` splits a denominator already
 * written as a product of linear factors, which is the form the logistic
 * equation arrives in, and that needs no discriminant at all.
 */
import {
  add,
  call,
  constantValue,
  divide,
  fold,
  id,
  multiply,
  negative,
  number,
  power,
  subtract,
  type Node,
} from "../../../symbolic";
import { coefficientsIn } from "./integrate";

/** Coefficients lowest power first, as plain numbers, or undefined. */
function numericCoefficients(
  node: Node,
  variable: string,
  maxDegree: number
): number[] | undefined {
  const symbolic = coefficientsIn(node, variable, maxDegree);
  if (symbolic === undefined) return undefined;
  const values: number[] = [];
  for (const coefficient of symbolic) {
    const value = constantValue(fold(coefficient));
    if (value === undefined || !Number.isFinite(value)) return undefined;
    values.push(value);
  }
  // A trailing zero coefficient is not a degree: `0x² + x + 1` is linear.
  while (values.length > 1 && values[values.length - 1] === 0) values.pop();
  return values;
}

/**
 * A number as a node, exactly.
 *
 * Long division produces a coefficient by dividing one integer by another, and
 * JavaScript hands back `0.5`. Emitting that as a `Constant` puts a decimal in
 * an answer that was exact a line earlier, which is the one thing this whole
 * layer refuses to do. Continued fractions recover the fraction it came from,
 * and anything that is not a small rational is left as the number it is.
 */
function exactNumber(value: number): Node {
  if (Number.isInteger(value)) return number(value);
  let denominator = 1;
  // Small denominators only: these come from dividing polynomial coefficients,
  // and a denominator this does not reach is a number nobody wrote.
  for (; denominator <= 10000; denominator += 1) {
    const scaled = value * denominator;
    if (Math.abs(scaled - Math.round(scaled)) < 1e-9)
      return divide(number(Math.round(scaled)), number(denominator));
  }
  return number(value);
}

/** A coefficient list back as an expression, lowest power first. */
function polynomialOf(coefficients: readonly number[], variable: string): Node {
  let result: Node = number(0);
  for (let degree = 0; degree < coefficients.length; degree += 1) {
    const coefficient = coefficients[degree];
    if (coefficient === 0) continue;
    const term =
      degree === 0
        ? exactNumber(coefficient)
        : multiply(
            exactNumber(coefficient),
            degree === 1 ? id(variable) : power(id(variable), number(degree))
          );
    result = add(result, term);
  }
  return fold(result);
}

/**
 * `numerator = quotient·denominator + remainder`, by ordinary long division.
 *
 * Returned as coefficient lists rather than as trees, because the caller wants
 * to ask about the remainder's degree and building a tree to take apart again
 * would be a round trip for nothing.
 */
export function dividePolynomials(
  numerator: readonly number[],
  denominator: readonly number[]
): { quotient: number[]; remainder: number[] } {
  const remainder = [...numerator];
  const degree = denominator.length - 1;
  const leading = denominator[degree];
  const quotient: number[] = new Array(
    Math.max(0, remainder.length - degree)
  ).fill(0);
  for (let i = remainder.length - 1; i >= degree; i -= 1) {
    const factor = remainder[i] / leading;
    if (factor === 0) continue;
    quotient[i - degree] = factor;
    for (let j = 0; j <= degree; j += 1) {
      remainder[i - degree + j] -= factor * denominator[j];
    }
  }
  while (
    remainder.length > 1 &&
    Math.abs(remainder[remainder.length - 1]) < 1e-12
  )
    remainder.pop();
  return { quotient, remainder };
}

/**
 * The antiderivative of `numerator / denominator`, or `undefined` when this is
 * not a rational function it recognises.
 *
 * `recurse` is the integrator itself: the pieces this produces — a polynomial
 * quotient, a proper remainder — are ordinary integrals and should be done by
 * whichever rule fits, not by a second copy of the rules living here.
 */
export function rationalIntegral(
  numerator: Node,
  denominator: Node,
  variable: string,
  recurse: (node: Node) => Node
): Node | undefined {
  const bottom = numericCoefficients(denominator, variable, 2);
  if (bottom === undefined || bottom.length < 2) return undefined;
  const top = numericCoefficients(numerator, variable, 8);
  if (top === undefined) return undefined;

  // Improper first. Nothing below can read a numerator of higher degree, and
  // the division is what turns it into something that can be.
  if (top.length >= bottom.length) {
    const { quotient, remainder } = dividePolynomials(top, bottom);
    const whole = recurse(polynomialOf(quotient, variable));
    const isZero = remainder.every((value) => value === 0);
    if (isZero) return whole;
    const rest = properIntegral(remainder, bottom, denominator, variable);
    if (rest === undefined) return undefined;
    return add(whole, rest);
  }
  return properIntegral(top, bottom, denominator, variable);
}

/**
 * The proper part: numerator of strictly lower degree than the denominator.
 *
 * `written` is the denominator as the user typed it, and it is what goes inside
 * the logarithms. Rebuilding it from its coefficients would be correct and
 * would hand back `ln|1 + x|` for an integral somebody wrote as `1/(x+1)`:
 * the same function, spelled the way an array happened to be ordered.
 *
 * Every coefficient is divided as a *node* rather than as a number, so the fold
 * reduces it exactly. `p/(2a)` worked out in JavaScript is `0.5`, and an answer
 * that reads `0.5 ln|x^2+1|` has quietly stopped being exact.
 */
function properIntegral(
  top: readonly number[],
  bottom: readonly number[],
  written: Node,
  variable: string
): Node | undefined {
  if (bottom.length === 2) {
    // c / (ax + b). A logarithm, which `integrate.ts` also reaches on its own;
    // it is here because long division hands this case back.
    const [, a] = bottom;
    const c = top[0] ?? 0;
    if (c === 0) return number(0);
    return divide(
      multiply(exactNumber(c), call("ln", call("abs", written))),
      exactNumber(a)
    );
  }

  const [c, b, a] = bottom;
  const q = top[0] ?? 0;
  const p = top[1] ?? 0;
  const base = baseQuadraticIntegral(a, b, b * b - 4 * a * c, variable);
  if (base === undefined) return undefined;

  // px + q = (p/2a)(2ax + b) + (q - pb/2a), and the first part is the
  // denominator's own derivative over itself.
  const logarithmic =
    p === 0
      ? undefined
      : multiply(
          divide(exactNumber(p), exactNumber(2 * a)),
          call("ln", call("abs", written))
        );
  const constantPart =
    q * 2 * a === p * b
      ? undefined
      : multiply(
          subtract(
            exactNumber(q),
            divide(exactNumber(p * b), exactNumber(2 * a))
          ),
          base
        );

  if (logarithmic === undefined && constantPart === undefined) return number(0);
  if (logarithmic === undefined) return constantPart!;
  if (constantPart === undefined) return logarithmic;
  return add(logarithmic, constantPart);
}

/**
 * The integral of one over the quadratic, by the sign of the discriminant.
 *
 * Written by completing the square rather than in terms of `2ax + b`. Both are
 * correct and the second is shorter to derive; the first is the one that comes
 * out looking like the answer in the book. The integral of `1/(x^2+4)` is
 * `arctan(x/2)/2`, and through `2ax+b` it arrives as `2 arctan(2x/4) / 4`:
 * the same number, four times over, none of which reduces.
 *
 * `shifted` is the variable measured from the vertex and `spread` is the half
 * width. Both are built as nodes so that a discriminant which is a perfect
 * square reduces to an integer instead of staying under a radical, and one
 * which is not stays under it instead of becoming a decimal.
 */
function baseQuadraticIntegral(
  a: number,
  b: number,
  discriminant: number,
  variable: string
): Node | undefined {
  if (a === 0) return undefined;
  const shifted = add(id(variable), divide(exactNumber(b), exactNumber(2 * a)));
  if (discriminant === 0) {
    return negative(divide(number(1), multiply(exactNumber(a), shifted)));
  }
  const spread = divide(
    call("sqrt", exactNumber(Math.abs(discriminant))),
    exactNumber(2 * a)
  );
  if (discriminant < 0) {
    return divide(
      call("arctan", divide(shifted, spread)),
      multiply(exactNumber(a), spread)
    );
  }
  return divide(
    call(
      "ln",
      call("abs", divide(subtract(shifted, spread), add(shifted, spread)))
    ),
    multiply(exactNumber(2 * a), spread)
  );
}
