import Controller from "./Controller";
import { mountToNode, MountedComponent } from "DCGView";
import { PillboxContainer } from "components";
import { Calc } from "globals/window";
// Not good to have a specific workaround for this single plugin
import { createTipElement } from "plugins/show-tips/Tip";

export default class View {
  pillboxMountNode: HTMLElement | null = null;
  menuView: MountedComponent | null = null;
  controller: Controller | null = null;

  init(controller: Controller, pillbox: HTMLElement) {
    this.controller = controller;
    this.mountPillbox(controller, pillbox);
    Calc.controller.dispatcher.register((e) => {
      if (
        e.type === "keypad/set-minimized" ||
        e.type === "close-graph-settings"
      ) {
        this.updatePillboxHeight();
      }
    });
  }

  mountPillbox(controller: Controller, pillbox: HTMLElement) {
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
    this.menuView = mountToNode(PillboxContainer, this.pillboxMountNode, {
      controller: () => controller,
    });
  }

  updatePillboxHeight() {
    if (Calc.controller.isGraphSettingsOpen()) {
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
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
        this.controller?.pillboxMenuOpen !== null ? `${t}px` : "auto";
      pillboxContainer.style.bottom = bottom;
    }
  }

  updateMenuView() {
    this.menuView?.update();
    this.updatePillboxHeight();
  }

  createTipElement() {
    return createTipElement();
  }
}
