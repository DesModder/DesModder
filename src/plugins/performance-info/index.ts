import Controller from "./Controller";
import { destroyView, initView } from "./View";
import { Plugin } from "plugins";

export let controller: Controller;

const performanceInfo: Plugin = {
  id: "performance-info",
  key: "performanceInfo",
  onEnable: (c) => {
    controller = new Controller(c);
    initView(c);
    return undefined;
  },
  onDisable: (c) => {
    controller.stop();
    destroyView(c);
  },
  enabledByDefault: false,
} as const;
export default performanceInfo;
