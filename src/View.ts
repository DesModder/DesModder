import DCGView, { MountedComponent } from "DCGView";
import PillboxContainer from "components/PillboxContainer";
import { pollForValue } from "./utils";
import Controller from "./Controller";
import { Calc } from "globals/window";

export default class View {
  pillboxMountNode: HTMLElement | null = null;
  menuView: MountedComponent | null = null;
  controller: Controller | null = null;

  async init(controller: Controller) {
    this.controller = controller;
    await this.mountPillbox(controller);
    Calc.controller.dispatcher.register((e) => {
      if (
        e.type === "keypad/set-minimized" ||
        e.type === "close-graph-settings"
      ) {
        this.updatePillboxHeight();
      }
    });
  }

  async mountPillbox(controller: Controller) {
    const pillbox = await pollForValue(() =>
      document.querySelector(".dcg-overgraph-pillbox-elements")
    );
    this.pillboxMountNode = document.createElement("div");
    pillbox.insertBefore(
      this.pillboxMountNode,
      pillbox.querySelector(".dcg-zoom-container")
    );
    this.menuView = DCGView.mountToNode(
      PillboxContainer,
      this.pillboxMountNode,
      {
        controller: () => controller,
      }
    );
  }

  updatePillboxHeight() {
    if (Calc.controller.isGraphSettingsOpen()) {
      return;
    }
    const pillboxContainer = document.querySelector(
      ".dcg-overgraph-pillbox-elements"
    ) as HTMLElement | null;
    if (pillboxContainer !== null) {
      // accounting for future contingency where keypad is actually allowed
      // to be open (maybe when popover integreated into main Desmodder components)
      const t = Calc.controller.isKeypadOpen()
        ? Calc.controller.getKeypadHeight()
        : 0;
      console.log("EF", this.controller?.pillboxMenuOpen);
      const bottom =
        this.controller && this.controller.pillboxMenuOpen !== null
          ? t + "px"
          : "auto";
      pillboxContainer.style.bottom = bottom;
    }
  }

  updateMenuView() {
    this.menuView && this.menuView.update();
    this.updatePillboxHeight();
  }
}
