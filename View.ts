import { desModderController, jquery, keys } from "desmodder";
import { MainPopupFunc } from "./components/MainPopup";
import { controller } from "./index";

export function initView() {
  desModderController.addPillboxButton({
    id: "video-creator-menu",
    tooltip: "Video Creator Menu",
    iconClass: "dcg-icon-film",
    popup: () => MainPopupFunc(controller),
  });
  jquery(document).on("keydown.expanded-menu-view", (e: KeyboardEvent) => {
    if (keys.lookup(e) === "Esc" && controller.isPlayPreviewExpanded) {
      e.stopImmediatePropagation();
      controller.togglePreviewExpanded();
    }
  });
}

export function destroyView() {
  desModderController.removePillboxButton("video-creator-menu");
  jquery(document).off(".expanded-menu-view");
}

export function updateView() {
  desModderController.updateMenuView();
  // const showKeypadButton: HTMLElement | null = document.querySelector(
  //   ".dcg-show-keypad"
  // );
  // if (showKeypadButton !== null) {
  //   showKeypadButton.hidden =
  //     this.controller.isMainViewOpen && this.controller.isPlayPreviewExpanded;
  // }
}
