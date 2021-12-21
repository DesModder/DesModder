import { Calc, jquery, keys } from "desmodder";

function onEnable() {
  jquery(".dcg-exppanel-outer").on(
    "keydown.duplicateHotkey",
    (e: KeyboardEvent) => {
      if (e.ctrlKey && keys.lookupChar(e) === "Q") {
        Calc.controller.dispatch({
          type: "duplicate-expression",
          id: Calc.selectedExpressionId,
        });
      }
    }
  );
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
