import MainController from "../../MainController";
import { CMPluginSpec } from "../../plugins";
import { CMPlugin } from "../CMPlugin";
import { EditorView, ViewPlugin } from "@codemirror/view";
import { Calc } from "globals/window";
import { keys } from "utils/depUtils";

export default class DuplicateHotkey extends CMPlugin {
  static id = "duplicate-expression-hotkey" as const;
  static enabledByDefault = true;

  readonly exppanel: HTMLElement | null;

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

  constructor(view: EditorView, dsm: MainController) {
    super(view, dsm);
    this.exppanel = document.querySelector(".dcg-exppanel-outer");
    this.exppanel?.addEventListener("keydown", this.onKeydown);
  }

  destroy() {
    this.exppanel?.removeEventListener("keydown", this.onKeydown);
  }
}

export function duplicateHotkey(
  dsm: MainController
): CMPluginSpec<DuplicateHotkey> {
  return {
    id: DuplicateHotkey.id,
    category: "utility",
    config: [],
    plugin: ViewPlugin.define((view) => new DuplicateHotkey(view, dsm)),
    extensions: [],
  };
}
