import findReplace from "./moduleOverrides/find-replace.replacements";
import glesmos from "./moduleOverrides/glesmos.replacements";
import hideErrors from "./moduleOverrides/hide-errors.replacements";
import helpers from "./moduleOverrides/partials/helpers.replacements";
import pinExpressions from "./moduleOverrides/pin-expressions.replacements";
import shiftEnterNewline from "./moduleOverrides/shift-enter-newline.replacements";
// temporary style import for glesmos
import "./moduleOverrides/styles/expression-menus__fill.less";
// temporary style import for hide-errors
import "./moduleOverrides/styles/promptslider_view.less";
import textMode from "./moduleOverrides/text-mode.replacements";
import videoCreator from "./moduleOverrides/video-creator.replacements";
import parseFile, { Block } from "./replacementHelpers/parse";

const replacementStrings = [
  helpers,
  findReplace,
  glesmos,
  hideErrors,
  pinExpressions,
  shiftEnterNewline,
  textMode,
  videoCreator,
];

const replacements: Block[] = [];

for (const replacement of replacementStrings) {
  replacements.push(...parseFile(replacement));
}

export default replacements;
