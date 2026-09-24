/**
 * Products and powers of trigonometric functions, rewritten into something the
 * rest of the integrator can already do.
 *
 * Nothing here integrates anything. Every rewrite is an identity, and what it
 * produces is handed straight back to the integrator, which finishes it with a
 * substitution or the power rule. That is the whole design: `∫sin⁴x dx`,
 * `∫tan⁴x dx`, `∫sec⁴x dx` and `∫sin²x cos³x dx` look like four different
 * problems and are four applications of three identities.
 *
 * ## Everything is sine and cosine
 *
 * The six functions are read as one pair of exponents. `tan` is `sin¹cos⁻¹`,
 * `sec` is `cos⁻¹`, a factor under a fraction bar is a negative exponent, and
 * after that every product of trigonometric functions of the same angle is
 * `sin^p cos^q` for two integers. Four cases cover all of them:
 *
 * - **An odd positive power of one of them.** Peel one factor off, write the
 *   rest through `sin² = 1 - cos²`, and the substitution search finds the rest.
 *   `sin²x cos³x` is `sin²x (1 - sin²x) cos x`, and `u = sin x` finishes it.
 * - **Both even and non-negative.** The half-angle identities halve both
 *   powers, and the recursion terminates because they halve again.
 * - **A secant form**, meaning a non-negative even power of sine against a
 *   negative one of cosine. One `sec²` is kept back to be `du`, the rest goes
 *   through `sec² = 1 + tan²`, and `u = tan x` finishes it.
 * - **A pure tangent or cotangent.** `tan^n = tan^{n-2}sec² - tan^{n-2}`, which
 *   is the reduction formula written as a rewrite: the first term substitutes
 *   and the second is the same problem two powers smaller.
 *
 * ## Different angles
 *
 * `sin(3x)cos(2x)` is not a power of anything; it is a product of two waves,
 * and the identity that opens it is the product-to-sum one. That gets its own
 * rewrite at the bottom, because it is the one case where the two arguments
 * are allowed to differ.
 */
import {
  add,
  call,
  constantValue,
  dependsOn,
  divide,
  fold,
  multiply,
  number,
  power,
  quotientFactors,
  sameTree,
  subtract,
  type Node,
} from "../../../symbolic";

/**
 * An integrand read as `c · rest · sin(u)^p · cos(u)^q`.
 *
 * `rest` is whatever else depends on the variable. Carrying it rather than
 * refusing it is what lets `e^x sin x cos x` be rewritten: the identity applies
 * to the trigonometric part and the exponential comes along untouched, which is
 * still an identity on the whole product.
 */
interface SinCosPowers {
  coefficient: Node;
  rest: Node;
  argument: Node;
  p: number;
  q: number;
}

/** How the six functions are spelled as powers of sine and cosine. */
const AS_POWERS: Record<string, { p: number; q: number }> = {
  sin: { p: 1, q: 0 },
  cos: { p: 0, q: 1 },
  tan: { p: 1, q: -1 },
  cot: { p: -1, q: 1 },
  sec: { p: 0, q: -1 },
  csc: { p: -1, q: 0 },
};

/** Beyond this the rewrite produces more terms than anybody wants to read. */
const MAX_POWER = 10;

/**
 * `node` rewritten into a form the integrator can finish, or `undefined` if it
 * is not a product of trigonometric functions at all.
 */
export function trigRewrite(node: Node, variable: string): Node | undefined {
  const parsed = readSinCosPowers(node, variable);
  if (parsed === undefined) return productToSum(node, variable);
  const { coefficient, rest, argument, p, q } = parsed;
  if (p === 0 && q === 0) return undefined;
  if (Math.abs(p) > MAX_POWER || Math.abs(q) > MAX_POWER) return undefined;

  const sin = call("sin", argument);
  const cos = call("cos", argument);
  const tan = call("tan", argument);
  const sec = call("sec", argument);
  const csc = call("csc", argument);
  const cot = call("cot", argument);
  const scaled = (inner: Node) =>
    fold(multiply(multiply(coefficient, rest), inner));
  const one = number(1);

  // `sin u cos u` is `sin(2u)/2`. Every other rule here would hand it back
  // unchanged -- an odd power of one against an odd power of the other peels a
  // factor off and puts it straight back -- and the doubled angle is what
  // turns `e^x sin x cos x` into a cyclic pair.
  if (p === 1 && q === 1) {
    return scaled(
      divide(call("sin", multiply(number(2), argument)), number(2))
    );
  }

  // An odd positive power of either one: peel a factor off to be `du` and
  // write what is left through the Pythagorean identity.
  if (p > 0 && p % 2 === 1) {
    return scaled(
      multiply(
        multiply(
          power(subtract(one, power(cos, number(2))), number((p - 1) / 2)),
          power(cos, number(q))
        ),
        sin
      )
    );
  }
  if (q > 0 && q % 2 === 1) {
    return scaled(
      multiply(
        multiply(
          power(subtract(one, power(sin, number(2))), number((q - 1) / 2)),
          power(sin, number(p))
        ),
        cos
      )
    );
  }

  // A pure tangent or cotangent, where the reduction formula is the only way
  // down and both of its pieces are ordinary.
  if (q === -p && p >= 2) {
    return scaled(
      subtract(
        multiply(power(tan, number(p - 2)), power(sec, number(2))),
        power(tan, number(p - 2))
      )
    );
  }
  if (p === -q && q >= 2) {
    return scaled(
      subtract(
        multiply(power(cot, number(q - 2)), power(csc, number(2))),
        power(cot, number(q - 2))
      )
    );
  }

  // A secant form: keep one `sec²` back to be `du` and write the rest in
  // tangents. The same, mirrored, for cosecants.
  if (p >= 0 && p % 2 === 0 && p + q <= -2 && (p + q) % 2 === 0) {
    const spare = (-(p + q) - 2) / 2;
    return scaled(
      multiply(
        multiply(
          power(tan, number(p)),
          power(add(one, power(tan, number(2))), number(spare))
        ),
        power(sec, number(2))
      )
    );
  }
  if (q >= 0 && q % 2 === 0 && p + q <= -2 && (p + q) % 2 === 0) {
    const spare = (-(p + q) - 2) / 2;
    return scaled(
      multiply(
        multiply(
          power(cot, number(q)),
          power(add(one, power(cot, number(2))), number(spare))
        ),
        power(csc, number(2))
      )
    );
  }

  // An even power of sine over an odd power of cosine, which is the family
  // `tan^2 sec` belongs to. Writing the sines through `1 - cos^2` and
  // multiplying out leaves a sum of odd powers of secant, each of which has a
  // rule -- `tan^2 sec` is `sec^3 - sec`, and that is the whole of it.
  if (p > 0 && p % 2 === 0 && q < 0 && Math.abs(q % 2) === 1) {
    return scaled(binomialInReciprocal(p / 2, -q, sec));
  }
  if (q > 0 && q % 2 === 0 && p < 0 && Math.abs(p % 2) === 1) {
    return scaled(binomialInReciprocal(q / 2, -p, csc));
  }

  // Both even and non-negative: the half-angle identities, which halve both
  // powers and leave a polynomial in the doubled angle.
  if (p >= 0 && q >= 0 && p % 2 === 0 && q % 2 === 0 && p + q >= 2) {
    const doubled = call("cos", multiply(number(2), argument));
    const sinSquared = divide(subtract(one, doubled), number(2));
    const cosSquared = divide(add(one, doubled), number(2));
    return scaled(
      multiply(
        power(sinSquared, number(p / 2)),
        power(cosSquared, number(q / 2))
      )
    );
  }

  return undefined;
}

/**
 * `(1 - cos²)^k · cos^{-m}` written out as a sum of powers of secant.
 *
 * Multiplied out here rather than left for the expander, because the expander
 * works on the tree and the cancellation this needs is an identity it does not
 * know: `cos² · sec³` is `sec`, and nothing in the fold says that `sec` and
 * `cos` are reciprocals. Writing the binomial in one direction from the start
 * avoids ever needing to.
 *
 * Every term comes out as an odd power of secant, which is what makes this
 * worth doing: `tan² sec` becomes `sec³ - sec`, and both of those have rules.
 */
function binomialInReciprocal(k: number, m: number, reciprocal: Node): Node {
  let total: Node | undefined;
  let coefficient = 1;
  for (let j = 0; j <= k; j += 1) {
    const term = multiply(
      number(Math.abs(coefficient)),
      power(reciprocal, number(m - 2 * j))
    );
    const signed: Node = j % 2 === 0 ? term : { type: "Negative", arg: term };
    total = total === undefined ? signed : add(total, signed);
    // The next binomial coefficient, by the usual step.
    coefficient = (coefficient * (k - j)) / (j + 1);
  }
  return total ?? number(1);
}

/** The integrand as one coefficient and two exponents, or `undefined`. */
function readSinCosPowers(
  node: Node,
  variable: string
): SinCosPowers | undefined {
  const factors: { node: Node; inNumerator: boolean }[] = [];
  quotientFactors(node, true, factors);

  let coefficient: Node = number(1);
  let rest: Node = number(1);
  let argument: Node | undefined;
  let p = 0;
  let q = 0;
  let found = false;

  for (const { node: factor, inNumerator } of factors) {
    if (!dependsOn(factor, variable)) {
      coefficient = inNumerator
        ? multiply(coefficient, factor)
        : divide(coefficient, factor);
      continue;
    }
    const isPower =
      factor.type === "BinaryOperator" && factor.name === "Exponent";
    const base = isPower ? factor.left : factor;
    const rawExponent = isPower ? constantValue(fold(factor.right)) : 1;
    const isCall = base.type === "FunctionCall" && base.args.length === 1;
    const spelling = isCall ? AS_POWERS[base.callee.symbol] : undefined;
    if (
      !isCall ||
      spelling === undefined ||
      rawExponent === undefined ||
      !Number.isInteger(rawExponent)
    ) {
      // Not trigonometric. Carried along rather than refused; see `rest`.
      rest = inNumerator ? multiply(rest, factor) : divide(rest, factor);
      continue;
    }
    const [inside] = base.args;
    // Every factor has to be a function of the *same* angle, or this is a
    // product of two waves rather than a power of one.
    if (argument === undefined) argument = inside;
    else if (!sameTree(argument, inside)) return undefined;

    const exponent = (inNumerator ? 1 : -1) * rawExponent;
    p += spelling.p * exponent;
    q += spelling.q * exponent;
    found = true;
  }

  if (!found || argument === undefined) return undefined;
  return { coefficient: fold(coefficient), rest: fold(rest), argument, p, q };
}

/**
 * `sin(ax)cos(bx)` and its two relatives, as a sum of waves.
 *
 * The one case where the two angles are allowed to differ, and the only way to
 * integrate it: there is no substitution that clears a product of two waves of
 * different frequencies, and the identity that does turns it into two terms
 * each of which is a table entry.
 *
 * Equal frequencies are left alone, because then it is a power and the rewrite
 * above is the better one — and because `a - b` would be zero, which is a
 * constant rather than a wave.
 */
function productToSum(node: Node, variable: string): Node | undefined {
  if (
    node.type !== "BinaryOperator" ||
    (node.name !== "Multiply" && node.name !== "CrossMultiply")
  ) {
    return undefined;
  }
  const first = asWave(node.left, variable);
  const second = asWave(node.right, variable);
  if (first === undefined || second === undefined) return undefined;
  if (sameTree(first.argument, second.argument)) return undefined;

  const sum = fold(add(first.argument, second.argument));
  const difference = fold(subtract(first.argument, second.argument));
  if (!dependsOn(sum, variable) || !dependsOn(difference, variable))
    return undefined;

  const half = (inner: Node) => divide(inner, number(2));
  // The three identities, in the order sine-cosine, sine-sine, cosine-cosine.
  if (first.name === "sin" && second.name === "cos") {
    return half(add(call("sin", sum), call("sin", difference)));
  }
  if (first.name === "cos" && second.name === "sin") {
    return half(subtract(call("sin", sum), call("sin", difference)));
  }
  if (first.name === "sin" && second.name === "sin") {
    return half(subtract(call("cos", difference), call("cos", sum)));
  }
  return half(add(call("cos", difference), call("cos", sum)));
}

function asWave(
  node: Node,
  variable: string
): { name: "sin" | "cos"; argument: Node } | undefined {
  if (node.type !== "FunctionCall" || node.args.length !== 1) return undefined;
  const name = node.callee.symbol;
  if (name !== "sin" && name !== "cos") return undefined;
  const [argument] = node.args;
  return dependsOn(argument, variable) ? { name, argument } : undefined;
}

/** Kept for the tests, which check the reading apart from the rewriting. */
export const forTesting = { readSinCosPowers, productToSum };
