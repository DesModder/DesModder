/**
 * Limits, as the Limit tab asks for them.
 *
 * The engine is `limitOf` in `definite.ts`, which already had to exist for
 * improper integrals. What this adds is what a course asks of a limit that an
 * integral never did:
 *
 * - **Both sides.** An improper integral only ever approaches a bound from
 *   inside the interval. A limit at a point is two one-sided limits, and it
 *   exists only when they agree: `|x|/x` at 0 is -1 from the left and 1 from
 *   the right, and the answer is that there is no limit — with both sides
 *   shown, because they are the reason.
 * - **The form.** `0/0` and `1^∞` are what a student is taught to recognise
 *   before choosing a method, so the form is reported as a fact about the
 *   expression, read off the limits of its parts.
 * - **L'Hôpital's rule.** The series engine answers `sin(x)/x` without it, and
 *   a course answers it with it. For `0/0` and `∞/∞` the rule is applied for
 *   real — the derivatives are taken and the new quotient's limit is found —
 *   and the result must agree with the engine's own answer when there is one.
 *   A disagreement is a refusal, not a choice between them.
 * - **"Does not exist" as an answer.** `sin(1/x)` at 0 has no limit, and that
 *   can be proved rather than merely failed at: its argument runs off to
 *   infinity continuously, so it passes through every value in every
 *   neighbourhood and the sine takes both -1 and 1 there.
 *
 * Every answer is checked numerically before it is shown, the way every
 * antiderivative is differentiated back, and with the same three verdicts.
 */
import {
  dependsOn,
  differentiate,
  divide,
  evaluate,
  negative,
  number as numberNode,
  replaceSubtree,
  SymbolicError,
  visit,
  type Node,
} from "../../../symbolic";
import * as X from "./exact";
import {
  limitOf,
  type Approach,
  type Bound,
  type Limit,
  type LimitTechnique,
} from "./definite";

/** Which way a limit at a point is taken. Ignored at an infinity. */
export type LimitSide = "both" | "left" | "right";

/**
 * An indeterminate form, as it is written: the thing a student recognises
 * before choosing a method.
 */
export type IndeterminateForm =
  | "0/0"
  | "inf/inf"
  | "0*inf"
  | "inf-inf"
  | "1^inf"
  | "0^0"
  | "inf^0";

/** One application of L'Hôpital's rule: the new numerator and denominator. */
export interface LHopitalStep {
  numerator: Node;
  denominator: Node;
}

/** How the answer was reached, for saying so. */
export interface LimitMethod {
  techniques: readonly LimitTechnique[];
  /** The applications of L'Hôpital's rule, in order; empty when not used. */
  lhopital: readonly LHopitalStep[];
  /** Whether an absolute value was written out for the side approached. */
  absolute: boolean;
}

export type LimitAnswer =
  | { kind: "value"; limit: Limit; method: LimitMethod }
  /** The two one-sided limits exist and differ. */
  | { kind: "sides-differ"; left: Limit; right: Limit }
  /** An oscillation that provably has no limit. */
  | { kind: "oscillates" }
  /** Nothing here could decide it. */
  | { kind: "unknown"; left?: Limit; right?: Limit };

export interface LimitResult {
  answer: LimitAnswer;
  /** The indeterminate form at the approach, when there is one. */
  form?: IndeterminateForm;
}

/** The most applications of L'Hôpital's rule tried before giving up on it. */
const LHOPITAL_LIMIT = 4;

/**
 * `lim f` as the variable approaches `at` from `side`.
 *
 * At an infinity the side is meaningless and ignored. At a point, "both" is
 * the two one-sided limits compared; a single side is that side alone.
 */
export function findLimit(
  node: Node,
  variable: string,
  at: Bound,
  side: LimitSide
): LimitResult {
  if (at.kind === "infinite") {
    const approach: Approach = { kind: "infinite", sign: at.sign };
    return oneSided(node, variable, approach);
  }
  const from = (s: 1 | -1): Approach => ({
    kind: "point",
    node: at.node,
    value: at.value,
    side: s,
  });
  if (side === "right") return oneSided(node, variable, from(1));
  if (side === "left") return oneSided(node, variable, from(-1));

  const right = oneSided(node, variable, from(1));
  const left = oneSided(node, variable, from(-1));
  const form = right.form ?? left.form;
  const r = right.answer;
  const l = left.answer;
  if (r.kind === "oscillates" || l.kind === "oscillates")
    return { answer: { kind: "oscillates" }, form };
  if (r.kind === "value" && l.kind === "value") {
    if (sameLimit(r.limit, l.limit)) return { answer: r, form };
    return {
      answer: { kind: "sides-differ", left: l.limit, right: r.limit },
      form,
    };
  }
  return {
    answer: {
      kind: "unknown",
      left: l.kind === "value" ? l.limit : undefined,
      right: r.kind === "value" ? r.limit : undefined,
    },
    form,
  };
}

function sameLimit(a: Limit, b: Limit): boolean {
  if (a.kind === "infinite") return b.kind === "infinite" && a.sign === b.sign;
  if (b.kind === "infinite") return false;
  return X.subtract(a.value, b.value).length === 0;
}

function oneSided(
  original: Node,
  variable: string,
  approach: Approach
): LimitResult {
  const node = resolveAbsolute(original, variable, approach);
  const absolute = node !== original;
  const form = formOf(node, variable, approach);

  if (oscillates(node, variable, approach))
    return { answer: { kind: "oscillates" }, form };

  const techniques: LimitTechnique[] = [];
  const direct = limitOf(node, variable, approach, (t) => techniques.push(t));
  // Recorded innermost first; read outermost first.
  techniques.reverse();

  // A rational function at infinity is answered by its leading terms, which
  // is how a course answers it too. L'Hôpital would get there, by applying
  // itself once per degree, and that is not a method anyone would choose.
  const byLeadingTerms =
    techniques.length > 0 &&
    techniques.every((t) => t === "leading-terms" || t === "substitution");

  // The rule a course would use, applied for real. It is tried whenever the
  // form allows it, and kept only if it reaches the same answer as the engine
  // — or the only answer, when the engine has none.
  if (
    !byLeadingTerms &&
    (form === "0/0" || form === "inf/inf") &&
    node.type === "BinaryOperator" &&
    node.name === "Divide"
  ) {
    const viaRule = lHopital(node, variable, approach);
    if (viaRule !== undefined) {
      if (direct !== undefined && !sameLimit(direct, viaRule.limit))
        return { answer: { kind: "unknown" }, form };
      return {
        answer: {
          kind: "value",
          limit: viaRule.limit,
          method: { ...viaRule, absolute },
        },
        form,
      };
    }
  }

  if (direct === undefined) return { answer: { kind: "unknown" }, form };
  return {
    answer: {
      kind: "value",
      limit: direct,
      method: { techniques, lhopital: [], absolute },
    },
    form,
  };
}

/**
 * `|g|` and `sign(g)` near a one-sided approach, where `g` keeps one sign:
 * `±g` and `±1`. That is what the absolute value *is* on one side of a
 * point, and it is the step that turns `|x|/x` into `x/x` from the right and
 * `-x/x` from the left.
 *
 * The sign is read at several distances rather than one, because a `g` that
 * changes sign arbitrarily close to the point (`x sin(1/x)`) has no one sign
 * to replace it with, and is left alone.
 */
function resolveAbsolute(
  node: Node,
  variable: string,
  approach: Approach
): Node {
  const found: (Node & { type: "FunctionCall" })[] = [];
  visit(node, (child) => {
    if (
      child.type === "FunctionCall" &&
      child.args.length === 1 &&
      (child.callee.symbol === "abs" || child.callee.symbol === "sign") &&
      dependsOn(child.args[0], variable)
    )
      found.push(child);
  });
  let out = node;
  for (const target of found) {
    const [inner] = target.args;
    const signs = new Set(
      [1, 10, 100, 1000].map((scale) =>
        Math.sign(evaluate(inner, { [variable]: nearAt(approach, scale) }))
      )
    );
    if (signs.size !== 1) continue;
    const [s] = [...signs];
    if (s !== 1 && s !== -1) continue;
    const replacement =
      target.callee.symbol === "sign"
        ? numberNode(s)
        : s > 0
          ? inner
          : negative(inner);
    out = replaceSubtree(out, target, replacement);
  }
  return out;
}

/** A point near the approach; larger scales are further away. */
function nearAt(approach: Approach, scale: number): number {
  return approach.kind === "infinite"
    ? approach.sign * 1e5 * scale
    : approach.value + approach.side * 1e-8 * scale;
}

/**
 * The indeterminate form at the approach, read off the limits of the parts.
 * Undefined when the parts have limits that are not a form, or when a part
 * has no limit anyone found.
 */
export function formOf(
  node: Node,
  variable: string,
  approach: Approach
): IndeterminateForm | undefined {
  if (node.type === "Negative") return formOf(node.arg, variable, approach);
  if (node.type !== "BinaryOperator") return undefined;
  const part = (n: Node) => limitOf(n, variable, approach);
  const isZero = (l: Limit | undefined) =>
    l?.kind === "finite" && l.value.length === 0;
  const isOne = (l: Limit | undefined) =>
    l?.kind === "finite" && X.subtract(l.value, X.fromInteger(1)).length === 0;
  const isInfinite = (l: Limit | undefined) => l?.kind === "infinite";
  switch (node.name) {
    case "Divide": {
      const top = part(node.left);
      const bottom = part(node.right);
      if (isZero(top) && isZero(bottom)) return "0/0";
      if (isInfinite(top) && isInfinite(bottom)) return "inf/inf";
      return undefined;
    }
    case "Multiply":
    case "CrossMultiply": {
      const a = part(node.left);
      const b = part(node.right);
      if ((isZero(a) && isInfinite(b)) || (isInfinite(a) && isZero(b)))
        return "0*inf";
      return undefined;
    }
    case "Add":
    case "Subtract": {
      const a = part(node.left);
      const b = part(node.right);
      if (a?.kind !== "infinite" || b?.kind !== "infinite") return undefined;
      const flip = node.name === "Subtract" ? -1 : 1;
      return a.sign !== b.sign * flip ? "inf-inf" : undefined;
    }
    case "Exponent": {
      if (!dependsOn(node.right, variable)) return undefined;
      const base = part(node.left);
      const exponent = part(node.right);
      if (isOne(base) && isInfinite(exponent)) return "1^inf";
      if (isZero(base) && isZero(exponent)) return "0^0";
      if (base?.kind === "infinite" && base.sign > 0 && isZero(exponent))
        return "inf^0";
      return undefined;
    }
  }
  return undefined;
}

/**
 * L'Hôpital's rule, applied until the quotient stops being `0/0` or `∞/∞`
 * and its limit can be found — or until it has been applied
 * {@link LHOPITAL_LIMIT} times, which is where it has stopped helping:
 * `e^x/x^{10}` needs ten, and the engine answers it directly by growth.
 */
function lHopital(
  node: Node & { type: "BinaryOperator" },
  variable: string,
  approach: Approach
): (Omit<LimitMethod, "absolute"> & { limit: Limit }) | undefined {
  const steps: LHopitalStep[] = [];
  let top: Node = node.left;
  let bottom: Node = node.right;
  for (let round = 0; round < LHOPITAL_LIMIT; round++) {
    try {
      top = differentiate(top, variable);
      bottom = differentiate(bottom, variable);
    } catch (error) {
      if (error instanceof SymbolicError) return undefined;
      throw error;
    }
    steps.push({ numerator: top, denominator: bottom });
    const quotient = divide(top, bottom);
    const form = formOf(quotient, variable, approach);
    if (form === "0/0" || form === "inf/inf") continue;
    const techniques: LimitTechnique[] = [];
    const limit = limitOf(quotient, variable, approach, (t) =>
      techniques.push(t)
    );
    if (limit === undefined) return undefined;
    return { limit, techniques: [...techniques].reverse(), lhopital: steps };
  }
  return undefined;
}

/**
 * Whether the expression is a sine or cosine of something that runs off to
 * an infinity, which provably has no limit.
 *
 * Provably, not probably: the argument is continuous near the approach and
 * unbounded there, so in every neighbourhood it passes through a whole
 * period, and the function takes both -1 and 1 however close you look. A
 * constant factor in front changes nothing, so it is looked through.
 */
function oscillates(node: Node, variable: string, approach: Approach): boolean {
  let inner = node;
  if (inner.type === "Negative") inner = inner.arg;
  if (
    inner.type === "BinaryOperator" &&
    inner.name === "Multiply" &&
    !dependsOn(inner.left, variable) &&
    Number.isFinite(evaluate(inner.left, {})) &&
    evaluate(inner.left, {}) !== 0
  )
    inner = inner.right;
  if (
    inner.type !== "FunctionCall" ||
    inner.args.length !== 1 ||
    !["sin", "cos"].includes(inner.callee.symbol)
  )
    return false;
  const argument = limitOf(inner.args[0], variable, approach);
  return argument?.kind === "infinite";
}

// ---- checking ----------------------------------------------------------------

/**
 * Whether the function's values near the approach agree with the limit.
 *
 * Three verdicts, the way an antiderivative's check has three:
 *
 * - `checked`: the values close in on it.
 * - `unchecked`: they neither close in nor settle somewhere else within the
 *   distances floating point can reach. `1/ln x → 0` at infinity is true and
 *   is still 0.05 at 10⁸; saying it was checked would be a lie, and calling
 *   it wrong would be a worse one.
 * - `wrong`: the values settle, and not on the answer.
 *
 * Distances run from far to near. Floating point stops helping before the
 * point itself — `(1 - cos x)/x²` at 10⁻⁸ is all rounding — so what counts is
 * the best agreement at any distance, not the agreement at the last.
 */
export function checkLimit(
  node: Node,
  variable: string,
  approach: Approach,
  limit: Limit
): "checked" | "unchecked" | "wrong" {
  const values: number[] = [];
  for (let k = 1; k <= 8; k++) {
    const at =
      approach.kind === "infinite"
        ? approach.sign * 10 ** k
        : approach.value + approach.side * 10 ** -k;
    const v = evaluate(node, { [variable]: at });
    if (!Number.isNaN(v)) values.push(v);
  }
  if (values.length < 3) return "unchecked";

  if (limit.kind === "infinite") {
    const tail = values.slice(-4);
    const rightSign = tail.every((v) => Math.sign(v) === limit.sign);
    const growing = tail.every(
      (v, i) => i === 0 || Math.abs(v) >= Math.abs(tail[i - 1])
    );
    if (rightSign && growing && Math.abs(tail[tail.length - 1]) > 10)
      return "checked";
    return settled(values) ? "wrong" : "unchecked";
  }

  const target = X.toNumber(limit.value);
  const scale = Math.max(1, Math.abs(target));
  const errors = values.map((v) => Math.abs(v - target));
  if (Math.min(...errors) <= 1e-5 * scale) return "checked";
  // Closing in, if slowly: each step at least halves the distance.
  const last = errors.slice(-4);
  if (last.every((e, i) => i === 0 || e <= last[i - 1] / 2)) return "checked";
  if (settled(values) && errors[errors.length - 1] > 1e-3 * scale)
    return "wrong";
  return "unchecked";
}

/** Whether the last few values have stopped moving. */
function settled(values: readonly number[]): boolean {
  const tail = values.slice(-3);
  if (tail.length < 3 || !tail.every(Number.isFinite)) return false;
  const size = Math.max(1, ...tail.map(Math.abs));
  return (
    Math.abs(tail[2] - tail[1]) <= 1e-9 * size &&
    Math.abs(tail[1] - tail[0]) <= 1e-7 * size
  );
}

/**
 * The sentence naming how a limit was found, from what was recorded. Direct
 * substitution is named only when it was all there was — every limit
 * substitutes somewhere inside it.
 */
export function describeLimitMethod(method: LimitMethod): string {
  const names: Record<LimitTechnique, string> = {
    substitution: "Direct substitution",
    "leading-terms": "Leading terms",
    "exp-log": "Rewritten as an exponential of a logarithm",
    series: "Series expansion",
    growth: "Growth rates",
    squeeze: "Squeeze theorem",
    "dominant-term": "Factoring out the dominant term",
    "one-sided": "Sign of the side it is approached from",
    "end-behaviour": "End behaviour",
  };
  const distinct = method.techniques.filter(
    (t, i) => method.techniques.indexOf(t) === i
  );
  const substantial = distinct.filter((t) => t !== "substitution");
  const listed = (substantial.length > 0 ? substantial : distinct).map(
    (t) => names[t]
  );
  const rounds = method.lhopital.length;
  if (rounds > 0) {
    const times =
      rounds === 1
        ? ""
        : rounds === 2
          ? ", applied twice"
          : `, applied ${rounds} times`;
    // After the rule, a substitution is how it ends and says nothing.
    listed.unshift(`L'Hôpital's rule${times}`);
    if (substantial.length === 0) listed.splice(1);
  }
  if (method.absolute)
    listed.unshift("Absolute value written out for this side");
  return listed
    .map((name, i) =>
      i === 0 ? name : name.charAt(0).toLowerCase() + name.slice(1)
    )
    .join(", then ");
}
