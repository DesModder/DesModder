import { DesModderController } from "../../script";
import "./pinExpressions.less";
import { Calc } from "globals/window";
import { Plugin } from "plugins";

class Controller {
  constructor(private readonly controller: DesModderController) {}

  pinExpression(id: string) {
    if (Calc.controller.getItemModel(id)?.type !== "folder")
      this.controller.updateExprMetadata(id, {
        pinned: true,
      });
  }

  isExpressionPinned(id: string) {
    return (
      !Calc.controller.getExpressionSearchOpen() &&
      Calc.controller.getItemModel(id)?.type !== "folder" &&
      this.metaExprs[id]?.pinned
    );
  }

  unpinExpression(id: string) {
    this.controller.updateExprMetadata(id, {
      pinned: false,
    });
  }

  applyPinnedStyle() {
    const el = document.querySelector(".dcg-exppanel-container");
    const hasPinnedExpressions = Object.keys(this.metaExprs).some(
      (id) => this.metaExprs[id].pinned
    );
    el?.classList.toggle("dsm-has-pinned-expressions", hasPinnedExpressions);
  }

  get metaExprs() {
    return this.controller.graphMetadata.expressions;
  }
}

const pinExpressions: Plugin = {
  id: "pin-expressions",
  key: "pinExpressions",
  // Controller handles enable/disable by changing the results of isPinned
  // (used in modified module definitions), but we need to update views
  onEnable: (controller) => {
    Calc.controller.updateViews();
    return new Controller(controller);
  },
  onDisable: () => {
    Calc.controller.updateViews();
  },
  enabledByDefault: true,
  /* Has module overrides */
};
export default pinExpressions;
