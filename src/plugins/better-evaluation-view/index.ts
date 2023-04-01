import "./better-evaluation-view.less";
import { configList } from "./config";
import { Calc } from "globals/window";
import { Plugin } from "plugins";

const betterEvaluationView: Plugin = {
  id: "better-evaluation-view",
  onEnable: () => {
    Calc.controller.updateViews();
  },
  onDisable: () => {},
  afterDisable: () => {
    Calc.controller.updateViews();
  },
  config: configList,
  onConfigChange: () => {
    Calc.controller.updateViews();
  },
  enabledByDefault: true,
  /* Has module overrides */
};
export default betterEvaluationView;
