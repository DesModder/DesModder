/**
 * Limits, decided with proofs.
 *
 * The engine is `limitOf` in `definite.ts`, which improper integrals needed
 * first. This is what a limit asks of it beyond that, and the standard is a
 * mathematician's rather than a syllabus's: every outcome here is proved, and
 * sampling is used only to check.
 *
 * - **Sides.** A limit at a point is two one-sided limits, each taken on its
 *   own. On one side `|g|`, `sign g`, `⌊g⌋`, `⌈g⌉`, `round g` and a piecewise
 *   function are each a single formula, because the sign of whatever decides
 *   them is fixed there — and that sign is proved (`eventualSign`), never read
 *   off a few sample points.
 * - **Domain.** A side the function does not live on is not approached at
 *   all: `√x` has no left side at 0. That is its own outcome, distinct from a
 *   limit that fails to exist, and how the two sides then combine is a
 *   convention the caller chooses.
 * - **Non-existence.** Different one-sided limits prove there is no limit.
 *   So does an oscillation, proved by construction: `A(x)·sin(g(x)) + r(x)`
 *   with `g` continuous and unbounded passes through `g = π/2 + 2πn` and
 *   `g = 3π/2 + 2πn` arbitrarily close to the point, where the values tend to
 *   `r ± A` — two different numbers, or, when `A` is unbounded, nowhere.
 * - **L'Hôpital's rule**, applied for real and guarded: its hypotheses are
 *   checked at every application, and it stops as soon as it repeats itself
 *   or the expression grows, because there is no measure that makes repeated
 *   differentiation terminate in general. Its answer must agree with the
 *   engine's own when both exist.
 */
import {
  decimalContext,
  dependsOn,
  differentiate,
  evaluatePrecise,
  type Decimal,
  divide,
  evaluate,
  exceedsNodeCount,
  fold,
  negative,
  nodeCount,
  number as numberNode,
  quotientFactors,
  subtract,
  SymbolicError,
  topLevelTerms,
  visit,
  type Node,
} from "../../../symbolic";
import * as X from "./exact";
import * as Q from "./rational";
import {
  certainlyZero,
  eventualSign,
  exactConstant,
  limitOf,
  type Approach,
  type Bound,
  type Limit,
  type LimitTechnique,
} from "./definite";

/** Which way a limit at a point is taken. Ignored at an infinity. */
export type LimitSide = "both" | "left" | "right";

/**
 * What a two-sided limit means when the function lives on one side only.
 *
 * `bilateral`, the default: a two-sided limit needs both sides, so `√x` at 0
 * has a right-hand limit and no two-sided one. `domain`: the limit is taken
 * through the points of the domain, so `√x → 0` there. Both are conventions a
 * textbook uses, and neither is imposed.
 */
export type EndpointConvention = "bilateral" | "domain";

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

/**
 * One piece of the expression replaced by what it is on the side approached:
 * `|x|` by `-x` from the left, a piecewise function by its branch. Kept so the
 * explanation can say so, since it is the step the whole answer rests on.
 */
export interface Resolution {
  kind: "abs" | "sign" | "floor" | "ceil" | "round" | "piecewise";
  before: Node;
  after: Node;
}

/** How the answer was reached, for saying so. */
export interface LimitMethod {
  techniques: readonly LimitTechnique[];
  /** The applications of L'Hôpital's rule, in order; empty when not used. */
  lhopital: readonly LHopitalStep[];
  /** What was written out for the side approached. */
  resolutions: readonly Resolution[];
  /** The expression after those were written out. */
  resolved: Node;
}

/**
 * The proof that there is no limit because of an oscillation: the term
 * `amplitude · f(argument)` with `f` sine or cosine, plus whatever else
 * tends to `rest`.
 */
export interface OscillationProof {
  fn: "sin" | "cos";
  argument: Node;
  /** Where the argument goes: +∞ or -∞. */
  argumentSign: 1 | -1;
  /** The factor in front: a non-zero number, or an infinity. */
  amplitude: Limit;
  /** What the other terms tend to. */
  rest: Limit;
}

/** What one side comes to. */
export type SideOutcome =
  | { kind: "value"; limit: Limit; method: LimitMethod }
  | { kind: "oscillates"; proof: OscillationProof }
  /** The function has no points on this side near the point. */
  | { kind: "no-approach"; reason: string }
  | { kind: "unknown" };

export type LimitAnswer =
  | {
      kind: "value";
      limit: Limit;
      method: LimitMethod;
      /**
       * The one side the answer comes from, when only one was taken: asked
       * for, or the only one the function lives on under the domain
       * convention.
       */
      side?: 1 | -1;
      /** Set when the other side was not there and the convention allowed it. */
      withinDomain?: boolean;
    }
  /** The two one-sided limits exist and differ. */
  | { kind: "sides-differ"; left: Limit; right: Limit }
  /** An oscillation that provably has no limit. */
  | { kind: "oscillates"; proof: OscillationProof; side?: 1 | -1 }
  /**
   * Only one side exists, and the convention asks for both: the one-sided
   * limit is given, and there is no two-sided one.
   */
  | {
      kind: "one-side-only";
      side: 1 | -1;
      limit: Limit;
      method: LimitMethod;
      missing: string;
    }
  /** The function is not defined near the point on the side(s) asked for. */
  | { kind: "no-approach"; reason: string }
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
  side: LimitSide,
  convention: EndpointConvention = "bilateral"
): LimitResult {
  if (at.kind === "infinite") {
    const approach: Approach = { kind: "infinite", sign: at.sign };
    return single(oneSided(node, variable, approach), undefined);
  }
  const from = (s: 1 | -1): Approach => ({
    kind: "point",
    node: at.node,
    value: at.value,
    side: s,
  });
  if (side !== "both") {
    const s = side === "right" ? 1 : -1;
    return single(oneSided(node, variable, from(s)), s);
  }

  const right = oneSided(node, variable, from(1));
  const left = oneSided(node, variable, from(-1));
  const form = right.form ?? left.form;
  const r = right.outcome;
  const l = left.outcome;

  if (r.kind === "no-approach" && l.kind === "no-approach")
    return { answer: { kind: "no-approach", reason: r.reason }, form };
  // Only one side is there: which convention is in force decides whether its
  // limit is the limit.
  if (r.kind === "no-approach" || l.kind === "no-approach") {
    const [present, s, missing] =
      r.kind === "no-approach"
        ? [l, -1 as const, r.reason]
        : [r, 1 as const, (l as { reason: string }).reason];
    if (present.kind === "value") {
      if (convention === "domain")
        return {
          answer: { ...present, kind: "value", side: s, withinDomain: true },
          form,
        };
      return {
        answer: {
          kind: "one-side-only",
          side: s,
          limit: present.limit,
          method: present.method,
          missing,
        },
        form,
      };
    }
    if (present.kind === "oscillates")
      return {
        answer: { kind: "oscillates", proof: present.proof, side: s },
        form,
      };
    return { answer: { kind: "unknown" }, form };
  }
  if (r.kind === "oscillates") return { answer: r, form };
  if (l.kind === "oscillates") return { answer: l, form };
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

function single(
  { outcome, form }: { outcome: SideOutcome; form?: IndeterminateForm },
  side: 1 | -1 | undefined
): LimitResult {
  switch (outcome.kind) {
    case "value":
      return { answer: { ...outcome, side }, form };
    case "oscillates":
      return { answer: { ...outcome, side }, form };
    default:
      return { answer: outcome, form };
  }
}

export function sameLimit(a: Limit, b: Limit): boolean {
  if (a.kind === "infinite") return b.kind === "infinite" && a.sign === b.sign;
  if (b.kind === "infinite") return false;
  return certainlyZero(X.subtract(a.value, b.value)) === true;
}

function oneSided(
  original: Node,
  variable: string,
  approach: Approach
): { outcome: SideOutcome; form?: IndeterminateForm } {
  const resolutions: Resolution[] = [];
  const node = resolveSide(original, variable, approach, resolutions);

  const domain = domainOnSide(node, variable, approach);
  if (domain !== undefined)
    return { outcome: { kind: "no-approach", reason: domain } };

  const form = formOf(node, variable, approach);

  const oscillation = oscillationOf(node, variable, approach);
  if (oscillation !== undefined)
    return { outcome: { kind: "oscillates", proof: oscillation }, form };

  const techniques: LimitTechnique[] = [];
  const direct = limitOf(node, variable, approach, (t) => techniques.push(t));
  // Recorded innermost first; read outermost first.
  techniques.reverse();
  const method = (
    used: readonly LimitTechnique[],
    lhopital: readonly LHopitalStep[]
  ): LimitMethod => ({
    techniques: used,
    lhopital,
    resolutions,
    resolved: node,
  });

  // A rational function at infinity is answered by its leading terms, which
  // is how a course answers it too. L'Hôpital would get there, by applying
  // itself once per degree, and that is not a method anyone would choose.
  const byLeadingTerms =
    techniques.length > 0 &&
    techniques.every((t) => t === "leading-terms" || t === "substitution");

  // The rule a course would use, applied for real. It is tried whenever the
  // form allows it, and kept only if it reaches the same answer as the engine
  // -- or the only answer, when the engine has none.
  if (
    !byLeadingTerms &&
    (form === "0/0" || form === "inf/inf") &&
    node.type === "BinaryOperator" &&
    node.name === "Divide"
  ) {
    const found = lHopital(node, variable, approach);
    // Kept only where it made the problem easier. A quotient that still needs
    // a series to finish was not simplified by the rule -- √(x²+1)/x becomes
    // x/√(x²+1), the same difficulty upside down -- and the direct route is
    // the honest one to show.
    const viaRule =
      found !== undefined &&
      direct !== undefined &&
      found.techniques.includes("series")
        ? undefined
        : found;
    if (viaRule !== undefined) {
      if (direct !== undefined && !sameLimit(direct, viaRule.limit))
        return { outcome: { kind: "unknown" }, form };
      return {
        outcome: {
          kind: "value",
          limit: viaRule.limit,
          method: method(viaRule.techniques, viaRule.lhopital),
        },
        form,
      };
    }
  }

  if (direct === undefined) return { outcome: { kind: "unknown" }, form };
  return {
    outcome: { kind: "value", limit: direct, method: method(techniques, []) },
    form,
  };
}

// ---- one side at a time ------------------------------------------------------

/**
 * The expression as it is on the side approached: every absolute value,
 * sign, floor, ceiling, rounding and piecewise choice written as the single
 * formula it is there. Anything whose deciding sign is not proved is left
 * alone, and the limit engine will then not decide the whole either.
 */
function resolveSide(
  node: Node,
  variable: string,
  approach: Approach,
  out: Resolution[]
): Node {
  const again = (n: Node) => resolveSide(n, variable, approach, out);
  const signOf = (n: Node) => eventualSign(n, variable, approach);
  switch (node.type) {
    case "Negative":
      return negative(again(node.arg));
    case "BinaryOperator": {
      const rebuilt: Node = {
        ...node,
        left: again(node.left),
        right: again(node.right),
      };
      return rebuilt;
    }
    case "Piecewise": {
      if (!dependsOn(node, variable)) return node;
      const holds =
        node.condition === true
          ? true
          : conditionOnSide(node.condition, variable, approach);
      if (holds === undefined) return node;
      const chosen = holds ? node.consequent : node.alternate;
      out.push({ kind: "piecewise", before: node, after: chosen });
      return again(chosen);
    }
    case "FunctionCall": {
      const args = node.args.map(again);
      const rebuilt: Node & { type: "FunctionCall" } = { ...node, args };
      if (args.length !== 1 || !dependsOn(args[0], variable)) return rebuilt;
      const [inner] = args;
      const name = rebuilt.callee.symbol;
      const record = (kind: Resolution["kind"], after: Node) => {
        out.push({ kind, before: rebuilt, after });
        return after;
      };
      if (name === "abs") {
        const s = signOf(inner);
        if (s === 1) return record("abs", inner);
        if (s === -1) return record("abs", negative(inner));
        if (s === 0) return record("abs", numberNode(0));
        return rebuilt;
      }
      if (name === "sign") {
        const s = signOf(inner);
        return s === undefined ? rebuilt : record("sign", numberNode(s));
      }
      if (name === "floor" || name === "ceil" || name === "round") {
        const step = integerStep(name, inner, variable, approach);
        return step === undefined ? rebuilt : record(name, numberNode(step));
      }
      return rebuilt;
    }
    default:
      return node;
  }
}

/**
 * The constant value of `⌊g⌋`, `⌈g⌉` or `round g` on the side approached,
 * when `g` has a finite limit there. Away from a jump it is the function of
 * the limit; at a jump, the side `g` arrives from — proved by the sign of
 * `g − m` — picks between the two values.
 */
function integerStep(
  name: "floor" | "ceil" | "round",
  inner: Node,
  variable: string,
  approach: Approach
): number | undefined {
  const found = limitOf(inner, variable, approach);
  if (found?.kind !== "finite") return undefined;
  const value = X.toNumber(found.value);
  // Where the jumps are: integers for floor and ceiling, half-integers for
  // rounding.
  const offset = name === "round" ? 0.5 : 0;
  const jump = Math.round(value - offset) + offset;
  const exactJump = X.fromRational(
    Q.divide(Q.rational(BigInt(Math.round(2 * jump))), Q.rational(2n))
  );
  const atJump = certainlyZero(X.subtract(found.value, exactJump));
  if (atJump === undefined) return undefined;
  const fn = { floor: Math.floor, ceil: Math.ceil, round: Math.round }[name];
  if (!atJump) {
    // Comfortably between jumps: the function is constant near the point.
    return Math.abs(value - jump) > 1e-9 ? fn(value) : undefined;
  }
  const s = eventualSign(
    subtract(inner, X.toNode(exactJump)),
    variable,
    approach
  );
  if (s === undefined) return undefined;
  if (s === 0) return fn(jump);
  // Arriving from above the jump or from below it.
  const below = jump - 0.5;
  const above = jump + 0.5;
  return fn(s > 0 ? above : below);
}

/**
 * Whether a piecewise condition holds on the whole side approached, proved
 * from the sign of `left − right` for each comparison in it. Undefined when a
 * sign is not proved — `sin(1/x) > 0` changes its answer infinitely often at
 * 0, and no branch is chosen for it.
 */
function conditionOnSide(
  condition: Node,
  variable: string,
  approach: Approach
): boolean | undefined {
  const links: [Node, string, Node][] =
    condition.type === "Comparator"
      ? [[condition.left, condition.operator, condition.right]]
      : condition.type === "ComparatorChain"
        ? condition.symbols.map((symbol, i) => [
            condition.args[i],
            symbol,
            condition.args[i + 1],
          ])
        : [];
  if (links.length === 0) return undefined;
  let all = true;
  for (const [left, operator, right] of links) {
    const s = eventualSign(subtract(left, right), variable, approach);
    if (s === undefined) return undefined;
    const holds = {
      "<": s < 0,
      "<=": s <= 0,
      "=": s === 0,
      ">=": s >= 0,
      ">": s > 0,
    }[operator];
    if (holds === undefined) return undefined;
    all = all && holds;
  }
  return all;
}

/**
 * Why the function has no points on the side approached, or undefined when
 * it has them or that is not decided.
 *
 * A square root of something eventually negative, a logarithm of something
 * eventually not positive, and a piecewise function whose branch there is
 * undefined all leave the side empty. That is proved by the same eventual
 * signs as everything else here.
 */
function domainOnSide(
  node: Node,
  variable: string,
  approach: Approach
): string | undefined {
  let reason: string | undefined;
  visit(node, (child) => {
    if (reason !== undefined) return;
    if (child.type === "Constant" && Number.isNaN(child.value)) {
      reason = "the formula in force on this side is undefined";
      return;
    }
    if (child.type !== "FunctionCall" || child.args.length !== 1) return;
    const [inner] = child.args;
    if (!dependsOn(inner, variable)) return;
    const name = child.callee.symbol;
    if (name === "sqrt" && eventualSign(inner, variable, approach) === -1)
      reason = "a square root of a negative number is not real";
    if (
      (name === "ln" || name === "log") &&
      (eventualSign(inner, variable, approach) ?? 1) <= 0
    )
      reason = "a logarithm of a number that is not positive is not real";
  });
  return reason;
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
    l?.kind === "finite" && certainlyZero(l.value) === true;
  const isOne = (l: Limit | undefined) =>
    l?.kind === "finite" &&
    certainlyZero(X.subtract(l.value, X.fromInteger(1))) === true;
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
 * L'Hôpital's rule, guarded.
 *
 * Its hypotheses are checked at every application: the quotient is still
 * `0/0` or `∞/∞` on the side approached, and the new denominator keeps one
 * non-zero sign there. And it stops the moment it stops helping: a quotient
 * that repeats one already seen (`√(x²+1)/x` alternates with its reciprocal
 * shape forever), one that has grown past four times the size it started at
 * (`e^{1/x}` gains a power of `1/x` each time), or {@link LHOPITAL_LIMIT}
 * applications. There is no measure that proves repeated differentiation
 * terminates in general, so none is pretended.
 */
function lHopital(
  node: Node & { type: "BinaryOperator" },
  variable: string,
  approach: Approach
):
  | { limit: Limit; techniques: LimitTechnique[]; lhopital: LHopitalStep[] }
  | undefined {
  const steps: LHopitalStep[] = [];
  const seen = new Set<string>([JSON.stringify(node)]);
  const budget = 4 * nodeCount(node);
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
    if (eventualSign(bottom, variable, approach) === undefined)
      return undefined;
    if (eventualSign(bottom, variable, approach) === 0) return undefined;
    const quotient = divide(top, bottom);
    const print = JSON.stringify(fold(quotient));
    if (seen.has(print) || exceedsNodeCount(quotient, budget)) return undefined;
    seen.add(print);
    steps.push({ numerator: top, denominator: bottom });
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

// ---- oscillation -------------------------------------------------------------

/** Functions that may not sit inside an oscillating argument: they jump. */
const JUMPS = ["floor", "ceil", "round", "sign"];

/**
 * A proof that the expression oscillates without a limit, or undefined.
 *
 * The shape proved is `A(x)·f(g(x)) + r(x)`, `f` sine or cosine, where
 *
 * - `g` is continuous near the approach (no jumps inside it) and tends to
 *   ±∞, so by the intermediate value theorem it passes through every large
 *   value, arbitrarily close to the point;
 * - `A` tends to a non-zero number `c` or to an infinity;
 * - `r` tends to a number `r₀`.
 *
 * Along the points where `f(g) = 1` the values tend to `r₀ + c`, and along
 * those where `f(g) = -1` to `r₀ − c`: two limits of one function along two
 * approaches, which a limit cannot have. When `A` is unbounded the values
 * along one of them run off to infinity and along the other to minus
 * infinity. `A → 0` is not this case — the squeeze theorem gives 0 — and
 * two oscillating terms are not attempted: `sin x + sin(√2 x)` needs a proof
 * about irrational rotations, not this one.
 */
function oscillationOf(
  node: Node,
  variable: string,
  approach: Approach
): OscillationProof | undefined {
  let found: { term: Node; negated: boolean; factor: Node } | undefined;
  const rest: Node[] = [];
  for (const { term, negated } of topLevelTerms(node)) {
    const factors: { node: Node; inNumerator: boolean }[] = [];
    quotientFactors(term, true, factors);
    const oscillating = factors.find(
      ({ node: f, inNumerator }) =>
        inNumerator &&
        f.type === "FunctionCall" &&
        f.args.length === 1 &&
        (f.callee.symbol === "sin" || f.callee.symbol === "cos") &&
        dependsOn(f.args[0], variable)
    );
    const argument =
      oscillating?.node.type === "FunctionCall"
        ? oscillating.node.args[0]
        : undefined;
    const unbounded =
      argument !== undefined &&
      limitOf(argument, variable, approach)?.kind === "infinite";
    if (oscillating !== undefined && unbounded) {
      if (found !== undefined) return undefined;
      found = { term, negated, factor: oscillating.node };
    } else rest.push(negated ? negative(term) : term);
  }
  if (found === undefined || found.factor.type !== "FunctionCall")
    return undefined;
  const [argument] = found.factor.args;
  let jumps = false;
  visit(argument, (child) => {
    if (
      (child.type === "FunctionCall" && JUMPS.includes(child.callee.symbol)) ||
      child.type === "Piecewise"
    )
      jumps = true;
  });
  if (jumps) return undefined;
  const argumentLimit = limitOf(argument, variable, approach);
  if (argumentLimit?.kind !== "infinite") return undefined;

  // The amplitude: the term with the oscillating factor divided out.
  const amplitudeNode = fold(
    divide(found.negated ? negative(found.term) : found.term, found.factor)
  );
  const amplitude = limitOf(amplitudeNode, variable, approach);
  if (amplitude === undefined) return undefined;
  if (amplitude.kind === "finite" && certainlyZero(amplitude.value) !== false)
    return undefined;
  // The other terms must settle on a number. One that runs off could beat the
  // oscillation (x + sin x → ∞), so an infinite remainder proves nothing.
  const restLimit: Limit =
    rest.length === 0
      ? { kind: "finite", value: X.ZERO }
      : (limitOf(
          rest.reduce((total, t) => ({
            type: "BinaryOperator",
            name: "Add",
            left: total,
            right: t,
          })),
          variable,
          approach
        ) ?? { kind: "infinite", sign: 1 });
  if (restLimit.kind !== "finite") return undefined;
  return {
    fn: found.factor.callee.symbol as "sin" | "cos",
    argument,
    argumentSign: argumentLimit.sign,
    amplitude,
    rest: restLimit,
  };
}

// ---- checking ----------------------------------------------------------------

/** Significant digits the check samples at: enough to stand 10⁻⁴⁰ from a point. */
const CHECK_DIGITS = 100;

/**
 * What the function's values near the approach say about the limit.
 *
 * A diagnostic, never a proof: no finite set of samples can confirm a limit,
 * since a function can agree at every sample and differ in between. So the
 * words are careful:
 *
 * - `consistent`: the values close in on the answer. `digits` says how many
 *   decimal places they reached, which is what the panel reports.
 * - `inconclusive`: they neither close in nor settle elsewhere at the
 *   distances tested. `1/ln x → 0` is still 0.01 at 10⁴⁰.
 * - `conflict`: the values settle, and not on the answer.
 *
 * Sampled at a hundred significant digits, out to 10⁻⁴⁰ from the point (or
 * 10⁴⁰ out towards an infinity). In doubles the samples near the point were
 * mostly rounding — `(1 − cos x)/x²` at 10⁻⁸ is 0 — so the check stopped at
 * 10⁻⁸ and a slow limit looked inconclusive for reasons that had nothing to
 * do with the function. At this precision the arithmetic is exact to far
 * past anything shown, and what the samples say is about the function.
 */
export function numericEvidence(
  node: Node,
  variable: string,
  approach: Approach,
  limit: Limit
): { verdict: "consistent" | "inconclusive" | "conflict"; digits: number } {
  const D = decimalContext(CHECK_DIGITS);
  const centre =
    approach.kind === "point"
      ? X.toDecimal(exactConstant(approach.node) ?? [], CHECK_DIGITS)
      : undefined;
  const values: Decimal[] = [];
  for (let k = 2; k <= 40; k += 2) {
    const at =
      approach.kind === "infinite"
        ? new D(10).pow(k).times(approach.sign)
        : centre?.isFinite() === true
          ? centre.plus(new D(10).pow(-k).times(approach.side))
          : new D(NaN);
    if (at.isNaN()) continue;
    const v = evaluatePrecise(node, { [variable]: at }, CHECK_DIGITS);
    if (!v.isNaN()) values.push(v);
  }
  // Nothing the precise evaluator could read: fall back to doubles, which at
  // least know every function the rest of the plugin does.
  if (values.length < 3)
    return { verdict: checkLimit(node, variable, approach, limit), digits: 0 };

  if (limit.kind === "infinite") {
    // Growing steadily with the right sign across the last several decades
    // of distance. Not "past a million": ln x at 10⁻⁴⁰ is only -92, and is
    // on its way to -∞ all the same.
    const tail = values.slice(-6);
    const rightSign = tail.every(
      (v) => !v.isZero() && v.isNegative() === limit.sign < 0
    );
    const growing = tail.every(
      (v, i) => i === 0 || v.abs().gt(tail[i - 1].abs())
    );
    if (rightSign && growing) return { verdict: "consistent", digits: 0 };
    return {
      verdict: settledPrecisely(values) ? "conflict" : "inconclusive",
      digits: 0,
    };
  }

  const target = X.toDecimal(limit.value, CHECK_DIGITS);
  const scale = D.max(1, target.abs());
  const errors = values.map((v) => v.minus(target).abs().div(scale));
  const best = errors.reduce((a, b) => (a.lt(b) ? a : b));
  const digits = best.isZero()
    ? MAX_REPORTED_DIGITS
    : Math.min(
        MAX_REPORTED_DIGITS,
        Math.max(0, Math.floor(-best.log(10).toNumber()))
      );
  if (digits >= 12) return { verdict: "consistent", digits };
  // Closing in, if slowly: the error falls tenfold or more over the samples
  // and never rises on the way.
  const last = errors.slice(-6);
  if (
    last.every((e, i) => i === 0 || e.lte(last[i - 1])) &&
    last[last.length - 1].times(10).lte(last[0])
  )
    return { verdict: "consistent", digits };
  if (settledPrecisely(values) && errors[errors.length - 1].gt("1e-10"))
    return { verdict: "conflict", digits };
  return { verdict: "inconclusive", digits };
}

/** How many agreeing decimal places the panel will claim at most. */
export const MAX_REPORTED_DIGITS = 30;

/** Whether the last few precise values have stopped moving. */
function settledPrecisely(values: readonly Decimal[]): boolean {
  const tail = values.slice(-3);
  if (tail.length < 3 || !tail.every((v) => v.isFinite())) return false;
  const size = tail.reduce(
    (m, v) => (v.abs().gt(m) ? v.abs() : m),
    new (decimalContext(CHECK_DIGITS))(1)
  );
  return (
    tail[2].minus(tail[1]).abs().lte(size.times("1e-30")) &&
    tail[1].minus(tail[0]).abs().lte(size.times("1e-25"))
  );
}

/**
 * The same check in doubles, for what the precise evaluator cannot read.
 * Distances stop at 10⁻⁸, where rounding takes over.
 */
export function checkLimit(
  node: Node,
  variable: string,
  approach: Approach,
  limit: Limit
): "consistent" | "inconclusive" | "conflict" {
  const values: number[] = [];
  for (let k = 1; k <= 8; k++) {
    const at =
      approach.kind === "infinite"
        ? approach.sign * 10 ** k
        : approach.value + approach.side * 10 ** -k;
    // A point floating point cannot tell from the approach tests nothing.
    if (approach.kind === "point" && at === approach.value) continue;
    const v = evaluate(node, { [variable]: at });
    if (!Number.isNaN(v)) values.push(v);
  }
  if (values.length < 3) return "inconclusive";

  if (limit.kind === "infinite") {
    const tail = values.slice(-4);
    const rightSign = tail.every((v) => Math.sign(v) === limit.sign);
    const growing = tail.every(
      (v, i) => i === 0 || Math.abs(v) >= Math.abs(tail[i - 1])
    );
    if (rightSign && growing && Math.abs(tail[tail.length - 1]) > 10)
      return "consistent";
    return settled(values) ? "conflict" : "inconclusive";
  }

  const target = X.toNumber(limit.value);
  const scale = Math.max(1, Math.abs(target));
  const errors = values.map((v) => Math.abs(v - target));
  if (Math.min(...errors) <= 1e-5 * scale) return "consistent";
  // Closing in, if slowly: each step at least halves the distance.
  const last = errors.slice(-4);
  if (last.every((e, i) => i === 0 || e <= last[i - 1] / 2))
    return "consistent";
  if (settled(values) && errors[errors.length - 1] > 1e-3 * scale)
    return "conflict";
  return "inconclusive";
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
  const kinds = new Set(method.resolutions.map((r) => r.kind));
  if (kinds.has("piecewise"))
    listed.unshift("The formula in force on this side");
  if (kinds.has("abs") || kinds.has("sign"))
    listed.unshift("Absolute value written out for this side");
  if (kinds.has("floor") || kinds.has("ceil") || kinds.has("round"))
    listed.unshift("The whole-number part is constant on this side");
  return listed
    .map((name, i) =>
      i === 0 ? name : name.charAt(0).toLowerCase() + name.slice(1)
    )
    .join(", then ");
}
