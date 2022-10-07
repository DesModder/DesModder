import { jsx } from "DCGView";
import { format } from "i18n/i18n-core";
import { desModderController } from "script";
import Controller from "./Controller";

export function InitView(controller: Controller) {
    desModderController.addPillboxButton({
    id: "dsm-glesmos-menu",
    tooltip: format("glesmos-menu"),
    iconClass: "dcg-icon-image",
    popup: () => {
      return (
        <div class="dcg-popover-interior">
          <label>{format("glesmos-spread-across-multiple-frames")}</label>
          <input
            value={controller.canvas?.getSpeed()}
            type="number"
            onChange={(e: InputEvent) => {
              let elem = e.currentTarget as HTMLInputElement;
              let speed = Number(elem.value);
              speed = Math.max(1, Math.floor(speed));
              elem.value = speed.toString();
              controller.canvas?.setSpeed(speed);
            }}
          ></input>
        </div>
      );
    }
  });
  return {
    destroyPillboxMenu: () => {
        desModderController.removePillboxButton("dsm-glesmos-menu")
    }
  }
}
