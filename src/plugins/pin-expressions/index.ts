import { PluginController } from "../PluginController";
import "./pinExpressions.less";
import { Calc } from "globals/window";

export default class PinExpressions extends PluginController {
  static id = "pin-expressions" as const;
  static enabledByDefault = true;

  pinExpression(id: string) {
    if (Calc.controller.getItemModel(id)?.type !== "folder")
      this.controller.metadata?.updateExprMetadata(id, {
        pinned: true,
      });
  }

  isExpressionPinned(id: string) {
    return (
      !Calc.controller.getExpressionSearchOpen() &&
      Calc.controller.getItemModel(id)?.type !== "folder" &&
      this.controller.metadata?.getDsmItemModel(id)?.pinned
    );
  }

  unpinExpression(id: string) {
    this.controller.metadata?.updateExprMetadata(id, {
      pinned: false,
    });
  }

  applyPinnedStyle() {
    const el = document.querySelector(".dcg-exppanel-container");
    const hasPinnedExpressions = this.controller.metadata
      ?.getDsmItemModels()
      .some((v) => v.pinned);
    el?.classList.toggle("dsm-has-pinned-expressions", hasPinnedExpressions);
  }
}
