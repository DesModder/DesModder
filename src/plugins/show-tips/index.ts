import { DCGView } from "../../DCGView";
import MainController from "../../MainController";
import { CMPluginSpec } from "../../plugins";
import { CMPlugin, Inserter } from "../CMPlugin";
import Tip from "./Tip";
import { EditorView, ViewPlugin } from "@codemirror/view";

function apiContainer() {
  return document.querySelector(".dcg-calculator-api-container");
}

export default class ShowTips extends CMPlugin {
  static id = "show-tips" as const;
  static enabledByDefault = true;

  constructor(view: EditorView, dsm: MainController) {
    super(view, dsm);
    apiContainer()?.classList.add("dsm-show-tips");
  }

  destroy() {
    apiContainer()?.classList.remove("dsm-show-tips");
  }

  tipView(): Inserter {
    return () => DCGView.createElement(Tip as any, {});
  }
}

export function showTips(dsm: MainController): CMPluginSpec<ShowTips> {
  return {
    id: ShowTips.id,
    category: "visual",
    config: [],
    plugin: ViewPlugin.define((view) => new ShowTips(view, dsm)),
    extensions: [],
  };
}
