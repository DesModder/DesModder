import { Console } from "../globals/window";
import parseFile, { Block } from "./replacementHelpers/parse";
import replacementStrings from "#plugins/index-replacements.ts";

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
  "syntax-highlighting",
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
