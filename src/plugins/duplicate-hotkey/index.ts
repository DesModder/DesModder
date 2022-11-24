import { Calc } from "globals/window";
import { Plugin } from "plugins";
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

const duplicateHotkey: Plugin = {
  id: "duplicate-expression-hotkey",
  onEnable,
  onDisable,
  enabledByDefault: true,
};
export default duplicateHotkey;
