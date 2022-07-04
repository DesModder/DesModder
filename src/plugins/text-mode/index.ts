import { Calc } from "globals/window";
import Controller from "./Controller";

const controller = new Controller();

export default {
  id: "text-mode",
  name: "Text Mode Option",
  description: "Add plaintext mode",
  onEnable: () => {
    Calc.controller.updateViews();
    return controller;
  },
  onDisable: () => {
    if (controller.inTextMode) controller.toggleTextMode();
  },
  afterDisable: () => {
    Calc.controller.updateViews();
  },
  enabledByDefault: true,
  /* Has module overrides */
} as const;
