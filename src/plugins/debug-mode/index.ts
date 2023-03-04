import { Calc } from "globals/window";
import { Plugin } from "plugins";

const debugMode: Plugin = {
  id: "debug-mode",
  onEnable: () => {
    // The displayed indexes are stored in some state somewhere, so
    // update the state first before updating views
    Calc.controller.updateTheComputedWorld();
    Calc.controller.updateViews();
  },
  onDisable: () => {},
  afterDisable: () => {
    Calc.controller.updateTheComputedWorld();
    Calc.controller.updateViews();
  },
  enabledByDefault: false,
};
export default debugMode;
