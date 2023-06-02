import { MainPopupFunc } from "./PerformanceView";
import { controller } from "./index";
import MainController from "main/Controller";
import { jquery } from "utils/depUtils";

export function initView(mainController: MainController) {
  mainController.addPillboxButton({
    id: "dsm-pi-menu",
    tooltip: "performance-info-name",
    iconClass: "dsm-icon-pie-chart",
    popup: () => MainPopupFunc(controller, mainController),
  });
}

export function destroyView(controller: MainController) {
  controller.removePillboxButton("dsm-pi-menu");
  jquery(document).off(".expanded-menu-view");
}

export function updateView(controller: MainController) {
  controller.updateExtraComponents();
}
