/**
 * How a limit is explained: the routes a textbook would take to it.
 *
 * The limit is decided elsewhere, with proofs (`limit.ts`). This is the other
 * half of the job — saying why, in words anybody can follow — and it is held
 * to the same standard: every route here is a real computation, every line it
 * shows is an equality that holds on the side approached, and a route whose
 * last line is not the proved answer is thrown away rather than shown. A
 * route is a presentation of the answer, never a second opinion about it.
 *
 * Several routes usually apply, and the panel offers them all: `sin(3x)/sin(5x)`
 * is the standard trigonometric limit in one course, L'Hôpital's rule in the
 * next, and a leading term in a third. The first is the one a course would
 * reach for first — the order of the list below — and the rest are one tap
 * away.
 *
 * Each step speaks at three depths, which the panel chooses between:
 *
 * - `say`: what to do and why, in plain words;
 * - `why`: the condition that makes the step legal (a cancellation needs
 *   `x ≠ a`, L'Hôpital needs `g′ ≠ 0` near the point);
 * - `proof`: the certificate underneath — a leading term, a proved sign, the
 *   theorem being invoked.
 */
import {
  add,
  call,
  dependsOn,
  divide,
  fold,
  id,
  multiply,
  negative,
  number,
  power,
  quotientFactors,
  replaceIdentifier,
  subtract,
  type Node,
} from "../../../symbolic";
import * as X from "./exact";
import * as Q from "./rational";
import { rationalNode } from "./field";
import {
  certainlyZero,
  eventualSign,
  exactConstant,
  isBounded,
  leadingTermExactly,
  limitOf,
  LIMIT_STEP,
  movedToZero,
  numericPolynomial,
  type Approach,
  type Limit,
} from "./definite";
import { sameLimit, type IndeterminateForm, type LimitMethod } from "./limit";

/** One line of maths in a step. */
export type MathLine =
  /** `lim f`, written with the approach under it. */
  | { kind: "limit"; body: Node; equals: boolean }
  /** An expression, with or without an equals sign in front. */
  | { kind: "expr"; node: Node; equals: boolean }
  /** The value a limit comes to: exact, or ±∞. */
  | { kind: "value"; limit: Limit; equals: boolean }
  /** `a ≤ b ≤ c`. */
  | { kind: "between"; low: Node; middle: Node; high: Node };

export interface LimitStep {
  say: string;
  math: MathLine[];
  why?: string;
  proof?: string;
}

export interface LimitRoute {
  id: string;
  /** What the method is called, as a chip label. */
  name: string;
  steps: LimitStep[];
}

export interface RouteContext {
  /** The expression as typed. */
  original: Node;
  /** The expression as it is on the side approached. */
  node: Node;
  variable: string;
  approach: Approach;
  limit: Limit;
  method: LimitMethod;
  form?: IndeterminateForm;
}

const FORM_WORDS: Record<IndeterminateForm, string> = {
  "0/0": "0/0",
  "inf/inf": "∞/∞",
  "0*inf": "0·∞",
  "inf-inf": "∞ − ∞",
  "1^inf": "1^∞",
  "0^0": "0⁰",
  "inf^0": "∞⁰",
};

/**
 * Every route that reaches the proved answer, the one a course would use
 * first at the front. Never empty: when no textbook route applies, the last
 * resort names the method that decided it.
 */
export function limitRoutes(context: RouteContext): LimitRoute[] {
  const preface = sideSteps(context);
  const builders = [
    substitutionRoute,
    factorRoute,
    conjugateRoute,
    trigonometricRoute,
    highestPowerRoute,
    squeezeRoute,
    poleRoute,
    exponentialRoute,
    lHopitalRoute,
    seriesRoute,
  ];
  const routes: LimitRoute[] = [];
  for (const build of builders) {
    let route: Built | undefined;
    try {
      route = build(context);
    } catch {
      // A route that cannot be built is simply not offered.
      route = undefined;
    }
    if (route === undefined || !sameLimit(route.reaches, context.limit))
      continue;
    routes.push({
      id: route.id,
      name: route.name,
      steps: [...preface, ...route.steps],
    });
  }
  if (routes.length === 0) routes.push(fallbackRoute(context, preface));
  return routes;
}

/** A route as built: its steps, and the value its last line reaches. */
interface Built {
  id: string;
  name: string;
  steps: LimitStep[];
  reaches: Limit;
}

const finite = (value: X.ExactValue): Limit => ({ kind: "finite", value });
const limitLine = (body: Node, equals = true): MathLine => ({
  kind: "limit",
  body,
  equals,
});
const exprLine = (node: Node, equals = true): MathLine => ({
  kind: "expr",
  node,
  equals,
});
const valueLine = (limit: Limit): MathLine => ({
  kind: "value",
  limit,
  equals: true,
});

/** The point approached, when it is a rational number. */
function rationalPoint(approach: Approach): Q.Rational | undefined {
  if (approach.kind !== "point") return undefined;
  return X.asRational(exactConstant(approach.node) ?? []);
}

const sideWords = (approach: Approach) =>
  approach.kind === "infinite"
    ? approach.sign > 0
      ? "for large positive values"
      : "for large negative values"
    : approach.side > 0
      ? "just to the right of the point"
      : "just to the left of the point";

// ---- the side approached -----------------------------------------------------

/**
 * What was written out for the side: the step every one-sided answer rests
 * on, so it comes first whatever route follows.
 */
function sideSteps({ original, method, approach }: RouteContext): LimitStep[] {
  if (method.resolutions.length === 0) return [];
  const where = sideWords(approach);
  const sentences = method.resolutions.map((r) => {
    switch (r.kind) {
      case "piecewise":
        return `${capital(where)}, the condition picks one formula, so that is the one in force.`;
      case "abs":
        return `${capital(where)}, what is inside the absolute value keeps one sign, so the bars can be written out.`;
      case "sign":
        return `${capital(where)}, the sign is fixed, so sign(…) is just a number.`;
      default:
        return `${capital(where)}, the argument stays between the same two whole numbers, so the whole-number part is a constant.`;
    }
  });
  return [
    {
      say: [...new Set(sentences)].join(" "),
      math: [limitLine(original, false), limitLine(method.resolved)],
      why: "A limit on one side only uses points on that side, and there these two formulas agree.",
      proof:
        "The sign that decides each choice is proved on a whole one-sided neighbourhood: from a non-zero limit, or from the exact leading term c·hᵛ of its series, whose coefficient's sign is the function's sign for every small enough h.",
    },
  ];
}

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

// ---- substitution ------------------------------------------------------------

function substitutionRoute({
  node,
  variable,
  approach,
  method,
  limit,
}: RouteContext): Built | undefined {
  if (approach.kind !== "point" || limit.kind !== "finite") return undefined;
  if (method.lhopital.length > 0) return undefined;
  if (method.techniques.some((t) => t !== "substitution")) return undefined;
  const substituted = replaceIdentifier(node, variable, approach.node);
  const value = exactConstant(substituted);
  if (value === undefined) return undefined;
  return {
    id: "substitution",
    name: "Substitution",
    reaches: finite(value),
    steps: [
      {
        say: "The function is continuous here, so its limit is simply its value at the point: put the point in.",
        math: [
          limitLine(node, false),
          exprLine(substituted),
          valueLine(finite(value)),
        ],
        why: "Every piece of the formula is defined at the point and continuous there, and the limit of a continuous function is its value.",
      },
    ],
  };
}

// ---- factor and cancel -------------------------------------------------------

/** `P = (x − a)·quotient + remainder`, coefficients lowest power first. */
function syntheticDivide(
  coefficients: readonly Q.Rational[],
  a: Q.Rational
): { quotient: Q.Rational[]; remainder: Q.Rational } {
  const high = [...coefficients].reverse();
  const out: Q.Rational[] = [];
  let carry = Q.ZERO;
  for (const c of high) {
    carry = Q.add(Q.multiply(carry, a), c);
    out.push(carry);
  }
  const remainder = out.pop() ?? Q.ZERO;
  return { quotient: out.reverse(), remainder };
}

/** How many times `(x − a)` divides `P`, and what is left. */
function divideOut(
  coefficients: readonly Q.Rational[],
  a: Q.Rational
): [Q.Rational[], number] {
  let current = [...coefficients];
  let times = 0;
  while (current.length > 1) {
    const { quotient, remainder } = syntheticDivide(current, a);
    if (!Q.isZero(remainder)) break;
    current = quotient;
    times += 1;
  }
  return [current, times];
}

/** A polynomial from its coefficients, highest power first, as a course writes it. */
function polynomialNode(
  coefficients: readonly Q.Rational[],
  variable: string
): Node {
  const x = id(variable);
  let total: Node | undefined;
  for (let k = coefficients.length - 1; k >= 0; k--) {
    const c = coefficients[k];
    if (Q.isZero(c)) continue;
    const size = Q.isNegative(c) ? Q.negate(c) : c;
    const monomial =
      k === 0
        ? rationalNode(size)
        : fold(multiply(rationalNode(size), k === 1 ? x : power(x, number(k))));
    if (total === undefined)
      total = Q.isNegative(c) ? negative(monomial) : monomial;
    else
      total = Q.isNegative(c)
        ? subtract(total, monomial)
        : add(total, monomial);
  }
  return total ?? number(0);
}

/** `(x − a)^times`, written the way it is read. */
function linearFactor(variable: string, a: Q.Rational, times: number): Node {
  const x = id(variable);
  const base = Q.isZero(a)
    ? x
    : Q.isNegative(a)
      ? add(x, rationalNode(Q.negate(a)))
      : subtract(x, rationalNode(a));
  return times === 1 ? base : power(base, number(times));
}

function times(factors: Node[]): Node {
  const kept = factors.filter((f) => !(f.type === "Constant" && f.value === 1));
  if (kept.length === 0) return number(1);
  return kept.reduce((total, f) => multiply(total, f));
}

const factorWords = (variable: string, a: Q.Rational) =>
  Q.isZero(a)
    ? variable
    : `${variable} ${Q.isNegative(a) ? "+" : "−"} ${ratWords(Q.isNegative(a) ? Q.negate(a) : a)}`;

const ratWords = (q: Q.Rational) => (q.d === 1n ? `${q.n}` : `${q.n}/${q.d}`);

/**
 * Cancels the common factor `(x − a)` of a rational function at a rational
 * point, and finishes by substitution. Undefined when there is nothing to
 * cancel, or when what is left still has a zero on the bottom.
 */
function cancelled(
  top: readonly Q.Rational[],
  bottom: readonly Q.Rational[],
  a: Q.Rational,
  variable: string
):
  | {
      factored: Node;
      reduced: Node;
      substituted: Node;
      value: X.ExactValue;
      common: number;
    }
  | undefined {
  const [p, m] = divideOut(top, a);
  const [q, n] = divideOut(bottom, a);
  const common = Math.min(m, n);
  if (common === 0 || n > common) return undefined;
  const evaluateAt = (c: readonly Q.Rational[]) =>
    c.reduceRight(
      (total, coefficient) => Q.add(Q.multiply(total, a), coefficient),
      Q.ZERO
    );
  const pValue = m > common ? Q.ZERO : evaluateAt(p);
  const qValue = evaluateAt(q);
  if (Q.isZero(qValue)) return undefined;
  const pNode = polynomialNode(p, variable);
  const qNode = polynomialNode(q, variable);
  const factored = divide(
    times([linearFactor(variable, a, m), pNode]),
    times([linearFactor(variable, a, n), qNode])
  );
  const leftover = m - common;
  const reducedTop = times(
    leftover > 0 ? [linearFactor(variable, a, leftover), pNode] : [pNode]
  );
  const reduced =
    qNode.type === "Constant" && qNode.value === 1
      ? reducedTop
      : divide(reducedTop, qNode);
  return {
    factored,
    reduced,
    substituted: replaceIdentifier(reduced, variable, rationalNode(a)),
    value: X.fromRational(Q.divide(pValue, qValue)),
    common,
  };
}

function factorRoute({
  node,
  variable,
  approach,
  form,
}: RouteContext): Built | undefined {
  const a = rationalPoint(approach);
  if (a === undefined || form !== "0/0") return undefined;
  if (node.type !== "BinaryOperator" || node.name !== "Divide")
    return undefined;
  const top = numericPolynomial(node.left, variable);
  const bottom = numericPolynomial(node.right, variable);
  if (top === undefined || bottom === undefined) return undefined;
  const done = cancelled(top, bottom, a, variable);
  if (done === undefined) return undefined;
  const factor = factorWords(variable, a);
  return {
    id: "factor",
    name: "Factor and cancel",
    reaches: finite(done.value),
    steps: [
      {
        say: `Putting the point in gives 0/0, which says nothing yet. Both the top and the bottom are zero there, so both have (${factor}) as a factor.`,
        math: [limitLine(node, false), limitLine(done.factored)],
        why: "A polynomial that is zero at a has x − a as a factor (the factor theorem); dividing it out is exact.",
      },
      {
        say: `Cancel the common factor. That is allowed because a limit never uses the point itself, where (${factor}) would be zero.`,
        math: [limitLine(done.reduced)],
        why: `The two expressions agree at every point near the point but not at it, since ${factor} ≠ 0 there; functions that agree near a point have the same limit.`,
      },
      {
        say: "Nothing on the bottom is zero any more, so put the point in.",
        math: [exprLine(done.substituted), valueLine(finite(done.value))],
      },
    ],
  };
}

// ---- conjugate ---------------------------------------------------------------

/**
 * `√A − B` (or `B − √A`, or `√A + B` that vanishes) somewhere in a quotient
 * that is 0/0: multiply top and bottom by the conjugate, so the root squares
 * away, then cancel and substitute.
 */
function conjugateRoute({
  node,
  variable,
  approach,
  form,
}: RouteContext): Built | undefined {
  const a = rationalPoint(approach);
  if (a === undefined || form !== "0/0") return undefined;
  if (node.type !== "BinaryOperator" || node.name !== "Divide")
    return undefined;
  for (const onTop of [true, false]) {
    const radical = onTop ? node.left : node.right;
    const other = onTop ? node.right : node.left;
    const split = rootDifference(radical, variable);
    if (split === undefined) continue;
    const { conjugate, squared } = split;
    // The conjugate must not vanish near the point: it tends to a non-zero
    // number, so it is non-zero on a whole neighbourhood.
    const conjugateLimit = limitOf(conjugate, variable, approach);
    if (
      conjugateLimit?.kind !== "finite" ||
      certainlyZero(conjugateLimit.value) !== false
    )
      continue;
    const squaredPoly = numericPolynomial(squared, variable);
    const otherPoly = numericPolynomial(other, variable);
    if (squaredPoly === undefined || otherPoly === undefined) continue;
    const multiplied = onTop
      ? divide(multiply(radical, conjugate), multiply(other, conjugate))
      : divide(multiply(other, conjugate), multiply(radical, conjugate));
    const expanded = onTop
      ? divide(squared, multiply(other, conjugate))
      : divide(multiply(other, conjugate), squared);
    const done = onTop
      ? cancelled(squaredPoly, otherPoly, a, variable)
      : cancelled(otherPoly, squaredPoly, a, variable);
    if (done === undefined) continue;
    const [reducedTop, reducedBottom] =
      done.reduced.type === "BinaryOperator" && done.reduced.name === "Divide"
        ? [done.reduced.left, done.reduced.right]
        : [done.reduced, number(1)];
    const reduced = onTop
      ? divide(reducedTop, times([reducedBottom, conjugate]))
      : reducedBottom.type === "Constant" && reducedBottom.value === 1
        ? multiply(reducedTop, conjugate)
        : divide(multiply(reducedTop, conjugate), reducedBottom);
    const substituted = replaceIdentifier(reduced, variable, rationalNode(a));
    const value = exactConstant(substituted);
    if (value === undefined) continue;
    return {
      id: "conjugate",
      name: "Multiply by the conjugate",
      reaches: finite(value),
      steps: [
        {
          say: "Putting the point in gives 0/0, and the trouble is a square root and a number cancelling. Multiply the top and the bottom by the same expression with the sign between them flipped (the conjugate), so the square root squares away.",
          math: [
            limitLine(node, false),
            limitLine(multiplied),
            limitLine(expanded),
          ],
          why: "(√A − B)(√A + B) = A − B², and multiplying the top and the bottom by the same non-zero thing changes nothing.",
          proof:
            "The conjugate tends to a non-zero number here, so it is non-zero on a whole neighbourhood of the point and may be multiplied in.",
        },
        {
          say: "Now the top and the bottom share a factor that is zero at the point. Cancel it: the limit never uses the point itself.",
          math: [limitLine(reduced)],
        },
        {
          say: "Nothing on the bottom is zero any more, so put the point in.",
          math: [exprLine(substituted), valueLine(finite(value))],
        },
      ],
    };
  }
  return undefined;
}

/**
 * `√A ± B` or `B − √A` as the parts a conjugate needs: the conjugate itself,
 * and what the product of the two comes to once the root has squared away.
 */
function rootDifference(
  node: Node,
  variable: string
): { radicand: Node; rest: Node; conjugate: Node; squared: Node } | undefined {
  if (
    node.type !== "BinaryOperator" ||
    (node.name !== "Add" && node.name !== "Subtract")
  )
    return undefined;
  const isRoot = (n: Node): n is Node & { type: "FunctionCall" } =>
    n.type === "FunctionCall" &&
    n.callee.symbol === "sqrt" &&
    dependsOn(n.args[0], variable);
  const square = (n: Node) => power(n, number(2));
  const { left, right } = node;
  if (isRoot(left) && !isRoot(right)) {
    const [radicand] = left.args;
    // (√A − B)(√A + B) = A − B²; (√A + B)(√A − B) = A − B².
    return {
      radicand,
      rest: right,
      conjugate:
        node.name === "Subtract" ? add(left, right) : subtract(left, right),
      squared: subtract(radicand, square(right)),
    };
  }
  if (isRoot(right) && !isRoot(left)) {
    const [radicand] = right.args;
    // (B − √A)(B + √A) = B² − A; (B + √A)(B − √A) = B² − A.
    return {
      radicand,
      rest: left,
      conjugate:
        node.name === "Subtract" ? add(left, right) : subtract(left, right),
      squared: subtract(square(left), radicand),
    };
  }
  return undefined;
}

// ---- the standard trigonometric limit ----------------------------------------

/**
 * `sin(kx)` and `tan(kx)` paired with their own arguments, at 0: each
 * `sin(kx)/(kx) → 1`, so the limit is what is left when every sine is
 * replaced by its argument. The engine's answer is the check.
 */
function trigonometricRoute({
  node,
  variable,
  approach,
  form,
}: RouteContext): Built | undefined {
  if (form !== "0/0" || approach.kind !== "point") return undefined;
  if (!Q.isZero(rationalPoint(approach) ?? Q.ONE)) return undefined;
  const factors: { node: Node; inNumerator: boolean }[] = [];
  quotientFactors(node, true, factors);
  let trig = 0;
  const pairs: Node[] = [];
  const replaced: { node: Node; inNumerator: boolean }[] = [];
  for (const f of factors) {
    if (
      f.node.type === "FunctionCall" &&
      (f.node.callee.symbol === "sin" || f.node.callee.symbol === "tan") &&
      f.node.args.length === 1
    ) {
      const [argument] = f.node.args;
      const linear = numericPolynomial(argument, variable);
      if (linear === undefined || linear.length !== 2 || !Q.isZero(linear[0]))
        return undefined;
      trig += 1;
      pairs.push(
        f.inNumerator ? divide(f.node, argument) : divide(argument, f.node)
      );
      replaced.push({ node: argument, inNumerator: f.inNumerator });
    } else {
      if (
        dependsOn(f.node, variable) &&
        numericPolynomial(f.node, variable) === undefined
      )
        return undefined;
      replaced.push(f);
    }
  }
  if (trig === 0) return undefined;
  const rebuild = (list: { node: Node; inNumerator: boolean }[]) => {
    const top = times(list.filter((f) => f.inNumerator).map((f) => f.node));
    const bottomFactors = list.filter((f) => !f.inNumerator).map((f) => f.node);
    return bottomFactors.length === 0 ? top : divide(top, times(bottomFactors));
  };
  const rest = rebuild(replaced);
  const regrouped = times([...pairs, rest]);
  const simplified = fold(rest);
  const value = limitOf(simplified, variable, approach);
  if (value === undefined) return undefined;
  return {
    id: "trigonometric",
    name: "sin u / u → 1",
    reaches: value,
    steps: [
      {
        say: "The key fact: as u gets close to 0, sin(u)/u gets close to 1 (and so does tan(u)/u). Pair each sine with its own argument by multiplying and dividing by it.",
        math: [limitLine(node, false), limitLine(regrouped)],
        why: "Multiplying and dividing by the same non-zero expression changes nothing; near 0, but not at it, each argument is non-zero.",
      },
      {
        say: "Each of those pairs tends to 1, so only the rest is left.",
        math: [
          limitLine(rest),
          ...(simplified === rest || !dependsOn(simplified, variable)
            ? []
            : [limitLine(simplified)]),
          valueLine(value),
        ],
        why: "The limit of a product is the product of the limits when each exists: here each pair is 1.",
        proof:
          "That sin(u)/u → 1 as u → 0 follows from sin u ≤ u ≤ tan u for small u > 0 and the squeeze theorem; the argument kx → 0 and is non-zero on a punctured neighbourhood of 0.",
      },
    ],
  };
}

// ---- dividing by the highest power -------------------------------------------

function highestPowerRoute({
  node,
  variable,
  approach,
}: RouteContext): Built | undefined {
  if (approach.kind !== "infinite") return undefined;
  if (node.type !== "BinaryOperator" || node.name !== "Divide")
    return undefined;
  const top = numericPolynomial(node.left, variable);
  const bottom = numericPolynomial(node.right, variable);
  if (top === undefined || bottom === undefined) return undefined;
  const n = bottom.length - 1;
  if (n < 1) return undefined;
  const x = id(variable);
  const scaled = (coefficients: readonly Q.Rational[]) => {
    let total: Node | undefined;
    for (let k = coefficients.length - 1; k >= 0; k--) {
      const c = coefficients[k];
      if (Q.isZero(c)) continue;
      const e = k - n;
      const size = Q.isNegative(c) ? Q.negate(c) : c;
      const term =
        e === 0
          ? rationalNode(size)
          : e > 0
            ? fold(
                multiply(rationalNode(size), e === 1 ? x : power(x, number(e)))
              )
            : divide(rationalNode(size), -e === 1 ? x : power(x, number(-e)));
      if (total === undefined) total = Q.isNegative(c) ? negative(term) : term;
      else total = Q.isNegative(c) ? subtract(total, term) : add(total, term);
    }
    return total ?? number(0);
  };
  const divided = divide(scaled(top), scaled(bottom));
  const m = top.length - 1;
  const reaches: Limit =
    m < n
      ? finite(X.ZERO)
      : m === n
        ? finite(X.fromRational(Q.divide(top[m], bottom[n])))
        : {
            kind: "infinite",
            sign:
              (Q.isNegative(Q.divide(top[m], bottom[n])) ? -1 : 1) *
                ((m - n) % 2 === 1 ? approach.sign : 1) >
              0
                ? 1
                : -1,
          };
  return {
    id: "highest-power",
    name: "Divide by the highest power",
    reaches,
    steps: [
      {
        say: `Divide the top and the bottom by the highest power of ${variable} on the bottom. That changes nothing, and it shows which terms matter.`,
        math: [limitLine(node, false), limitLine(divided)],
        why: `Dividing the top and the bottom by the same non-zero number leaves a fraction unchanged, and ${variable} ≠ 0 for large ${variable}.`,
      },
      {
        say:
          m <= n
            ? `Every term with ${variable} left on the bottom of a fraction shrinks to 0 as ${variable} grows, which leaves the leading terms.`
            : `The bottom settles on a number, but the top still grows without bound, so the fraction does too.`,
        math: [valueLine(reaches)],
        why: `c/${variable}ᵏ → 0 as ${variable} → ±∞ for every k > 0.`,
      },
    ],
  };
}

// ---- squeeze -----------------------------------------------------------------

function squeezeRoute({
  node,
  variable,
  approach,
  limit,
}: RouteContext): Built | undefined {
  if (limit.kind !== "finite" || certainlyZero(limit.value) !== true)
    return undefined;
  const factors: { node: Node; inNumerator: boolean }[] = [];
  quotientFactors(node, true, factors);
  const bounded = factors.find(
    (f) => f.inNumerator && isBounded(f.node) && dependsOn(f.node, variable)
  );
  if (bounded === undefined) return undefined;
  const others = factors.filter((f) => f !== bounded);
  const top = times(others.filter((f) => f.inNumerator).map((f) => f.node));
  const bottom = others.filter((f) => !f.inNumerator).map((f) => f.node);
  const rest = bottom.length === 0 ? top : divide(top, times(bottom));
  const magnitude = call("abs", rest);
  const restLimit = limitOf(magnitude, variable, approach);
  if (restLimit?.kind !== "finite" || certainlyZero(restLimit.value) !== true)
    return undefined;
  const inner = bounded.node;
  const bound =
    inner.type === "FunctionCall" && inner.callee.symbol === "arctan"
      ? divide(id("pi"), number(2))
      : number(1);
  const high =
    bound.type === "Constant" ? magnitude : multiply(bound, magnitude);
  return {
    id: "squeeze",
    name: "Squeeze theorem",
    reaches: finite(X.ZERO),
    steps: [
      {
        say: "The wobbling part never leaves a fixed range, whatever happens to its argument. So the whole expression is trapped between two simpler ones.",
        math: [{ kind: "between", low: negative(high), middle: node, high }],
        why: "−1 ≤ sin u ≤ 1 and −1 ≤ cos u ≤ 1 for every u; multiplying by |…| keeps the inequalities.",
      },
      {
        say: "Both of those go to 0, so the expression caught between them has nowhere else to go.",
        math: [limitLine(high, false), valueLine(finite(X.ZERO))],
        why: "The squeeze theorem: if g ≤ f ≤ h near the point and g and h have the same limit, f has it too.",
      },
    ],
  };
}

// ---- infinite limits at a point ----------------------------------------------

function poleRoute({
  node,
  variable,
  approach,
  limit,
}: RouteContext): Built | undefined {
  if (limit.kind !== "infinite" || approach.kind !== "point") return undefined;
  if (node.type !== "BinaryOperator" || node.name !== "Divide")
    return undefined;
  const top = limitOf(node.left, variable, approach);
  const bottom = limitOf(node.right, variable, approach);
  if (top?.kind !== "finite" || certainlyZero(top.value) !== false)
    return undefined;
  if (bottom?.kind !== "finite" || certainlyZero(bottom.value) !== true)
    return undefined;
  const bottomSign = eventualSign(node.right, variable, approach);
  if (bottomSign === undefined || bottomSign === 0) return undefined;
  const topSign = X.toNumber(top.value) < 0 ? -1 : 1;
  const sign = (topSign * bottomSign) as 1 | -1;
  return {
    id: "pole",
    name: "Sign of each part",
    reaches: { kind: "infinite", sign },
    steps: [
      {
        say: `The top approaches a ${topSign > 0 ? "positive" : "negative"} number, and the bottom approaches 0 through ${bottomSign > 0 ? "positive" : "negative"} values. Dividing by smaller and smaller numbers makes the fraction as ${sign > 0 ? "large" : "negative"} as you like.`,
        math: [limitLine(node, false), valueLine({ kind: "infinite", sign })],
        why: `The limit is ${sign > 0 ? "+∞" : "−∞"}: the values grow without bound, so there is no finite limit.`,
        proof:
          "The bottom's sign is proved on the whole side, from the leading term of its series in the distance to the point.",
      },
    ],
  };
}

// ---- exponent as a limit -----------------------------------------------------

function exponentialRoute({
  node,
  variable,
  approach,
  form,
}: RouteContext): Built | undefined {
  if (node.type !== "BinaryOperator" || node.name !== "Exponent")
    return undefined;
  if (!dependsOn(node.right, variable)) return undefined;
  const { left: base, right: exponent } = node;
  if (base.type === "Identifier" && base.symbol === "e") return undefined;
  const logarithm = fold(multiply(exponent, call("ln", base)));
  const inner = limitOf(logarithm, variable, approach);
  if (inner === undefined) return undefined;
  const reaches: Limit =
    inner.kind === "infinite"
      ? inner.sign > 0
        ? { kind: "infinite", sign: 1 }
        : finite(X.ZERO)
      : (() => {
          const value = exactConstant(power(id("e"), X.toNode(inner.value)));
          return value === undefined ? inner : finite(value);
        })();
  const formWords =
    form === undefined
      ? ""
      : ` It is a ${FORM_WORDS[form]} form, which says nothing by itself.`;
  return {
    id: "exponential",
    name: "Write it as e^(…)",
    reaches,
    steps: [
      {
        say: `The variable is in both the base and the exponent.${formWords} Rewrite the power as an exponential, where the exponent is a product that can be handled.`,
        math: [limitLine(node, false), limitLine(power(id("e"), logarithm))],
        why: "A^B = e^(B ln A) whenever A > 0, which holds near the point.",
      },
      {
        say: "The exponential is continuous, so find the limit of the exponent on its own.",
        math: [limitLine(logarithm, false), valueLine(inner)],
      },
      {
        say:
          inner.kind === "infinite"
            ? inner.sign > 0
              ? "The exponent grows without bound, so e to it does too."
              : "The exponent goes to −∞, so e to it goes to 0."
            : "So the limit is e raised to that.",
        math: [valueLine(reaches)],
        why: "the limit of e^g is e^(the limit of g), because e^u is continuous.",
      },
    ],
  };
}

// ---- L'Hôpital ---------------------------------------------------------------

function lHopitalRoute({
  node,
  method,
  limit,
  form,
}: RouteContext): Built | undefined {
  if (method.lhopital.length === 0) return undefined;
  const words = form === undefined ? "0/0" : FORM_WORDS[form];
  const steps: LimitStep[] = method.lhopital.map((step, i) => ({
    say:
      i === 0
        ? `Putting the point in gives ${words}, one of the two forms L'Hôpital's rule is for: the limit equals the limit of the derivative of the top over the derivative of the bottom.`
        : `Still ${words}, so apply the rule again.`,
    math: [
      ...(i === 0 ? [limitLine(node, false)] : []),
      limitLine(divide(step.numerator, step.denominator)),
    ],
    why:
      i === 0
        ? "The rule needs the top and the bottom differentiable near the point, the bottom's derivative non-zero there, and the new limit to exist. All three are checked."
        : undefined,
  }));
  steps.push({
    say: "Now the limit can be found directly.",
    math: [valueLine(limit)],
  });
  return { id: "lhopital", name: "L'Hôpital's rule", reaches: limit, steps };
}

// ---- leading term ------------------------------------------------------------

/**
 * The research-grade route, and the one underneath the others: move the
 * point to 0, expand exactly, and read the answer off the first term that
 * does not vanish.
 */
function seriesRoute({
  node,
  variable,
  approach,
}: RouteContext): Built | undefined {
  const lead = leadingTermExactly(
    movedToZero(node, variable, approach),
    LIMIT_STEP
  );
  if (lead === undefined) return undefined;
  const h = id("h");
  const term = fold(
    multiply(
      X.toNode(lead.coefficient),
      lead.valuation === 0 ? number(1) : power(h, number(lead.valuation))
    )
  );
  const reaches: Limit =
    lead.valuation > 0
      ? finite(X.ZERO)
      : lead.valuation === 0
        ? finite(lead.coefficient)
        : {
            kind: "infinite",
            sign: X.toNumber(lead.coefficient) < 0 ? -1 : 1,
          };
  const substitution =
    approach.kind === "infinite"
      ? `${variable} = ${approach.sign > 0 ? "" : "−"}1/h`
      : `${variable} = ${approach.side > 0 ? "point + h" : "point − h"}`;
  return {
    id: "series",
    name: "Leading term",
    reaches,
    steps: [
      {
        say: `Put ${substitution} with h small and positive, and expand in powers of h. Only the first term that is not zero matters as h shrinks.`,
        math: [
          exprLine(
            add(term, call("O", power(h, number(lead.valuation + 1)))),
            false
          ),
        ],
        why:
          lead.valuation > 0
            ? "A positive power of h goes to 0."
            : lead.valuation === 0
              ? "The constant term is the limit; everything after it has a positive power of h."
              : "A negative power of h grows without bound, with the sign of its coefficient.",
        proof:
          "Every coefficient is computed exactly, and the leading one is proved non-zero, so the function equals c·hᵛ(1 + o(1)) as h → 0⁺.",
      },
      { say: "So the limit is:", math: [valueLine(reaches)] },
    ],
  };
}

function fallbackRoute(
  { node, limit }: RouteContext,
  preface: LimitStep[]
): LimitRoute {
  return {
    id: "engine",
    name: "Limit rules",
    steps: [
      ...preface,
      {
        say: "Found from the limits of the parts, combined by the limit laws.",
        math: [limitLine(node, false), valueLine(limit)],
      },
    ],
  };
}
