import glesmos from "cmPlugins/GLesmos/glesmos.replacements";
import betterEvaluationView from "cmPlugins/better-evaluation-view/better-evaluation-view.replacements";
import debugMode from "cmPlugins/debug-mode/debug-mode.replacements";
import extraExpressionButtons from "cmPlugins/expr-action-buttons/expr-action-buttons.replacements";
import findReplace from "cmPlugins/find-replace/find-replace.replacements";
import hideErrors from "cmPlugins/hide-errors/hide-errors.replacements";
import pillbox from "cmPlugins/pillbox-menus/pillbox-menus.replacements";
import pinExpressions from "cmPlugins/pin-expressions/pin-expressions.replacements";
import rightClickTray from "cmPlugins/right-click-tray/right-click-tray.replacements";
import shiftEnterNewline from "cmPlugins/shift-enter-newline/shift-enter-newline.replacements";
import showTips from "cmPlugins/show-tips/show-tips.replacements";
import metadata from "plugins/manage-metadata/manage-metadata.replacements";
import textMode from "plugins/text-mode/text-mode.replacements";
import insertPanels from "preload/moduleOverrides/insert-panels.replacements";

export default [
  insertPanels,
  metadata,
  pillbox,
  betterEvaluationView,
  findReplace,
  glesmos,
  hideErrors,
  pinExpressions,
  shiftEnterNewline,
  textMode,
  debugMode,
  extraExpressionButtons,
  showTips,
  rightClickTray,
];
