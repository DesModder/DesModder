import MainController from "../../MainController";
import { CMPluginSpec } from "../../plugins";
import { Inserter } from "../../plugins/PluginController";
import { CMPlugin } from "../CMPlugin";
import { ActionButtons } from "./components/ActionButtons";
import { actionButtons } from "./facets/actionButton";
import { ViewPlugin } from "@codemirror/view";
import { ItemModel } from "globals/models";

export default class ExprActionButtons extends CMPlugin<undefined> {
  static id = "expr-action-buttons" as const;
  static enabledByDefault = true;

  destroy() {
    throw new Error(
      "Programming Error: core plugin Expression Action Buttons should not be disableable"
    );
  }

  actionButtonsView(m: ItemModel): Inserter {
    return () => ActionButtons(this, m);
  }

  order() {
    return this.view.state.facet(actionButtons);
  }
}

export interface ActionButton {
  tooltip: string;
  buttonClass: string;
  iconClass: string;
  predicate: (m: ItemModel) => boolean;
  onTap: (m: ItemModel) => void;
}

export interface ActionButtonWithKey extends ActionButton {
  key: string;
}

export function exprActionButtons(
  dsm: MainController
): CMPluginSpec<ExprActionButtons> {
  return {
    id: ExprActionButtons.id,
    category: "core-core",
    config: [],
    plugin: ViewPlugin.define((view) => new ExprActionButtons(view, dsm)),
    extensions: [],
  };
}
