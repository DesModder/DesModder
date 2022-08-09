import Controller from "./Controller";
import { destroyView, initView } from "./View";

export let controller: Controller;

export default {
  id: "performance-info",
  name: "Performance Display",
  description:
    "Displays information about the performance of the current graph.",
  onEnable: () => {
    controller = new Controller();
    initView();
  },
  onDisable: () => {
    destroyView();
  },
  enabledByDefault: false,
} as const;
