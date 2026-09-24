/**
 * Multiplying out: `condense` run backwards.
 *
 * The two are opposites and both are wanted, for opposite reasons. `condense`
 * makes an answer short enough to read — `(sin 3x)^{eˣ}(2x + x²eˣ(…))` instead
 * of the same thing written twice. This makes an expression *flat*, which is a
 * worse thing to read and a much better thing to work on, because almost every
 * rule that acts on an expression acts on one term at a time.
 *
 * Integration is where that pays. `∫(x+1)(x+2)dx` has no rule: there is no
 * product rule for integrals, and the integrator is right to refuse it. Written
 * out as `∫x²+3x+2 dx` it is three applications of the power rule. The same
 * goes for a quotient — `∫(x²+1)/x dx` is refused as it stands and is `∫x dx +
 * ∫dx/x` once the fraction is split, which is `x²/2 + ln|x|`. Expanding first
 * is not a trick; it is how the problem is done by hand.
 *
 * ## The three rewrites
 *
 * A product with a sum on either side is distributed. A fraction whose
 * *numerator* is a sum is split over the bar. A power of a sum with a small
 * whole-number exponent becomes repeated multiplication, which the first
 * rewrite then flattens.
 *
 * Between passes the result is folded, and that ordering matters: distributing
 * `(x+1)(x+1)` produces `x·x + x + x + 1`, and it is the fold that turns it
 * into `x² + 2x + 1`. Running the fold first instead would notice the shared
 * base and write `(x+1)²`, which the power rewrite then opens again — the same
 * answer, one pass later.
 *
 * ## What it will not do
 *
 * A fraction whose *denominator* is a sum is left alone. `1/(x+1)` does not
 * expand into anything; turning `1/((x+1)(x+2))` into two fractions is partial
 * fractions, which is a genuinely different problem with a genuinely different
 * answer, and guessing at it here would produce something that looks like an
 * identity and is not.
 *
 * A symbolic or negative exponent is left alone. `(x+1)^n` cannot be written
 * out without knowing n, and `(x+1)^{-2}` written out is a fraction with a
 * longer denominator, which is not what anybody meant by expanding.
 *
 * And it stops. `EXPANSION_LIMIT` is a ceiling on how large the result may get,
 * because expansion is the one direction here that can grow without bound:
 * `(a+b+c)^6` has 28 terms and `(a+b+c+d)^8` has 165, none of which anybody
 * wanted to look at. Hitting the ceiling returns the expression unexpanded with
 * a note saying so, rather than a half-expanded form that is neither one thing
 * nor the other.
 *
 * ## One honest warning
 *
 * Splitting a fraction can expose a cancellation, and a cancellation can change
 * where a function is defined: `(x²+x)/x` expands and folds to `x+1`, which is
 * defined at zero where the original is not. That is the ordinary convention
 * for a symbolic simplifier and it is the reason a note is attached whenever a
 * quotient is split — the original is the form that says where the function has
 * a hole, and the reader should be told which one they are looking at.
 */
import { fold } from "./fold";
import { dedupe, type SimplificationNote } from "./notes";
import {
  binop,
  constantValue,
  divide,
  multiply,
  negative,
  exceedsNodeCount,
  number,
  rebuildSum,
  rationalNode,
  sameProduct,
  sameTree,
  splitRationalCoefficient,
  topLevelTerms,
  type Node,
} from "./tree";

export interface ExpandResult {
  node: Node;
  notes: readonly SimplificationNote[];
}

/**
 * How large an expansion may get, counted in tree nodes.
 *
 * Sized off the thing this is for rather than picked round: the widest
 * expression an AP integral arrives as is something like `(2x+1)³(x-4)`, which
 * lands near 120 nodes expanded. Twice that leaves room without letting a
 * sixth power of a trinomial through.
 */
export const EXPANSION_LIMIT = 260;

/** Above this the exponent is not written out whatever the size limit says. */
const MAX_POWER = 8;

/**
 * Enough passes for a distributed product to expose a power, that power to be
 * written out, and the result to be distributed in turn. The loop stops early
 * as soon as a pass changes nothing, which is the usual case after one.
 */
const MAX_PASSES = 6;

const DISTRIBUTE: SimplificationNote = {
  text: "Multiplied out, so each term can be handled on its own.",
  latex: "a\\left(b+c\\right)=ab+ac",
};

const SPLIT: SimplificationNote = {
  text: "Split the fraction over the sum. Watch the domain: the split form may cancel to something defined where the original is not.",
  latex: "\\frac{a+b}{c}=\\frac{a}{c}+\\frac{b}{c}",
};

const RAISE: SimplificationNote = {
  text: "Wrote the power out as repeated multiplication.",
  latex:
    "\\left(a+b\\right)^{3}=\\left(a+b\\right)\\left(a+b\\right)\\left(a+b\\right)",
};

const SIGN: SimplificationNote = {
  text: "Took the minus sign inside, so each term carries its own.",
  latex: "-\\left(a+b\\right)=-a-b",
};

const TOO_BIG: SimplificationNote = {
  text: "Stopped short: multiplying the rest out would make it longer than it is worth.",
  latex: "",
};

/**
 * Whether a rewrite's result is small enough to keep.
 *
 * Checked at each rewrite rather than once at the end, and that is not
 * tidiness. A pass that expands `(x+1)^8(x+2)^8` in one go builds a sum of
 * several thousand terms before anybody asks how big it is, and the fold that
 * runs next recurses once per term down a left-nested sum -- which overflows
 * the stack rather than returning something to measure.
 */
function withinLimit(node: Node) {
  return !exceedsNodeCount(node, EXPANSION_LIMIT);
}

/**
 * The expression written flat, and what it took to get there.
 *
 * Empty `notes` means there was nothing to multiply out, which is the signal a
 * panel uses to offer one form rather than two identical ones.
 */
export function expand(node: Node): ExpandResult {
  let current = fold(node);
  const notes: SimplificationNote[] = [];
  for (let pass = 0; pass < MAX_PASSES; pass += 1) {
    const before = current;
    const rewritten = openOnce(current, notes);
    // Nothing fired, so there is nothing to gather and nothing to say. The
    // early exit is what makes an empty `notes` mean the expression came back
    // untouched: `tidySums` reorders and collects, which is a visible change,
    // and running it on an expression nothing was done to would hand back a
    // rearranged tree while claiming to have done nothing.
    if (sameTree(rewritten, before)) break;
    const opened = fold(tidySums(fold(rewritten)));
    if (exceedsNodeCount(opened, EXPANSION_LIMIT)) {
      notes.push(TOO_BIG);
      return { node: before, notes: dedupe(notes) };
    }
    current = opened;
    if (sameTree(before, current)) break;
  }
  return { node: current, notes: dedupe(notes) };
}

/** One bottom-up sweep applying whichever of the three rewrites fits. */
function openOnce(node: Node, notes: SimplificationNote[]): Node {
  const rebuilt = mapChildren(node, (child) => openOnce(child, notes));
  switch (rebuilt.type) {
    case "Negative":
      return distributeSign(rebuilt.arg, notes) ?? rebuilt;
    case "BinaryOperator":
      switch (rebuilt.name) {
        case "Multiply":
        case "CrossMultiply":
          return distribute(rebuilt.left, rebuilt.right, notes) ?? rebuilt;
        case "Divide":
          return split(rebuilt.left, rebuilt.right, notes) ?? rebuilt;
        case "Exponent":
          return raise(rebuilt.left, rebuilt.right, notes) ?? rebuilt;
        default:
          return rebuilt;
      }
    default:
      return rebuilt;
  }
}

/**
 * Rebuilds a node with each of its direct children replaced.
 *
 * Only the shapes the rewrites below can appear inside. A visitor as general as
 * `visit` would have to reconstruct every node type Aug has, and a rewrite that
 * silently dropped a field while rebuilding one would be far worse than one
 * that declined to descend into it.
 */
function mapChildren(node: Node, on: (child: Node) => Node): Node {
  switch (node.type) {
    case "Negative":
      return negative(on(node.arg));
    case "FunctionCall":
      return { ...node, args: node.args.map(on) };
    case "BinaryOperator":
      return node.name === "CrossMultiply"
        ? { ...node, left: on(node.left), right: on(node.right) }
        : binop(node.name, on(node.left), on(node.right));
    default:
      return node;
  }
}

/** `-(a+b)` becomes `-a-b`, so the sign stops hiding a sum from every rule. */
function distributeSign(
  inner: Node,
  notes: SimplificationNote[]
): Node | undefined {
  const terms = topLevelTerms(inner);
  if (terms.length < 2) return undefined;
  notes.push(SIGN);
  return rebuildSum(
    terms.map(({ term, negated }) => ({ value: term, negated: !negated }))
  );
}

function distribute(
  left: Node,
  right: Node,
  notes: SimplificationNote[]
): Node | undefined {
  const leftTerms = topLevelTerms(left);
  const rightTerms = topLevelTerms(right);
  if (leftTerms.length < 2 && rightTerms.length < 2) return undefined;
  const parts: { value: Node; negated: boolean }[] = [];
  for (const l of leftTerms) {
    for (const r of rightTerms) {
      parts.push({
        value: multiply(l.term, r.term),
        // Two minus signs make a plus, which is what `!==` says here.
        negated: l.negated !== r.negated,
      });
    }
  }
  const result = rebuildSum(parts);
  if (!withinLimit(result)) {
    notes.push(TOO_BIG);
    return undefined;
  }
  notes.push(DISTRIBUTE);
  return result;
}

function split(
  numerator: Node,
  denominator: Node,
  notes: SimplificationNote[]
): Node | undefined {
  const terms = topLevelTerms(numerator);
  if (terms.length < 2) return undefined;
  notes.push(SPLIT);
  return rebuildSum(
    terms.map(({ term, negated }) => ({
      value: divide(term, denominator),
      negated,
    }))
  );
}

function raise(
  base: Node,
  exponent: Node,
  notes: SimplificationNote[]
): Node | undefined {
  if (topLevelTerms(base).length < 2) return undefined;
  const n = constantValue(exponent);
  if (n === undefined || !Number.isInteger(n) || n < 2 || n > MAX_POWER)
    return undefined;
  // Multiplied out here rather than handed back as a repeated product. The
  // fold that runs after every pass notices a shared base and writes
  // `(x+1)(x+1)(x+1)` straight back as `(x+1)^3`, so returning the product
  // would expand and re-collapse forever and report nothing expanded.
  let sum: Node = base;
  for (let i = 1; i < n; i += 1) {
    const next = distribute(sum, base, notes);
    // A refusal part-way through leaves the power alone entirely. Half of
    // `(x+1)^8` written out is not a form anybody asked for, and `distribute`
    // has already said why it stopped.
    if (next === undefined) return undefined;
    sum = next;
  }
  notes.push(RAISE);
  return sum;
}

/**
 * Every sum in the tree with its like terms gathered and its terms in
 * descending degree.
 *
 * Both halves of this are needed and neither is the fold's job.
 *
 * **Gathering** is needed because the fold collects like terms only when they
 * are *adjacent*: it is written over one binary operator at a time, and
 * `(x+1)(x+2)` distributes to `x·x + 2x + x + 2` where the two multiples of x
 * have a term between them. Left that way, expanding a pair of binomials
 * produces `x²+2x+x+2`, which is worse than the thing it started from.
 *
 * **Ordering** is a display choice, and the one place this file admits to
 * having taste. `(x+2)(x²-3)` distributes in the order the factors were written
 * and comes out `x³-3x+2x²-6`, which is correct and reads like a mistake.
 * Sorting by degree is what everybody does by hand.
 *
 * It is deliberately *not* a canonical form, and the difference matters. The
 * sort is stable and the degree is a single number, so terms it cannot tell
 * apart keep the order they were written in and nothing is ever reordered on a
 * rule this cannot state. Two expressions that are the same function can still
 * come out of here looking different, and deciding that they are the same is
 * `agreesOnSamples`'s job, not this one's.
 */
export function tidySums(node: Node): Node {
  const rebuilt = mapChildren(node, tidySums);
  const terms = opened(topLevelTerms(rebuilt));
  if (terms.length < 2) return rebuilt;

  const groups: {
    coefficient: { n: number; d: number };
    rest: Node;
    degree: number;
  }[] = [];
  for (const { term, negated } of terms) {
    const { coefficient, rest } = splitRationalCoefficient(term);
    const signed = negated
      ? { n: -coefficient.n, d: coefficient.d }
      : coefficient;
    const match = groups.findIndex((group) => sameProduct(group.rest, rest));
    if (match >= 0) {
      const total = groups[match].coefficient;
      groups[match].coefficient = {
        n: total.n * signed.d + signed.n * total.d,
        d: total.d * signed.d,
      };
    } else {
      groups.push({ coefficient: signed, rest, degree: degreeOf(rest) });
    }
  }

  // A stable sort by descending degree. `Array.prototype.sort` has been stable
  // since ES2019, which is what lets terms of equal degree keep the order they
  // were written in rather than being shuffled by an implementation detail.
  groups.sort((a, b) => b.degree - a.degree);

  const kept = groups.filter((group) => group.coefficient.n !== 0);
  if (kept.length === 0) return number(0);
  return rebuildSum(
    kept.map(({ coefficient, rest }) => ({
      value: multiply(
        rationalNode({
          n: Math.abs(coefficient.n),
          d: Math.abs(coefficient.d),
        }),
        rest
      ),
      negated: coefficient.n < 0 !== coefficient.d < 0,
    }))
  );
}

/**
 * Terms of a sum, with any bracket over a number opened out.
 *
 * `(A + B)/2 - B` has two terms and the two `B`s never meet, because the first
 * one is inside a bracket. Opening it is what lets them collect, and it is done
 * only here -- a lone `(x+1)/2` is left alone, because splitting it would turn
 * `arcsin((x+1)/2)` into `arcsin(x/2 + 1/2)` for no gain at all.
 */
function opened(
  terms: readonly { term: Node; negated: boolean }[]
): { term: Node; negated: boolean }[] {
  if (terms.length < 2) return [...terms];
  const out: { term: Node; negated: boolean }[] = [];
  for (const { term, negated } of terms) {
    const divisor =
      term.type === "BinaryOperator" && term.name === "Divide"
        ? constantValue(term.right)
        : undefined;
    if (
      term.type !== "BinaryOperator" ||
      divisor === undefined ||
      divisor === 0
    ) {
      out.push({ term, negated });
      continue;
    }
    const inner = topLevelTerms(term.left);
    if (inner.length < 2) {
      out.push({ term, negated });
      continue;
    }
    for (const piece of inner) {
      out.push({
        term: divide(piece.term, term.right),
        negated: negated !== piece.negated,
      });
    }
  }
  return out;
}

/**
 * How high a power of the variables a term is, as one number.
 *
 * Enough to sort by and no more. Anything this cannot read as a power — a
 * function call, a symbolic exponent, a constant — is degree zero, which puts
 * it at the end beside the constant term and never claims anything false about
 * it. A fraction subtracts, so `1/x` sorts below `x` and below a constant,
 * which is where it belongs.
 */
function degreeOf(node: Node): number {
  switch (node.type) {
    case "Identifier":
      // `pi`, not `\pi`: Aug carries the name, and the emitter is what puts the
      // backslash back on. The first spelling of this checked for the LaTeX and
      // so quietly sorted π as a variable of degree one.
      return node.symbol === "e" || node.symbol === "pi" ? 0 : 1;
    case "Negative":
      return degreeOf(node.arg);
    case "BinaryOperator":
      switch (node.name) {
        case "Multiply":
        case "CrossMultiply":
          return degreeOf(node.left) + degreeOf(node.right);
        case "Divide":
          return degreeOf(node.left) - degreeOf(node.right);
        case "Exponent": {
          const n = constantValue(node.right);
          return n === undefined || !Number.isInteger(n)
            ? 0
            : n * degreeOf(node.left);
        }
        default:
          return 0;
      }
    default:
      return 0;
  }
}

/** Kept for the tests, which check each rewrite on its own before the loop. */
export const forTesting = {
  distribute,
  split,
  raise,
  distributeSign,
  tidySums,
  degreeOf,
};
