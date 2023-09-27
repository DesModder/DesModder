import { DCGView } from "../../DCGView";
import { Inserter, PluginController } from "../PluginController";
import Tip from "./Tip";

function apiContainer() {
  return document.querySelector(".dcg-calculator-api-container");
}

export default class ShowTips extends PluginController {
  static id = "show-tips" as const;
  static enabledByDefault = true;

  afterEnable() {
    apiContainer()?.classList.add("dsm-show-tips");
  }

  afterDisable() {
    apiContainer()?.classList.remove("dsm-show-tips");
  }

  tipView(): Inserter {
    return () => DCGView.createElement(Tip, {});
  }
}
