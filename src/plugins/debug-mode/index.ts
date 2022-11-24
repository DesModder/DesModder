import { Calc } from "globals/window";
import { Plugin } from "plugins";

const debugMode: Plugin = {
  id: "debug-mode",
  onEnable: () => {
    Calc.controller.updateViews();
  },
  onDisable: () => {},
  afterDisable: () => {
    Calc.controller.updateViews();
  },
  alwaysEnabled: false,
  enabledByDefault: false,
};
export default debugMode;
