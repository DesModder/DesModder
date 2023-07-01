import { Console } from "../globals/window";
import betterEvaluationView from "./moduleOverrides/better-evaluation-view.replacements";
import debugMode from "./moduleOverrides/debug-mode.replacements";
import extraExpressionButtons from "./moduleOverrides/extra-expression-buttons.replacements";
import findReplace from "./moduleOverrides/find-replace.replacements";
import glesmos from "./moduleOverrides/glesmos.replacements";
import hideErrors from "./moduleOverrides/hide-errors.replacements";
import insertPanels from "./moduleOverrides/insert-panels.replacements";
import metadata from "./moduleOverrides/metadata.replacements";
import pillbox from "./moduleOverrides/pillbox.replacements";
import pinExpressions from "./moduleOverrides/pin-expressions.replacements";
import rightClickTray from "./moduleOverrides/right-click-tray.replacements";
import shiftEnterNewline from "./moduleOverrides/shift-enter-newline.replacements";
import showTips from "./moduleOverrides/show-tips.replacements";
import textMode from "./moduleOverrides/text-mode.replacements";
import parseFile, { Block } from "./replacementHelpers/parse";

const replacementStrings = [
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

const replacements: Block[] = [];

for (const replacement of replacementStrings) {
  replacements.push(...parseFile(replacement.file, replacement.filename));
}

// importing from plugins index causes a loading order issue
// (desmos dependencies get imported before desmos is loaded),
// so just hardcode the plugin names for now
const pluginNames = [
  "builtin-settings",
  "set-primary-color",
  "wolfram2desmos",
  "pin-expressions",
  "video-creator",
  "wakatime",
  "find-and-replace",
  "debug-mode",
  "show-tips",
  "right-click-tray",
  "duplicate-expression-hotkey",
  "GLesmos",
  "shift-enter-newline",
  "hide-errors",
  "folder-tools",
  "text-mode",
  "performance-info",
  "better-evaluation-view",
  "manage-metadata",
  "pillbox-menus",
];

replacements.forEach((r) => {
  r.plugins.forEach((plugin) => {
    if (!pluginNames.includes(plugin))
      Console.warn(
        "Plugin",
        plugin,
        "specified in replacement",
        r.filename,
        "not found: at risk of instability on panic."
      );
  });
});

export default replacements;
