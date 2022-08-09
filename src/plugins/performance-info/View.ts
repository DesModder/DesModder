import { jquery } from "utils/depUtils";
import { desModderController } from "script";
import { MainPopupFunc } from "./PerformanceView";
import { controller } from "./index";

export function initView() {
  desModderController.addPillboxButton({
    id: "dsm-pi-menu",
    tooltip: "Performance Info View",
    iconClass: "dsm-icon-pie-chart",
    popup: (desModderController) => MainPopupFunc(controller, desModderController),
  });
}

export function destroyView() {
  desModderController.removePillboxButton("dsm-pi-menu");
  jquery(document).off(".expanded-menu-view");
}

export function updateView() {
  desModderController.updateMenuView();
}
