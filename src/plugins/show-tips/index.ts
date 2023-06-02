import { Calc } from "globals/window";
import { Plugin } from "plugins";

function apiContainer() {
  return document.querySelector(".dcg-calculator-api-container");
}

const showTips: Plugin = {
  id: "show-tips",
  key: "showTips",
  onEnable: () => {
    apiContainer()?.classList.add("dsm-show-tips");
    Calc.controller.updateViews();
    return undefined;
  },
  onDisable: () => {},
  afterDisable: () => {
    apiContainer()?.classList.remove("dsm-show-tips");
    Calc.controller.updateViews();
  },
  enabledByDefault: true,
  /* Has moduleOverride */
};
export default showTips;
