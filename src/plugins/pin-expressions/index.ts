import { Calc } from "globals/window";
import "./pinExpressions.less";

export default {
  id: "pin-expressions",
  name: "Pin Expressions",
  description: "Pin expressions from Edit List mode",
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
} as const;
