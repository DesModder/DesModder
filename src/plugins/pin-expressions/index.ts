import { PluginController } from "../PluginController";
import "./pinExpressions.less";
import { Calc } from "globals/window";
import { Plugin } from "plugins";

export default class PinExpressions extends PluginController {
  static id = "pin-expressions" as const;
  static enabledByDefault = false;

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
PinExpressions satisfies Plugin;
