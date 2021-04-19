import DCGView, { MountedComponent } from "DCGView";
import MenuContainer from "components/MenuContainer";
import { pollForValue } from "./utils";
import Controller from "./Controller";

export default class View {
  menuView: MountedComponent | null = null;

  async init(controller: Controller) {
    await this.mountToggles(controller);
  }

  async mountToggles(controller: Controller) {
    const pillbox = await pollForValue(() =>
      document.querySelector(".dcg-overgraph-pillbox-elements")
    );
    const rootNode = document.createElement("div");
    pillbox.insertBefore(
      rootNode,
      pillbox.querySelector(".dcg-zoom-container")
    );
    this.menuView = DCGView.mountToNode(MenuContainer, rootNode, {
      controller: () => controller,
    });
  }

  updateMenuView() {
    this.menuView && this.menuView.update();
  }
}
