import { MainPopupFunc } from "./PerformanceView";
import { controller } from "./index";
import { format } from "i18n/i18n-core";
import { desModderController } from "script";
import { jquery } from "utils/depUtils";

export function initView() {
  desModderController.addPillboxButton({
    id: "dsm-pi-menu",
    tooltip: format("performance-info-name"),
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
