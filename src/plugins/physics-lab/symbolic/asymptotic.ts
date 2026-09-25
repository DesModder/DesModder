/**
 * Growth races, decided on Hardy's scale.
 *
 * `x¹⁰⁰/eˣ → 0` is the fact every course states and no finite list of rules
 * derives: L'Hôpital takes a hundred steps, and the leading-term rules see
 * two things running to infinity and stop. What decides it is a ruler to
 * measure both against, and the one used here is the scale a textbook
 * ranks functions by:
 *
 *     (ln t)ᵇ  ≪  tᵃ  ≪  e^{E(t)}      as t → ∞,
 *
 * so that any function built from powers, exponentials and logarithms is
 * eventually `c · tᵃ · (ln t)ᵇ · e^{E}` times something tending to 1. That
 * form is its size. Two sizes compare by their exponentials first, then
 * their powers, then their logarithms, and the constant only matters when
 * all three agree. (G. H. Hardy, *Orders of Infinity*, 1910; the same idea,
 * made complete, is Gruntz's algorithm in modern computer algebra.)
 *
 * A limit at a point is moved to infinity first — `x = a ± 1/t` — so the
 * one ruler measures everything: `x¹⁰⁰ e^{-1/x²} → 0` at 0 is the same race
 * as `t^{-100} e^{-t²}`.
 *
 * Every step keeps a *leading* term and drops the rest, which is only safe
 * when the rest is provably smaller. Where it is not — two terms of the
 * same size that cancel, or a logarithm of a logarithm — the size is
 * unknown and the limit is left to the other methods rather than guessed.
 */
import {
  add,
  call,
  collectLikeTerms,
  dependsOn,
  divide,
  evaluate,
  fold,
  id,
  multiply,
  number as numberNode,
  power,
  replaceIdentifier,
  subtract,
  type Node,
} from "../../../symbolic";
import * as X from "./exact";
import * as Q from "./rational";
import {
  certainlyZero,
  exactConstant,
  isBounded,
  leadingTermExactly,
  limitOf,
  LIMIT_STEP,
  type Approach,
  type Limit,
  type LimitRecorder,
} from "./definite";

/**
 * `c · tᵃ · (ln t)ᵇ · e^{E}`. When present, `E` tends to ±∞ faster than any
 * multiple of `ln t` — slower exponents are folded into `a` — which is what
 * lets the exponentials be compared before the powers.
 */
interface Size {
  c: X.ExactValue;
  a: Q.Rational;
  b: Q.Rational;
  E?: Node;
}

const AT_INFINITY: Approach = { kind: "infinite", sign: 1 };

/** How deep sizes may nest before the answer is not worth the time. */
const MAX_DEPTH = 12;
let depth = 0;

/**
 * The limits being measured right now. Measuring `f` can ask for the limit of
 * `f` itself — a function of an argument that settles is sized by its own
 * limit — and that question must go to the other methods, not back here.
 */
const inProgress = new Set<string>();

/**
 * The limit, by comparing sizes, or undefined when some part has no size
 * this can name.
 */
export function scaleLimit(
  node: Node,
  variable: string,
  approach: Approach,
  record: LimitRecorder
): Limit | undefined {
  const t = id(variable);
  const moved =
    approach.kind === "infinite"
      ? approach.sign > 0
        ? node
        : replaceIdentifier(node, variable, multiply(numberNode(-1), t))
      : replaceIdentifier(
          node,
          variable,
          add(approach.node, divide(numberNode(approach.side), t))
        );
  const key = `${variable} ${JSON.stringify(moved)}`;
  if (inProgress.has(key) || depth >= MAX_DEPTH) return undefined;
  inProgress.add(key);
  try {
    const size = sizeOf(moved, variable);
    if (size === undefined) return undefined;
    const found = limitOfSize(size, variable);
    if (found !== undefined) record("growth");
    return found;
  } finally {
    inProgress.delete(key);
  }
}

/**
 * The leading form itself, for showing: `c · tᵃ · (ln t)ᵇ · e^{E}` in the
 * variable `t` that goes to +∞, and what it tends to. `f` divided by it
 * tends to 1, so the two have the same limit.
 */
export function leadingForm(
  node: Node,
  variable: string,
  approach: Approach
): { form: Node; moved: boolean; limit: Limit } | undefined {
  const t = id(variable);
  const moved =
    approach.kind === "infinite"
      ? approach.sign > 0
        ? node
        : replaceIdentifier(node, variable, multiply(numberNode(-1), t))
      : replaceIdentifier(
          node,
          variable,
          add(approach.node, divide(numberNode(approach.side), t))
        );
  const size = sizeOf(moved, variable);
  const limit = size && limitOfSize(size, variable);
  if (size === undefined || limit === undefined) return undefined;
  const T = id("t");
  const exponent = (base: Node, q: Q.Rational) =>
    Q.isOne(q) ? base : power(base, X.toNode(X.fromRational(q)));
  const parts: Node[] = [X.toNode(size.c)];
  if (!Q.isZero(size.a)) parts.push(exponent(T, size.a));
  if (!Q.isZero(size.b)) parts.push(exponent(call("ln", T), size.b));
  if (size.E !== undefined)
    parts.push(power(id("e"), replaceIdentifier(size.E, variable, T)));
  return {
    form: fold(parts.reduce((a, b) => multiply(a, b))),
    moved: !(approach.kind === "infinite" && approach.sign > 0),
    limit,
  };
}

const limitAtInfinity = (node: Node, variable: string) =>
  limitOf(node, variable, AT_INFINITY);

const sign = (value: X.ExactValue) => Math.sign(X.toNumber(value));

const positive = (q: Q.Rational) => !Q.isZero(q) && !Q.isNegative(q);

/** What a size tends to. */
function limitOfSize(size: Size, variable: string): Limit | undefined {
  const s = sign(size.c) < 0 ? -1 : 1;
  if (size.E !== undefined) {
    const to = limitAtInfinity(size.E, variable);
    if (to?.kind !== "infinite") return undefined;
    return to.sign > 0
      ? { kind: "infinite", sign: s }
      : { kind: "finite", value: X.ZERO };
  }
  const order = Q.isZero(size.a) ? size.b : size.a;
  if (Q.isZero(order)) return { kind: "finite", value: size.c };
  return Q.isNegative(order)
    ? { kind: "finite", value: X.ZERO }
    : { kind: "infinite", sign: s };
}

const constant = (c: X.ExactValue): Size => ({ c, a: Q.ZERO, b: Q.ZERO });
const ONE = () => constant(X.fromInteger(1));

function times(p: Size, q: Size, variable: string): Size | undefined {
  const size: Size = {
    c: X.multiply(p.c, q.c),
    a: Q.add(p.a, q.a),
    b: Q.add(p.b, q.b),
  };
  if (p.E === undefined || q.E === undefined) return { ...size, E: p.E ?? q.E };
  // e^{E₁}·e^{E₂} is only on the scale while E₁ + E₂ is still large; if the
  // two cancel down to something slower, what is left is re-measured.
  return withExponential(size, fold(add(p.E, q.E)), variable);
}

function raised(p: Size, r: Q.Rational): Size | undefined {
  const c = X.power(p.c, r);
  if (c === undefined || c.length === 0) return undefined;
  const size: Size = { c, a: Q.multiply(p.a, r), b: Q.multiply(p.b, r) };
  if (p.E === undefined) return size;
  return { ...size, E: fold(multiply(X.toNode(X.fromRational(r)), p.E)) };
}

/**
 * `size · e^{E}`, with E sorted onto the scale: a limit folds into the
 * constant, a multiple of `ln t` into the power, and only something that
 * outgrows every logarithm stays an exponential.
 */
function withExponential(
  size: Size,
  E: Node,
  variable: string
): Size | undefined {
  const settle = (value: X.ExactValue): Size | undefined => {
    const factor = exactConstant(power(id("e"), X.toNode(value)));
    return factor === undefined
      ? undefined
      : { ...size, c: X.multiply(size.c, factor) };
  };
  if (!dependsOn(E, variable)) {
    const value = exactConstant(E);
    return value === undefined ? undefined : settle(value);
  }
  const to = limitAtInfinity(E, variable);
  if (to?.kind === "finite") return settle(to.value);
  const inner = sizeOf(E, variable);
  if (inner === undefined) return undefined;
  const outgrowsLog =
    inner.E !== undefined ||
    positive(inner.a) ||
    (Q.isZero(inner.a) && positive(Q.subtract(inner.b, Q.ONE)));
  if (outgrowsLog)
    return { ...size, E: size.E === undefined ? E : fold(add(size.E, E)) };
  // E ~ k ln t exactly: e^{E} = t^k · e^{E − k ln t}, and the remainder has
  // to settle to a constant for the split to be the whole story.
  if (!Q.isZero(inner.a) || !Q.isOne(inner.b)) return undefined;
  const k = X.asRational(inner.c);
  if (k === undefined) return undefined;
  const rest = fold(
    subtract(E, multiply(X.toNode(inner.c), call("ln", id(variable))))
  );
  const settled = limitAtInfinity(rest, variable);
  if (settled?.kind !== "finite") return undefined;
  const found = settle(settled.value);
  return found && { ...found, a: Q.add(found.a, k) };
}

/** The size of an expression in `variable` as it goes to +∞. */
function sizeOf(node: Node, variable: string): Size | undefined {
  if (depth >= MAX_DEPTH) return undefined;
  depth += 1;
  try {
    return measure(node, variable) ?? bySeries(node, variable);
  } finally {
    depth -= 1;
  }
}

/**
 * The size from a power series in `h = 1/t`, when the structure alone gave
 * none: a sum whose leading terms cancel, `π/2 − (π/2 + 1/t)`, or a function
 * at a pole, `tan(π/2 + 1/t) = −t + …`. The series knows the next term; the
 * structure only knew the first.
 */
function bySeries(node: Node, variable: string): Size | undefined {
  const moved = replaceIdentifier(
    node,
    variable,
    divide(numberNode(1), id(LIMIT_STEP))
  );
  const lead = leadingTermExactly(moved, LIMIT_STEP);
  if (lead === undefined || certainlyZero(lead.coefficient) !== false)
    return undefined;
  const v = Q.fromNumber(lead.valuation);
  if (v === undefined || Number(v.n) / Number(v.d) !== lead.valuation)
    return undefined;
  return { c: lead.coefficient, a: Q.negate(v), b: Q.ZERO };
}

function measure(node: Node, variable: string): Size | undefined {
  if (!dependsOn(node, variable)) {
    const value = exactConstant(node);
    return value === undefined || certainlyZero(value) !== false
      ? undefined
      : constant(value);
  }
  switch (node.type) {
    case "Identifier":
      return { c: X.fromInteger(1), a: Q.ONE, b: Q.ZERO };
    case "Negative": {
      const inner = sizeOf(node.arg, variable);
      return inner && { ...inner, c: X.negate(inner.c) };
    }
    case "BinaryOperator":
      switch (node.name) {
        case "Multiply":
        case "CrossMultiply": {
          const p = sizeOf(node.left, variable);
          const q = p && sizeOf(node.right, variable);
          return p && q && times(p, q, variable);
        }
        case "Divide": {
          const p = sizeOf(node.left, variable);
          const q = p && sizeOf(node.right, variable);
          const inverse = q && raised(q, Q.rational(-1n));
          return p && inverse && times(p, inverse, variable);
        }
        case "Add":
        case "Subtract":
          return sum(node.left, node.right, node.name === "Subtract", variable);
        case "Exponent":
          return exponential(node.left, node.right, variable);
        default:
          return undefined;
      }
    case "FunctionCall":
      return functionSize(node, variable);
    default:
      return undefined;
  }
}

/**
 * `p ± q`: the bigger one, when one is bigger. The same size on both sides
 * adds the constants, and when those cancel the leading terms say nothing
 * and the sum is left unmeasured.
 */
function sum(
  left: Node,
  right: Node,
  negated: boolean,
  variable: string
): Size | undefined {
  // ln A − ln B is ln(A/B), which is one size rather than two that cancel.
  const lnOf = (n: Node) =>
    n.type === "FunctionCall" && n.callee.symbol === "ln" && n.args.length === 1
      ? n.args[0]
      : undefined;
  const A = lnOf(left);
  const B = lnOf(right);
  if (A !== undefined && B !== undefined)
    return sizeOf(
      call("ln", negated ? divide(A, B) : multiply(A, B)),
      variable
    );

  const p = sizeOf(left, variable);
  const q0 = sizeOf(right, variable);
  const q = q0 && (negated ? { ...q0, c: X.negate(q0.c) } : q0);
  if (p === undefined || q === undefined) {
    // Something running off to infinity beside something bounded runs off
    // the same way: x + sin x is as big as x.
    const known = p ?? q;
    const other = p === undefined ? left : right;
    if (known === undefined || !isBounded(other)) return undefined;
    return limitOfSize(known, variable)?.kind === "infinite"
      ? known
      : undefined;
  }
  const inverse = raised(q, Q.rational(-1n));
  const ratio = inverse && times(p, inverse, variable);
  if (ratio === undefined) return undefined;
  const to = limitOfSize(ratio, variable);
  if (to === undefined) return undefined;
  if (to.kind === "infinite") return p;
  if (certainlyZero(to.value) === true) return q;
  // The same order: p + q = q (p/q + 1), with p/q → r.
  const factor = X.add(to.value, X.fromInteger(1));
  if (certainlyZero(factor) === false)
    return { ...q, c: X.multiply(q.c, factor) };
  // They cancel. A logarithm of a sum can be opened past its leading term,
  // ln(A + B) = ln A + ln(1 + B/A), and then what cancelled cancels in the
  // tree: ln(eˣ + x³) − x is x + ln(1 + x³e^{−x}) − x.
  const opened = [left, right].map((side) => openedLogarithm(side, variable));
  if (opened[0] !== undefined || opened[1] !== undefined) {
    const l = opened[0] ?? left;
    const r = opened[1] ?? right;
    return sizeOf(
      fold(collectLikeTerms(fold(negated ? subtract(l, r) : add(l, r)))),
      variable
    );
  }
  // Against a constant, f − c = c(f/c − 1) ~ c(ln f − ln c),
  // and the logarithm taken apart structurally can see past the cancelling:
  // x^x − 1 ~ x ln x at 0.
  const constantSide = !dependsOn(right, variable)
    ? { f: left, c: X.negate(q.c) }
    : !dependsOn(left, variable)
      ? { f: right, c: X.negate(p.c), flip: negated }
      : undefined;
  if (constantSide === undefined || sign(constantSide.c) <= 0) return undefined;
  const log = logNode(constantSide.f);
  if (log === undefined) return undefined;
  const lnC = call("ln", X.toNode(constantSide.c));
  const inner = sizeOf(fold(subtract(log, lnC)), variable);
  if (inner === undefined) return undefined;
  const scaled = X.multiply(inner.c, constantSide.c);
  return {
    ...inner,
    c: "flip" in constantSide && constantSide.flip ? X.negate(scaled) : scaled,
  };
}

/** `ln(A ± B)` as `ln A + ln(1 ± B/A)` with A the bigger term, written out. */
function openedLogarithm(node: Node, variable: string): Node | undefined {
  if (
    node.type !== "FunctionCall" ||
    node.callee.symbol !== "ln" ||
    node.args.length !== 1
  )
    return undefined;
  const [inside] = node.args;
  if (
    inside.type !== "BinaryOperator" ||
    (inside.name !== "Add" && inside.name !== "Subtract")
  )
    return undefined;
  const p = sizeOf(inside.left, variable);
  const q = sizeOf(inside.right, variable);
  if (p === undefined || q === undefined) return undefined;
  const inverse = raised(q, Q.rational(-1n));
  const ratio = inverse && times(p, inverse, variable);
  const to = ratio && limitOfSize(ratio, variable);
  if (to === undefined) return undefined;
  const leftBigger = to.kind === "infinite";
  if (
    !leftBigger &&
    !(to.kind === "finite" && certainlyZero(to.value) === true)
  )
    return undefined;
  const [big, small] = leftBigger
    ? [inside.left, inside.right]
    : [inside.right, inside.left];
  const smallSigned =
    inside.name === "Subtract" && leftBigger
      ? multiply(numberNode(-1), small)
      : small;
  // A − B with B the bigger is negative, and its logarithm is not real.
  if (inside.name === "Subtract" && !leftBigger) return undefined;
  if (!(evaluate(big, { [variable]: 1e6 }) > 0)) return undefined;
  const lead = logNode(big) ?? call("ln", big);
  return add(lead, call("ln", add(numberNode(1), divide(smallSigned, big))));
}

/**
 * `ln f` written out where the structure allows it: `ln e^u = u`,
 * `ln aᵘ = u ln a`, `ln(AB) = ln A + ln B`, `ln(A/B) = ln A − ln B`. Each
 * holds wherever f is positive, which the callers have checked.
 */
function logNode(f: Node): Node | undefined {
  if (f.type === "BinaryOperator") {
    if (f.name === "Exponent")
      return f.left.type === "Identifier" && f.left.symbol === "e"
        ? f.right
        : multiply(f.right, call("ln", f.left));
    if (f.name === "Multiply" || f.name === "CrossMultiply")
      return add(call("ln", f.left), call("ln", f.right));
    if (f.name === "Divide")
      return subtract(call("ln", f.left), call("ln", f.right));
  }
  if (f.type === "FunctionCall" && f.callee.symbol === "exp") return f.args[0];
  return undefined;
}

function exponential(
  base: Node,
  exponent: Node,
  variable: string
): Size | undefined {
  if (!dependsOn(exponent, variable)) {
    const r = X.asRational(exactConstant(exponent) ?? []);
    const inner = r && sizeOf(base, variable);
    return r && inner && raised(inner, r);
  }
  if (base.type === "Identifier" && base.symbol === "e")
    return withExponential(ONE(), exponent, variable);
  // a^u = e^{u ln a}, for a base that stays positive.
  if (!(evaluate(base, { [variable]: 1e6 }) > 0)) return undefined;
  return withExponential(
    ONE(),
    fold(multiply(exponent, call("ln", base))),
    variable
  );
}

/** Near zero, each of these is its argument to first order. */
const LIKE_ARGUMENT_AT_ZERO = [
  "sin",
  "tan",
  "arcsin",
  "arctan",
  "sinh",
  "tanh",
  "arcsinh",
  "arctanh",
];

function functionSize(
  node: Node & { type: "FunctionCall" },
  variable: string
): Size | undefined {
  if (node.args.length !== 1) return undefined;
  const [arg] = node.args;
  const name = node.callee.symbol;
  switch (name) {
    case "exp":
      return withExponential(ONE(), arg, variable);
    case "sqrt": {
      const inner = sizeOf(arg, variable);
      return inner && raised(inner, Q.rational(1n, 2n));
    }
    case "ln":
      return logarithm(arg, variable);
    case "log": {
      const inner = logarithm(arg, variable);
      const ln10 = exactConstant(call("ln", numberNode(10)));
      const scale = ln10 && X.divide(X.fromInteger(1), ln10);
      return inner && scale && times(inner, constant(scale), variable);
    }
    case "abs": {
      const inner = sizeOf(arg, variable);
      return (
        inner && {
          ...inner,
          c: sign(inner.c) < 0 ? X.negate(inner.c) : inner.c,
        }
      );
    }
    default:
      break;
  }
  // Everything else is measured by where its argument goes.
  const to = limitAtInfinity(arg, variable);
  if (to === undefined) return undefined;
  if (
    to.kind === "finite" &&
    certainlyZero(to.value) === true &&
    LIKE_ARGUMENT_AT_ZERO.includes(name)
  )
    return sizeOf(arg, variable);
  // sinh and cosh at infinity grow like e^{|u|}/2.
  if (to.kind === "infinite" && (name === "sinh" || name === "cosh")) {
    const half = X.fromRational(
      Q.rational(to.sign > 0 || name === "cosh" ? 1n : -1n, 2n)
    );
    const grows = to.sign > 0 ? arg : fold(multiply(numberNode(-1), arg));
    return withExponential(constant(half), grows, variable);
  }
  // The rest only have a size when they settle on something other than 0.
  const whole = limitAtInfinity(node, variable);
  return whole?.kind === "finite" && certainlyZero(whole.value) === false
    ? constant(whole.value)
    : undefined;
}

/**
 * `ln f` for `f ~ c tᵃ (ln t)ᵇ e^{E}`: `E` if there is one, else `a ln t`,
 * else `ln c`. With `c = 1` and nothing else, `ln f → 0` and its size is
 * that of `f − 1`.
 */
function logarithm(arg: Node, variable: string): Size | undefined {
  // An exponential's logarithm is its exponent, measured directly; measuring
  // e^{E} first would fold a vanishing E into the constant and lose it.
  const isExponential =
    (arg.type === "BinaryOperator" &&
      arg.name === "Exponent" &&
      dependsOn(arg.right, variable)) ||
    (arg.type === "FunctionCall" && arg.callee.symbol === "exp");
  const written = isExponential ? logNode(arg) : undefined;
  if (written !== undefined) return sizeOf(fold(written), variable);
  const inner = sizeOf(arg, variable);
  if (inner === undefined || sign(inner.c) <= 0) return undefined;
  if (inner.E !== undefined) return sizeOf(inner.E, variable);
  if (!Q.isZero(inner.a))
    return { c: X.fromRational(inner.a), a: Q.ZERO, b: Q.ONE };
  // b ln ln t: a size this scale has no name for.
  if (!Q.isZero(inner.b)) return undefined;
  const ln = exactConstant(call("ln", X.toNode(inner.c)));
  if (ln === undefined) return undefined;
  if (certainlyZero(ln) === false) return constant(ln);
  return sizeOf(
    fold(collectLikeTerms(fold(subtract(arg, numberNode(1))))),
    variable
  );
}
