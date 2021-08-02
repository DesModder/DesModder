// this is pretty much a template plugin
// based on userscript https://gist.github.com/jared-hughes/a21dbeead4c6d0969334707cc1a735bd

import { Calc, jquery, keys } from "desmodder";
import duplicateExpression from "./duplicateExpression";

function onEnable() {
  jquery(".dcg-exppanel-outer").on(
    "keydown.duplicateHotkey",
    (e: KeyboardEvent) => {
      if (e.ctrlKey && keys.lookupChar(e) === "Q") {
        duplicateExpression(Calc.selectedExpressionId);
      }
    }
  );
  return { duplicateExpression };
}

function onDisable() {
  jquery(".dcg-exppanel-outer").off(".duplicateHotkey");
}

export default {
  id: "duplicate-expression-hotkey",
  name: "Improved Duplication",
  description:
    "Lets you duplicate all expression types, including folders. Ctrl+Q duplicates the currently-selected expression.",
  onEnable: onEnable,
  onDisable: onDisable,
  enabledByDefault: true,
} as const;
