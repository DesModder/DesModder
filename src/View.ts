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
    const pillbox = (await pollForValue(() =>
      document.querySelector(".dcg-overgraph-pillbox-elements")
    )) as HTMLElement;
    /*
     * pillbox is shaped like:
     * <div class="dcg-overgraph-pillbox-elements">
     *   <div /> <!-- may be empty (stand-in for the wrench settings) -->
     *   <div /> <!-- may be empty (stand-in for the reset button) -->
     *   <div /> <!-- may be empty (stand-in for the zoom & home buttons) -->
     * </div>
     *
     * If Calc.settings.settingsMenu === false and Calc.settings.zoomButtons === false,
     * and there is no saved state to warrant a reset button,
     * then the ENTIRE pillbox is hidden, so pillbox would be null,
     * and pollForValue would not resolve until the element is inserted.
     *
     * So, pillbox should not be null.
     */
    this.pillboxMountNode = document.createElement("div");
    // we want to insert pillboxMountNode after the wrench settings and
    // before the reset/zoom button
    pillbox.insertBefore(
      this.pillboxMountNode,
      pillbox.firstElementChild!.nextElementSibling
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
