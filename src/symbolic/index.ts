/**
 * Symbolic rewriting over Desmos's own syntax tree, shared by the plugins that
 * do mathematics rather than graphics.
 *
 * It sits below Vector Tools and Physics Lab the way `field-rendering` does,
 * and for the same reason: two plugins had grown the same simplifier, the two
 * copies had already drifted, and the separation rule that keeps plugins from
 * importing each other says the way out is a neutral package with its own
 * tests. This knows about `text-mode-core` and about nothing else.
 *
 * ## Three names, not one `simplify`
 *
 * The distinction is the design, and it is worth stating before the API:
 *
 * - **{@link fold}** is structural. Constants collapse, `×1` disappears, `6x/3`
 *   becomes `2x`. There is one right answer and nobody would prefer the input,
 *   so it is safe to apply always, without asking.
 * - **{@link condense}** is presentational and shorter. It pulls a common
 *   factor out of a sum and writes `cos/sin` as `cot`.
 * - **{@link expand}** is presentational and flatter. It multiplies out and
 *   splits fractions over their numerators.
 *
 * The last two are opposites, both correct, and neither is the answer to "what
 * should this look like" without knowing who is asking. A reader wants the
 * short one; the integrator wants the flat one, because there is no product
 * rule for integrals and `∫(x+1)(x+2)dx` only becomes three power-rule steps
 * once it is written out. So they are two functions with two names, and each
 * returns notes saying what it did — a form that appears without explanation is
 * one the reader has to reverse-engineer.
 *
 * A fourth question, "are these two expressions the same function", is
 * deliberately *not* answered symbolically. `x(x+1)` and `x²+x` fold to
 * different trees and are the same function; deciding that needs a canonical
 * form, and a canonical form strong enough to be useful is a computer algebra
 * system. {@link agreesOnSamples} answers it numerically instead, which is both
 * honest and enough.
 */
export { fold } from "./fold";
export {
  differentiate,
  implicitDerivative,
  SymbolicError,
} from "./differentiate";
export { absToBars, dropRedundantParens, toLatex } from "./latex";
export { condense, type Condensed } from "./condense";
export {
  expand,
  tidySums as collectLikeTerms,
  EXPANSION_LIMIT,
  type ExpandResult,
} from "./expand";
export { dedupe, type SimplificationNote } from "./notes";
export {
  agreesOnSamples,
  conditionHolds,
  evaluate,
  numericDerivative,
  numericSecondDerivative,
  type Bindings,
} from "./evaluate";
export {
  add,
  asRatio,
  binop,
  call,
  constantValue,
  dependsOn,
  divide,
  freshName,
  functionCall,
  greatestCommonDivisor,
  id,
  identifiersIn,
  isNode,
  multiply,
  negative,
  exceedsNodeCount,
  nodeCount,
  normsToAbs,
  number,
  power,
  quotientFactors,
  rationalNode,
  rationalOf,
  rebuildSum,
  replaceIdentifier,
  replaceSubtree,
  sameProduct,
  sameTree,
  splitCoefficient,
  splitRationalCoefficient,
  subtract,
  topLevelTerms,
  visit,
  type Node,
} from "./tree";
