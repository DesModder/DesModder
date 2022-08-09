import { Calc } from "globals/window";

export default {
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
} as const;
