import { Calc } from "globals/window";
import { jquery, keys } from "utils/depUtils";

function onEnable() {
  jquery(".dcg-exppanel-outer").on(
    "keydown.duplicateHotkey",
    (e: KeyboardEvent) => {
      if (e.ctrlKey && keys.lookupChar(e) === "Q") {
        const selectedItem = Calc.controller.getSelectedItem();
        if (!selectedItem) return;
        Calc.controller.dispatch({
          type:
            selectedItem.type === "folder"
              ? "duplicate-folder"
              : "duplicate-expression",
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
  onEnable: onEnable,
  onDisable: onDisable,
  enabledByDefault: true,
} as const;
