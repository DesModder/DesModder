import { desModderController, jquery, keys, Calc } from "desmodder";
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

const captureFrameID = "video-creator-capture-frame";

function percentage(x: number) {
  return 100 * x + "%";
}

function applyCaptureFrame() {
  let frame = document.getElementById(captureFrameID);
  if (
    controller.focusedMQ === "capture-height" ||
    controller.focusedMQ === "capture-width"
  ) {
    if (frame === null) {
      frame = document.createElement("div");
      frame.id = captureFrameID;
      frame.style.outline = "9999px solid rgba(0, 0, 0, 0.6)";
      frame.style.position = "absolute";
      const canvas = document.querySelector("canvas.dcg-graph-inner");
      canvas?.parentNode?.appendChild(frame);
    }

    const mathBounds = Calc.graphpaperBounds.mathCoordinates;
    const ratio =
      controller.getCaptureHeightNumber() /
      controller.getCaptureWidthNumber() /
      (mathBounds.height / mathBounds.width);
    let width = 1;
    let height = 1;
    if (ratio > 1) {
      width = 1 / ratio;
    } else {
      height = ratio;
    }
    frame.style.width = percentage(width);
    frame.style.left = percentage((1 - width) / 2);
    frame.style.height = percentage(height);
    frame.style.top = percentage((1 - height) / 2);
  } else {
    if (frame !== null) {
      frame.parentNode?.removeChild(frame);
    }
  }
}

export function updateView() {
  applyCaptureFrame();
  desModderController.updateMenuView();
}
