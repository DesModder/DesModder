import replacementStrings from "#plugins/index-replacements.ts";
import parseFile, { Block } from "../../apply-replacements/parse";
import workerAppend from "../plugins/append.inline";

export const replacements: Block[] = [];

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
  "show-tips",
  "right-click-tray",
  "duplicate-expression-hotkey",
  "GLesmos",
  "hide-errors",
  "folder-tools",
  "text-mode",
  "performance-info",
  "better-evaluation-view",
  "manage-metadata",
  "pillbox-menus",
  "code-golf",
  "syntax-highlighting",
  "better-navigation",
  "multiline",
  "intellisense",
  "override-keystroke",
  "quake-pro",
];

replacements.forEach((r) => {
  r.plugins.forEach((plugin) => {
    if (!pluginNames.includes(plugin))
      // This can only break due to DesModder, not Desmos, so a throw is acceptable.
      throw new Error(
        `Plugin ${plugin} specified in replacement ${r.filename} not found: ` +
          `at risk of instability on panic.`
      );
  });
});

export { workerAppend };
