import { DCGView } from "../../DCGView";
import { Inserter } from "../../preload/replaceElement";
import { PluginController } from "../PluginController";
import Tip from "./Tip";
import { facetSourcesSpec } from "dataflow";

function apiContainer() {
  return document.querySelector(".dcg-calculator-api-container");
}

declare module "dataflow" {
  interface Computed {
    tipView: Inserter;
  }
}

export default class ShowTips extends PluginController {
  static id = "show-tips" as const;
  static enabledByDefault = true;

  computed = facetSourcesSpec({
    tipView: {
      value: () => DCGView.createElement(Tip, {}),
    },
  });

  afterEnable() {
    apiContainer()?.classList.add("dsm-show-tips");
  }

  afterDisable() {
    apiContainer()?.classList.remove("dsm-show-tips");
  }
}
