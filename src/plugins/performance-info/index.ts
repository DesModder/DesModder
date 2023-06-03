import { jquery } from "../../utils/depUtils";
import Controller from "./Controller";
import { MainPopupFunc } from "./PerformanceView";
import { Plugin } from "plugins";

let controller: Controller;

const performanceInfo: Plugin = {
  id: "performance-info",
  key: "performanceInfo",
  onEnable: (c) => {
    controller = new Controller(c);
    const pm = c.enabledPlugins.pillboxMenus;
    pm?.addPillboxButton({
      id: "dsm-pi-menu",
      tooltip: "performance-info-name",
      iconClass: "dsm-icon-pie-chart",
      popup: () => MainPopupFunc(controller, c),
    });
    return controller;
  },
  onDisable: (c) => {
    controller.stop();
    const pm = c.enabledPlugins.pillboxMenus;
    pm?.removePillboxButton("dsm-pi-menu");
    jquery(document).off(".expanded-menu-view");
  },
  enabledByDefault: false,
} as const;
export default performanceInfo;
