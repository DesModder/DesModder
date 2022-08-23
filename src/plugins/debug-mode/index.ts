import { Calc } from "globals/window";

export default {
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
} as const;
