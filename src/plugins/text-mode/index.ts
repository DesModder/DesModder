import Controller from "./Controller";
import { Calc } from "globals/window";
import { Plugin } from "plugins";

const controller = new Controller();

const textMode: Plugin = {
  id: "text-mode",
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
  enabledByDefault: false,
  /* Has module overrides */
};
export default textMode;
