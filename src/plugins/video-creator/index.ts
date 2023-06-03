import { jquery, keys } from "../../utils/depUtils";
import Controller from "./Controller";
import { MainPopupFunc } from "./components/MainPopup";
import MainController from "main/Controller";
import { Plugin } from "plugins";

export let controller: Controller;

function onEnable(c: MainController) {
  controller = new Controller(c);
  c.pillboxMenus?.addPillboxButton({
    id: "dsm-vc-menu",
    tooltip: "video-creator-menu",
    iconClass: "dcg-icon-film",
    popup: () => MainPopupFunc(controller),
  });
  jquery(document).on("keydown.expanded-menu-view", (e: KeyboardEvent) => {
    if (keys.lookup(e) === "Esc" && controller.isPlayPreviewExpanded) {
      e.stopImmediatePropagation();
      controller.togglePreviewExpanded();
    }
  });
  return controller;
}

function onDisable() {
  controller.controller.pillboxMenus?.removePillboxButton("dsm-vc-menu");
  jquery(document).off(".expanded-menu-view");
}

const videoCreator: Plugin = {
  id: "video-creator",
  onEnable,
  onDisable,
  enabledByDefault: true,
};
export default videoCreator;
