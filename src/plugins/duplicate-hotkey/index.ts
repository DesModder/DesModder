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
}

function onDisable() {
  jquery(".dcg-exppanel-outer").off(".duplicateHotkey");
}

export default {
  id: "duplicate-expression-hotkey",
  name: "Duplicate Expression Hotkey",
  description:
    "Lets you press Ctrl+Q to duplicate the currently-selected expression.",
  onEnable: onEnable,
  onDisable: onDisable,
  enabledByDefault: true,
} as const;
