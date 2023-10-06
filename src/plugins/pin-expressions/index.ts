import { Inserter, PluginController } from "../PluginController";
import { ActionButton } from "../expr-action-buttons";
import { ListView, PinnedPanel } from "./components/PinnedPanel";
import "./pinExpressions.less";
import { Calc } from "#globals";

export default class PinExpressions extends PluginController {
  static id = "pin-expressions" as const;
  static enabledByDefault = true;

  actionButtons: ActionButton[] = [
    {
      tooltip: "pin-expressions-pin",
      buttonClass: "dsm-pin-button",
      iconClass: "dsm-icon-bookmark",
      onTap: (model) => this.pinExpression(model.id),
      predicate: (model) =>
        model.type !== "folder" && !this.isExpressionPinned(model.id),
    },
    {
      tooltip: "pin-expressions-unpin",
      buttonClass: "dsm-unpin-button dcg-selected",
      iconClass: "dsm-icon-bookmark",
      onTap: (model) => this.unpinExpression(model.id),
      predicate: (model) =>
        model.type !== "folder" && this.isExpressionPinned(model.id),
    },
  ];

  pinExpression(id: string) {
    if (Calc.controller.getItemModel(id)?.type !== "folder")
      this.dsm.metadata?.updateExprMetadata(id, {
        pinned: true,
      });
  }

  isExpressionPinned(id: string) {
    return (
      !Calc.controller.getExpressionSearchOpen() &&
      Calc.controller.getItemModel(id)?.type !== "folder" &&
      (this.dsm.metadata?.getDsmItemModel(id)?.pinned ?? false)
    );
  }

  unpinExpression(id: string) {
    this.dsm.metadata?.updateExprMetadata(id, {
      pinned: false,
    });
  }

  applyPinnedStyle() {
    const el = document.querySelector(".dcg-exppanel-container");
    const hasPinnedExpressions = this.dsm.metadata
      ?.getDsmItemModels()
      .some((v) => v.pinned);
    el?.classList.toggle("dsm-has-pinned-expressions", hasPinnedExpressions);
  }

  pinnedPanel(listView: ListView): Inserter {
    return () => PinnedPanel(this, listView);
  }
}
