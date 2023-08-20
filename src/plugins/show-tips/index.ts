import { DCGView } from "../../DCGView";
import { InserterFacet, inserterFacet } from "../../preload/replaceElement";
import { PluginController } from "../PluginController";
import Tip from "./Tip";
import { facetsSpec } from "dataflow";

function apiContainer() {
  return document.querySelector(".dcg-calculator-api-container");
}

declare module "dataflow" {
  interface Facets {
    tipView: InserterFacet;
  }
}

export default class ShowTips extends PluginController {
  static id = "show-tips" as const;
  static enabledByDefault = true;

  facets = facetsSpec({
    tipView: inserterFacet(() => DCGView.createElement(Tip, {})),
  });

  afterEnable() {
    apiContainer()?.classList.add("dsm-show-tips");
  }

  afterDisable() {
    apiContainer()?.classList.remove("dsm-show-tips");
  }
}
