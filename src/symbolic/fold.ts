/**
 * The structural fold: the rewrites whose result is not a matter of opinion.
 *
 * Constants collapse, a multiplication by one disappears, a sign moves onto the
 * coefficient it belongs to, a factor above the bar cancels one below it,
 * `6x/3` becomes `2x`. Nobody looking at the output would prefer the input, so
 * this is safe to run on anything, always, without being asked — which is
 * exactly what separates it from `condense` and `expand`, where both forms are
 * defensible and the caller has to choose.
 *
 * There were two of these. Vector Tools' differentiator had one and Physics
 * Lab's integrator had a larger one whose own comment said it was "the same
 * fold Vector Tools' differentiator uses, for the same reason" — and they had
 * drifted, so the same expression came out as `2x+-(2x)` in one plugin and `0`
 * in the other. This is the larger one, which passed both plugins' suites
 * unchanged when it was put in the smaller one's place.
 *
 * ## What it will not do
 *
 * Nothing that could turn an exact value into a decimal. `1/2` stays a
 * fraction, `\sqrt2` stays a radical, `\sin(1)` stays a call — only the values
 * that are exactly representable fold, which is why `foldKnownValue` is such a
 * short table. An exact answer that quietly becomes 0.7071 is the one failure
 * this whole layer exists to avoid.
 *
 * And nothing that needs a term ordering. Like terms are collected when they
 * are written the same way (`3x + -3x` is zero) but not when they are not
 * (`x·2 + 2·x` is left alone), because deciding that those are the same term is
 * the first step of a canonical form, and a canonical form strong enough to be
 * useful is a computer algebra system.
 */
import { Aug } from "../../text-mode-core";
import {
  binop,
  constantValue,
  negative,
  number,
  quotientFactors,
  rationalNode,
  rationalOf,
  sameTree,
  splitCoefficient,
  type Node,
} from "./tree";

type BinaryOperator = Aug.Latex.BinaryOperator;

/**
 * Folds the arithmetic that the rules above produce in bulk.
 *
 * Without it `∫2x dx` comes out as `2·(x²/2)` rather than `x²`, which is
 * correct and is not what anybody writes. This is the same fold Vector Tools'
 * differentiator uses, for the same reason.
 */
export function fold(node: Node): Node {
  switch (node.type) {
    case "Negative": {
      const arg = fold(node.arg);
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
          return fold(binop("Multiply", number(-coefficient), arg.right));
      }
      return negative(arg);
    }
    case "FunctionCall": {
      const args = node.args.map(fold);
      const folded = foldKnownValue(node.callee.symbol, args);
      return folded ?? { ...node, args };
    }
    case "BinaryOperator":
      return foldBinary(node);
    default:
      return node;
  }
}

function foldBinary(node: BinaryOperator): Node {
  const left = fold(node.left);
  const right = fold(node.right);
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
    const product = fold(binop("Multiply", bareLeft, bareRight));
    // Two negatives cancel; one survives as the sign of the whole product.
    return left.type === "Negative" && right.type === "Negative"
      ? product
      : fold(negative(product));
  }
  if (node.name === "Add" && right.type === "Negative")
    return fold(binop("Subtract", left, right.arg));
  // A negative on the left of a sum is a subtraction the other way round, which
  // is also how `-x+x` gets to `x-x` and from there to zero.
  if (node.name === "Add" && left.type === "Negative")
    return fold(binop("Subtract", right, left.arg));
  if (node.name === "Subtract" && right.type === "Negative")
    return fold(binop("Add", left, right.arg));

  if (node.name === "Multiply" || node.name === "CrossMultiply") {
    const shared = foldSharedBases(binop("Multiply", left, right));
    if (shared !== undefined) return fold(shared);
  }

  if (node.name === "Divide") {
    const cancelled = cancelCommonFactors(binop("Divide", left, right));
    if (cancelled !== undefined) return fold(cancelled);
  }

  switch (node.name) {
    case "Add":
      if (lc === 0) return right;
      if (rc === 0) return left;
      if (lc !== undefined && rc !== undefined) return number(lc + rc);
      break;
    case "Subtract":
      if (rc === 0) return left;
      if (lc === 0) return fold(negative(right));
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
      return fold(binop("Multiply", number(combined), leftRest));
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
      if (lc === -1) return fold(negative(right));
      if (rc === -1) return fold(negative(left));
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
        return fold(
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
          return fold(binop("Multiply", number(lc * inner), right.right));
      }
      // c · (d/e) folds to (cd)/e, which is what turns 2·(x²/2) into x².
      if (
        lc !== undefined &&
        right.type === "BinaryOperator" &&
        right.name === "Divide"
      ) {
        return fold(
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
      if (rc === -1) return fold(negative(left));
      // A negative on either side of the bar belongs in front of the fraction.
      // `x/-3` and `-1/9` are both correct and neither is how it is written.
      if (rc !== undefined && rc < 0)
        return fold(negative(binop("Divide", left, number(-rc))));
      if (lc !== undefined && lc < 0)
        return fold(negative(binop("Divide", number(-lc), right)));
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
          return fold(binop("Multiply", number(factor / rc), left.right));
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
          return fold(binop("Divide", left.left, number(inner * rc)));
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
        return fold(
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
function foldSharedBases(node: BinaryOperator): Node | undefined {
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
function cancelCommonFactors(node: BinaryOperator): Node | undefined {
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
