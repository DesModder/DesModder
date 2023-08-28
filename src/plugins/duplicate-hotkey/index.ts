import { PluginController } from "../PluginController";
import { Calc } from "#globals";
import { keys } from "#utils/depUtils.ts";

export default class DuplicateHotkey extends PluginController {
  static id = "duplicate-expression-hotkey" as const;
  static enabledByDefault = true;

  exppanel: HTMLElement | null = null;

  onKeydown = this._onKeydown.bind(this);
  _onKeydown(e: KeyboardEvent) {
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

  afterEnable() {
    this.exppanel = document.querySelector(".dcg-exppanel-outer");
    this.exppanel?.addEventListener("keydown", this.onKeydown);
  }

  afterDisable() {
    this.exppanel?.removeEventListener("keydown", this.onKeydown);
  }
}
