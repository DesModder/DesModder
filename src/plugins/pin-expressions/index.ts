import { PluginController } from "../PluginController";
import "./pinExpressions.less";
import { Calc } from "globals/window";
import { Plugin } from "plugins";

export class PinExpressions extends PluginController {
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
      this.controller.getDsmItemModel(id)?.pinned
    );
  }

  unpinExpression(id: string) {
    this.controller.updateExprMetadata(id, {
      pinned: false,
    });
  }

  applyPinnedStyle() {
    const el = document.querySelector(".dcg-exppanel-container");
    const hasPinnedExpressions = this.controller
      .getDsmItemModels()
      .some((v) => v.pinned);
    el?.classList.toggle("dsm-has-pinned-expressions", hasPinnedExpressions);
  }
}

const pinExpressions: Plugin = {
  id: "pin-expressions",
  // Controller handles enable/disable by changing the results of isPinned
  // (used in modified module definitions), but we need to update views
  onEnable: (controller) => {
    Calc.controller.updateViews();
    return new PinExpressions(controller);
  },
  onDisable: () => {
    Calc.controller.updateViews();
  },
  enabledByDefault: true,
  /* Has module overrides */
};
export default pinExpressions;
