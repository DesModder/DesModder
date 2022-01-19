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
  name: "Duplicate Expression Hotkey",
  description:
    "Type Ctrl+Q, Ctrl+Shift+Q, or Cmd+Q to duplicate the selected expression.",
  onEnable: onEnable,
  onDisable: onDisable,
  enabledByDefault: true,
} as const;
