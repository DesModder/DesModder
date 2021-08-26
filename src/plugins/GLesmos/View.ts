import { desModderController } from "desmodder";
import { MainPopupFunc } from "./components/MainPopup";
import Controller from "./Controller";

export function initView(controller: Controller) {
  desModderController.addPillboxButton({
    id: "dsm-glesmos-menu",
    tooltip: "GLesmos Menu",
    iconClass: "dcg-icon-magic",
    popup: () => MainPopupFunc(controller),
  });
}

export function destroyView() {
  desModderController.removePillboxButton("dsm-glesmos-menu");
}
