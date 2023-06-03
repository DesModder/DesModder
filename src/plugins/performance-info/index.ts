import { jquery } from "../../utils/depUtils";
import Controller from "./Controller";
import { MainPopupFunc } from "./PerformanceView";
import { Plugin } from "plugins";

let controller: Controller;

const performanceInfo: Plugin = {
  id: "performance-info",
  onEnable: (c) => {
    controller = new Controller(c);
    c.pillboxMenus?.addPillboxButton({
      id: "dsm-pi-menu",
      tooltip: "performance-info-name",
      iconClass: "dsm-icon-pie-chart",
      popup: () => MainPopupFunc(controller, c),
    });
    return controller;
  },
  onDisable: (c) => {
    controller.stop();
    c.pillboxMenus?.removePillboxButton("dsm-pi-menu");
    jquery(document).off(".expanded-menu-view");
  },
  enabledByDefault: false,
} as const;
export default performanceInfo;
