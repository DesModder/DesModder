import "./pinExpressions.less";
import { Calc } from "globals/window";
import { Plugin } from "plugins";

const pinExpressions: Plugin = {
  id: "pin-expressions",
  // Controller handles enable/disable by changing the results of isPinned
  // (used in modified module definitions), but we need to update views
  onEnable: () => {
    Calc.controller.updateViews();
  },
  onDisable: () => {
    Calc.controller.updateViews();
  },
  enabledByDefault: true,
  /* Has module overrides */
};
export default pinExpressions;
