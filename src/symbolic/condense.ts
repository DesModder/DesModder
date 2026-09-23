/**
 * Writing an expression the way a person writes it.
 *
 * `fold` is a different job, and keeping the two apart is the point. That one is *structural*: it folds constants, cancels factors,
 * removes multiplications by 1 — everything whose result is not a matter of
 * opinion. This one is *presentational*. It pulls a common factor out of a sum
 * and rewrites a quotient of trig functions as the single function that means
 * it, and both of those make an expression shorter without making it simpler in
 * any formal sense.
 *
 * The difference matters because of what the answers here are for. A derivative
 * that comes out as
 *
 *     2x(sin 3x)^{eˣ} + x²(sin 3x)^{eˣ}(eˣ ln(sin 3x) + 3eˣcos 3x / sin 3x)
 *
 * is correct, is what the rules produce, and is not what anybody writes down.
 * What they write is
 *
 *     (sin 3x)^{eˣ}(2x + x²eˣ(ln(sin 3x) + 3cot 3x))
 *
 * which is the same function, half the width, and reveals that the whole thing
 * vanishes nowhere the first form did not. Neither is more correct, so the panel
 * offers both rather than choosing — and `notes` says what was done to get from
 * one to the other, because a form that appears without explanation is one the
 * reader has to reverse-engineer.
 *
 * ## What it will not do
 *
 * Nothing that needs a decision about what an expression *means*. In particular
 * it does not pull numbers out (`2x + 4x²` stays as it is, because `2x(1 + 2x)`
 * is longer to read and no clearer), and it does not match powers of a shared
 * base against each other (`x³ + x²` keeps its terms, because pulling `x²` out
 * of a polynomial is the first step of a different problem — factoring to find
 * roots — and doing it silently inside an answer is unhelpful).
 *
 * Every rewrite here is an identity on the whole domain of the original, with
 * one exception worth naming: `cos u / sin u` becomes `cot u`, which is the same
 * function with the same domain, but `cot` is a function Desmos defines by that
 * very quotient, so nothing is lost. Factoring never changes a domain at all.
 */
import { fold } from "./fold";
import {
  call,
  divide,
  multiply,
  negative,
  number,
  quotientFactors,
  rebuildSum,
  sameTree,
  topLevelTerms,
  type Node,
} from "./tree";

/** What was done to an expression, so the panel can say so. */
export interface SimplificationNote {
  text: string;
  /**
   * The identity used, where the note is about one. Fixed text, so it can be
   * written here.
   */
  latex: string;
  /**
   * The factor that was pulled out.
   *
   * A tree rather than LaTeX, because emitting LaTeX needs a parser `Config`
   * and this module has no business holding one. The caller has it. The first
   * version guessed at a short label instead and printed `sin` for a factor of
   * `sin(3x)^{eˣ}` — a note naming something that is not a factor of anything.
   */
  factor?: Node;
}

export interface Condensed {
  node: Node;
  notes: readonly SimplificationNote[];
}

/**
 * Enough passes for a factor pulled out of an outer sum to expose one in the
 * sum inside it, and then for the trig rewrite to see what that exposed. Three
 * is one more than the deepest case here needs; the loop stops early anyway
 * once a pass changes nothing.
 */
const MAX_PASSES = 4;

/**
 * The shortest honest form of an expression, and what it took to get there.
 *
 * Empty `notes` means nothing was found to do, which is the signal the panel
 * uses to offer no choice at all rather than two identical forms.
 */
export function condense(node: Node): Condensed {
  let current = fold(node);
  const notes: SimplificationNote[] = [];
  for (let pass = 0; pass < MAX_PASSES; pass += 1) {
    const before = current;
    current = fold(rewriteTrig(current, notes));
    current = fold(factorSums(current, notes));
    if (sameTree(before, current)) break;
  }
  return { node: current, notes: dedupe(notes) };
}

function dedupe(
  notes: readonly SimplificationNote[]
): readonly SimplificationNote[] {
  const seen = new Set<string>();
  return notes.filter((note) => {
    const key = `${note.text}|${note.latex}|${JSON.stringify(note.factor)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Applies `transform` to every node, children first.
 *
 * Bottom-up because the interesting factor is usually in a sum nested inside
 * another: pulling `eˣ` out of the inner sum is what leaves the outer one with
 * two terms that visibly share `(sin 3x)^{eˣ}`.
 */
function rewrite(node: Node, transform: (node: Node) => Node): Node {
  switch (node.type) {
    case "BinaryOperator":
      return transform({
        ...node,
        left: rewrite(node.left, transform),
        right: rewrite(node.right, transform),
      });
    case "Negative":
      return transform({ ...node, arg: rewrite(node.arg, transform) });
    case "FunctionCall":
      return transform({
        ...node,
        args: node.args.map((arg) => rewrite(arg, transform)),
      });
    default:
      return transform(node);
  }
}

/**
 * The quotient identities, applied wherever both halves are in the same
 * fraction.
 *
 * Only `cos/sin` and `sin/cos`, which are the two a derivative actually
 * produces — logarithmic differentiation makes the first and `d/dx ln(cos u)`
 * makes the second. The reciprocal identities are deliberately left alone:
 * `1/sin u` is not obviously better written `csc u`, and a rewrite that is a
 * matter of taste does not belong in a pass that runs without being asked.
 */
function rewriteTrig(node: Node, notes: SimplificationNote[]): Node {
  return rewrite(node, (current) => {
    if (
      current.type !== "BinaryOperator" ||
      (current.name !== "Divide" &&
        current.name !== "Multiply" &&
        current.name !== "CrossMultiply")
    )
      return current;

    const entries: { node: Node; inNumerator: boolean }[] = [];
    quotientFactors(current, true, entries);
    const top = entries.filter((e) => e.inNumerator).map((e) => e.node);
    const bottom = entries.filter((e) => !e.inNumerator).map((e) => e.node);
    if (bottom.length === 0) return current;

    let changed = false;
    for (const [over, under, becomes] of QUOTIENT_IDENTITIES) {
      for (let i = top.length - 1; i >= 0; i -= 1) {
        const argument = argumentOf(top[i], over);
        if (argument === undefined) continue;
        const match = bottom.findIndex((factor) => {
          const other = argumentOf(factor, under);
          return other !== undefined && sameTree(other, argument);
        });
        if (match < 0) continue;
        top[i] = call(becomes, argument);
        bottom.splice(match, 1);
        changed = true;
        notes.push({
          text: `Rewrite ${over} over ${under} as ${becomes}.`,
          latex: `\\frac{\\operatorname{${over}}u}{\\operatorname{${under}}u}=\\operatorname{${becomes}}u`,
        });
      }
    }
    if (!changed) return current;

    const product = (factors: Node[]): Node =>
      factors.length === 0
        ? number(1)
        : factors.reduce((a, b) => multiply(a, b));
    return bottom.length === 0
      ? product(top)
      : divide(product(top), product(bottom));
  });
}

const QUOTIENT_IDENTITIES: readonly [string, string, string][] = [
  ["cos", "sin", "cot"],
  ["sin", "cos", "tan"],
];

/** The argument of `name(…)`, or undefined if this is not a call to it. */
function argumentOf(node: Node, name: string): Node | undefined {
  if (node.type !== "FunctionCall") return undefined;
  if (node.callee.symbol !== name) return undefined;
  if (node.args.length !== 1) return undefined;
  return node.args[0];
}

/**
 * Pulls out whatever every term of a sum has in common.
 *
 * Candidates come from the first term's factors, because a common factor is by
 * definition one of them. Only the factors above the bar are considered: `f`
 * divides `a·f + b·f/g` and pulling it out gives `f(a + b/g)`, which is right,
 * whereas treating a denominator as a candidate would produce something that is
 * only equal where that denominator is non-zero.
 */
function factorSums(node: Node, notes: SimplificationNote[]): Node {
  return rewrite(node, (current) => {
    if (
      current.type !== "BinaryOperator" ||
      (current.name !== "Add" && current.name !== "Subtract")
    )
      return current;

    const terms = topLevelTerms(current);
    if (terms.length < 2) return current;
    const split = terms.map((entry) => splitFactors(entry.term));

    let result = current;
    for (const candidate of split[0].top) {
      // A number is a coefficient, not a structure. `2x + 4x²` is clearer as
      // it stands than as `2x(1 + 2x)`, and nobody writes the second one.
      if (candidate.type === "Constant") continue;
      if (!split.every((term) => hasFactor(term.top, candidate))) continue;

      const remainders = split.map((term, index) => ({
        value: withoutFactor(term, candidate),
        negated: terms[index].negated,
      }));
      result = multiply(candidate, rebuildSum(remainders));
      notes.push({
        text: "Factor out what every term shares:",
        latex: "",
        factor: candidate,
      });
      // One factor per pass. The remainder is a fresh sum, and the next pass
      // walks into it — which is how the inner `eˣ` comes out after the outer
      // power has.
      break;
    }
    return result;
  });
}

function splitFactors(term: Node) {
  const entries: { node: Node; inNumerator: boolean }[] = [];
  quotientFactors(term, true, entries);
  return {
    top: entries.filter((e) => e.inNumerator).map((e) => e.node),
    bottom: entries.filter((e) => !e.inNumerator).map((e) => e.node),
  };
}

function hasFactor(factors: readonly Node[], candidate: Node) {
  return factors.some((factor) => sameTree(factor, candidate));
}

/** The term with one occurrence of `candidate` removed from above the bar. */
function withoutFactor(
  term: { top: Node[]; bottom: Node[] },
  candidate: Node
): Node {
  const top = [...term.top];
  const index = top.findIndex((factor) => sameTree(factor, candidate));
  top.splice(index, 1);
  const product = (factors: Node[]): Node =>
    factors.length === 0 ? number(1) : factors.reduce((a, b) => multiply(a, b));
  // `quotientFactors` turns a leading minus into a factor of -1, so a negated
  // term comes back through here with its sign already in the list.
  const numerator = product(top);
  return term.bottom.length === 0
    ? numerator
    : divide(numerator, product(term.bottom));
}

/** Exported for the tests, which check the identities in isolation. */
export const forTesting = { rewriteTrig, factorSums, negative };
