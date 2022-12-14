import hideErrors from "./moduleOverrides/hide-errors.replacements";
import pinExpressions from "./moduleOverrides/pin-expressions.replacements";
import shiftEnterNewline from "./moduleOverrides/shift-enter-newline.replacements";
import parseReplacement, { ReplacementRule } from "./replacementHelpers/parse";

const replacementStrings = [hideErrors, pinExpressions, shiftEnterNewline];

const replacements: ReplacementRule[] = [];

for (const replacement of replacementStrings) {
  replacements.push(...parseReplacement(replacement));
}

export default replacements;
