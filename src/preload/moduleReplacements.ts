import glesmos from "./moduleOverrides/glesmos.replacements";
import hideErrors from "./moduleOverrides/hide-errors.replacements";
import pinExpressions from "./moduleOverrides/pin-expressions.replacements";
import shiftEnterNewline from "./moduleOverrides/shift-enter-newline.replacements";
// temporary style import for glesmos
import "./moduleOverrides/styles/expression-menus__fill.less";
import textMode from "./moduleOverrides/text-mode.replacements";
import parseReplacement, { ReplacementRule } from "./replacementHelpers/parse";

const replacementStrings = [
  hideErrors,
  pinExpressions,
  shiftEnterNewline,
  glesmos,
  textMode,
];

const replacements: ReplacementRule[] = [];

for (const replacement of replacementStrings) {
  replacements.push(...parseReplacement(replacement));
}

export default replacements;
