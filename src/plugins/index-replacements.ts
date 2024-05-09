import glesmos from "#plugins/GLesmos/glesmos.replacements";
import betterEvaluationView from "#plugins/better-evaluation-view/better-evaluation-view.replacements";
import codeGolf from "#plugins/code-golf/code-golf.replacements";
import debugMode from "#plugins/debug-mode/debug-mode.replacements";
import extraExpressionButtons from "#plugins/expr-action-buttons/expr-action-buttons.replacements";
import findReplace from "#plugins/find-replace/find-replace.replacements";
import hideErrors from "#plugins/hide-errors/hide-errors.replacements";
import metadata from "#plugins/manage-metadata/manage-metadata.replacements";
import overrideKeystroke from "#plugins/override-keystroke/override-keystroke.replacements";
import pillbox from "#plugins/pillbox-menus/pillbox-menus.replacements";
import pinExpressions from "#plugins/pin-expressions/pin-expressions.replacements";
import rightClickTray from "#plugins/right-click-tray/right-click-tray.replacements";
import showTips from "#plugins/show-tips/show-tips.replacements";
import syntaxHighlighting from "#plugins/syntax-highlighting/syntax-highlighting.replacements";
import textMode from "#plugins/text-mode/text-mode.replacements";
import insertPanels from "../preload/moduleOverrides/insert-panels.replacements";

export default [
  insertPanels,
  metadata,
  overrideKeystroke,
  pillbox,
  betterEvaluationView,
  findReplace,
  glesmos,
  hideErrors,
  pinExpressions,
  textMode,
  debugMode,
  extraExpressionButtons,
  showTips,
  rightClickTray,
  codeGolf,
  syntaxHighlighting,
];
