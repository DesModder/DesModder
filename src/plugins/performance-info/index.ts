import Controller from "./Controller";
import { destroyView, initView } from "./View";
import { Plugin } from "plugins";

export let controller: Controller;

const performanceInfo: Plugin = {
  id: "performance-info",
  onEnable: () => {
    controller = new Controller();
    initView();
  },
  onDisable: () => {
    controller.stop();
    destroyView();
  },
  enabledByDefault: false,
} as const;
export default performanceInfo;
