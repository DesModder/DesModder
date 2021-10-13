import { Calc } from "desmodder";

export default {
  id: "show-tips",
  name: "Show Tips",
  description: "Show tips at the bottom of the expressions list.",
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
