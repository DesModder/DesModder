import { Calc } from "globals/window";
import Controller from "./Controller";

const controller = new Controller();

export default {
  id: "text-mode",
  name: "Text Mode BETA",
  description: "Add plaintext mode. Temporary documentation:",
  descriptionLearnMore:
    "https://github.com/DesModder/DesModder/tree/main/src/plugins/text-mode/docs/intro.md",
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
