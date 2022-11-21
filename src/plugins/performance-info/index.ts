import Controller from "./Controller";
import { destroyView, initView } from "./View";

export let controller: Controller;

export default {
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
