/**
 * What Vector Tools calls the symbolic layer.
 *
 * Everything that was here is in `src/symbolic` now: the fold, the emitter,
 * the tree vocabulary and the differentiator itself. Each of them moved for the
 * same reason, which is that a second plugin had grown its own copy and the two
 * had drifted — this module's `simplify` produced `2x + -(2x)` where the shared
 * one produces `0`, and its `toLatex` was the shared one minus two rules.
 *
 * The file stays because the names in it are this plugin's vocabulary and every
 * caller reads them from here. It is a list of what Vector Tools uses, which is
 * worth being able to see at a glance, and not a second implementation of any
 * of it.
 */
export {
  add,
  collectLikeTerms,
  constantValue,
  dependsOn,
  differentiate,
  evaluate,
  fold as simplify,
  subtract,
  identifiersIn,
  implicitDerivative,
  SymbolicError,
  toLatex,
  type Node,
} from "../../symbolic";
