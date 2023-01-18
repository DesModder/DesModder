import core from "./moduleOverrides/core.replacements";
import debugMode from "./moduleOverrides/debug-mode.replacements";
import extraExpressionButtons from "./moduleOverrides/extra-expression-buttons.replacements";
import findReplace from "./moduleOverrides/find-replace.replacements";
import glesmos from "./moduleOverrides/glesmos.replacements";
import hideErrors from "./moduleOverrides/hide-errors.replacements";
import pinExpressions from "./moduleOverrides/pin-expressions.replacements";
import shiftEnterNewline from "./moduleOverrides/shift-enter-newline.replacements";
import textMode from "./moduleOverrides/text-mode.replacements";
import parseFile, { Block } from "./replacementHelpers/parse";

const replacementStrings = [
  core,
  findReplace,
  glesmos,
  hideErrors,
  pinExpressions,
  shiftEnterNewline,
  textMode,
  debugMode,
  extraExpressionButtons,
];

const replacements: Block[] = [];

for (const replacement of replacementStrings) {
  replacements.push(...parseFile(replacement.file, replacement.filename));
}

export default replacements;
