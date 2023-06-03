import { PluginController } from "../PluginController";
import { Calc } from "globals/window";
import { Plugin } from "plugins";
import { jquery, keys } from "utils/depUtils";

export default class DuplicateHotkey extends PluginController {
  static id = "duplicate-expression-hotkey" as const;
  static enabledByDefault = true;

  afterEnable() {
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

  afterDisable() {
    jquery(".dcg-exppanel-outer").off(".duplicateHotkey");
  }
}
DuplicateHotkey satisfies Plugin;
