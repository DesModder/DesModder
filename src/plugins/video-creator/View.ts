import { MainPopupFunc } from "./components/MainPopup";
import { controller } from "./index";
import { Calc } from "globals/window";
import { desModderController } from "script";
import { jquery, keys } from "utils/depUtils";

export function initView() {
  desModderController.addPillboxButton({
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
}

export function destroyView() {
  desModderController.removePillboxButton("dsm-vc-menu");
  jquery(document).off(".expanded-menu-view");
}

const captureFrameID = "dsm-vc-capture-frame";

function percentage(x: number) {
  return `${100 * x}%`;
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
      frame.style.boxShadow = "inset 0 0 5px 0px rgba(255,255,255,0.8)";
      const canvas = document.querySelector("canvas.dcg-graph-inner");
      canvas?.parentNode?.appendChild(frame);
    }

    const pixelBounds = Calc.graphpaperBounds.pixelCoordinates;
    const ratio =
      controller.getCaptureHeightNumber() /
      controller.getCaptureWidthNumber() /
      (pixelBounds.height / pixelBounds.width);
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
