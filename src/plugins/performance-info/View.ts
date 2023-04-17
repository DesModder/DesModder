import { MainPopupFunc } from "./PerformanceView";
import { controller } from "./index";
import { desModderController } from "script";
import { jquery } from "utils/depUtils";

export function initView() {
  desModderController.addPillboxButton({
    id: "dsm-pi-menu",
    tooltip: "performance-info-name",
    iconClass: "dsm-icon-pie-chart",
    popup: (desModderController) =>
      MainPopupFunc(controller, desModderController),
  });
}

export function destroyView() {
  desModderController.removePillboxButton("dsm-pi-menu");
  jquery(document).off(".expanded-menu-view");
}

export function updateView() {
  desModderController.updateMenuView();
}
