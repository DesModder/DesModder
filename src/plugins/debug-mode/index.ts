import MainController from "../../MainController";
import { CMPluginSpec } from "../../plugins";
import { CMPlugin } from "../CMPlugin";
import { EditorView, ViewPlugin } from "@codemirror/view";
import { Calc } from "globals/window";

export default class DebugMode extends CMPlugin {
  static id = "debug-mode" as const;
  static enabledByDefault = false;

  constructor(view: EditorView, dsm: MainController) {
    super(view, dsm);
    // The displayed indexes are stored in some state somewhere, so
    // update the state before updating views
    setTimeout(() => {
      Calc.controller.dispatch({ type: "tick" });
    });
  }

  destroy() {
    setTimeout(() => {
      Calc.controller.dispatch({ type: "tick" });
    });
  }
}

export function debugMode(dsm: MainController): CMPluginSpec<DebugMode> {
  return {
    id: DebugMode.id,
    category: "visual",
    config: [],
    plugin: ViewPlugin.define((view) => new DebugMode(view, dsm)),
    extensions: [],
  };
}
