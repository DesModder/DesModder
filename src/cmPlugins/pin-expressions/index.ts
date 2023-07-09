import MainController from "../../MainController";
import { CMPluginSpec } from "../../plugins";
import { Inserter } from "../../plugins/PluginController";
import { CMPlugin } from "../CMPlugin";
import { actionButtons } from "../expr-action-buttons/facets/actionButton";
import { ListView, PinnedPanel } from "./components/PinnedPanel";
import "./pinExpressions.less";
import { ViewPlugin } from "@codemirror/view";
import { Calc } from "globals/window";

export default class PinExpressions extends CMPlugin {
  static id = "pin-expressions" as const;
  static enabledByDefault = true;

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

export function pinExpressions(
  dsm: MainController
): CMPluginSpec<PinExpressions> {
  return {
    id: PinExpressions.id,
    category: "utility",
    config: [],
    plugin: ViewPlugin.define((view) => new PinExpressions(view, dsm), {
      provide: () =>
        actionButtons.of({
          plugin: "pin-expressions",
          buttons: [
            {
              tooltip: "pin-expressions-pin",
              buttonClass: "dsm-pin-button",
              iconClass: "dsm-icon-bookmark",
              onTap: (model) =>
                dsm.cmPlugin("pin-expressions")?.pinExpression(model.id),
              predicate: (model) =>
                model.type !== "folder" &&
                !dsm.cmPlugin("pin-expressions")?.isExpressionPinned(model.id),
            },
            {
              tooltip: "pin-expressions-unpin",
              buttonClass: "dsm-unpin-button dcg-selected",
              iconClass: "dsm-icon-bookmark",
              onTap: (model) =>
                dsm.cmPlugin("pin-expressions")?.unpinExpression(model.id),
              predicate: (model) =>
                model.type !== "folder" &&
                (dsm
                  .cmPlugin("pin-expressions")
                  ?.isExpressionPinned(model.id) ??
                  false),
            },
          ],
        }),
    }),
    extensions: [],
  };
}
