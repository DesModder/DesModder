import { Calc } from "globals/window";
import { Plugin } from "plugins";

const showTips: Plugin = {
  id: "show-tips",
  onEnable: () => {
    Calc.controller.updateViews();
  },
  onDisable: () => {},
  afterDisable: () => {
    Calc.controller.updateViews();
  },
  enabledByDefault: true,
  /* Has moduleOverride */
};
export default showTips;
