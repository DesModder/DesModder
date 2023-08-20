import { Inserter } from "../../preload/replaceElement";
import { PluginController } from "../PluginController";
import { ActionButtons } from "./components/ActionButtons";
import { facetsSpec } from "dataflow";
import { ItemModel } from "globals/models";

declare module "dataflow" {
  interface Facets {
    exprActionButtons: {
      input: ActionButtonSpec;
      output: Inserter<{ m: ItemModel }>;
    };
  }
}

interface ActionButtonSpec {
  plugin: string;
  buttons: ActionButton[];
}

export default class ExprActionButtons extends PluginController<undefined> {
  static id = "expr-action-buttons" as const;
  static enabledByDefault = true;

  facets = facetsSpec({
    exprActionButtons: {
      combine: (values) => {
        const order = values.flatMap(({ plugin, buttons }) =>
          buttons.map((b, i) => ({ ...b, key: `${plugin}:${i}` }))
        );
        return ({ m }) => ActionButtons(order, m);
      },
    },
  });

  beforeDisable() {
    throw new Error(
      "Programming Error: core plugin Expression Action Buttons should not be disableable"
    );
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
