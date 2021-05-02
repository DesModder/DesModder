import { desModderController } from "desmodder";
import { MainPopupFunc } from "./components/MainPopup";
import { controller } from "./index";

export function initView() {
  desModderController.addPillboxButton({
    id: "video-creator-menu",
    tooltip: "Video Creator Menu",
    iconClass: "dcg-icon-film",
    popup: () => MainPopupFunc(controller),
  });
}

export function destroyView() {
  desModderController.removePillboxButton("video-creator-menu");
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
