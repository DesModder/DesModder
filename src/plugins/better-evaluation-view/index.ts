import { Calc } from "globals/window";
import { Plugin } from "plugins";

const betterEvaluationView: Plugin = {
  id: "better-evaluation-view",
  // Still need to declare empty onEnable and onDisable to get the right UI
  onEnable: () => {
    Calc.controller.updateViews();
  },
  onDisable: () => {
    // This doesn't work for some reason?
    Calc.controller.updateViews();
  },
  enabledByDefault: false,
  /* Has module overrides */
} as const;
export default betterEvaluationView;
