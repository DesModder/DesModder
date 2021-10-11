import { Calc } from "desmodder";

export default {
  id: "debug-mode",
  name: "Debug Mode",
  description: "Show expression IDs instead of indices",
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
