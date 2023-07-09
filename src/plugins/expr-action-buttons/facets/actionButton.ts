import { ActionButton, ActionButtonWithKey } from "..";
import { Facet } from "@codemirror/state";

export const actionButtons = Facet.define<
  { plugin: string; buttons: ActionButton[] },
  ActionButtonWithKey[]
>({
  combine: (values) =>
    values.flatMap(({ plugin, buttons }) =>
      buttons.map((b, i) => ({ ...b, key: `${plugin}:${i}` }))
    ),
  static: true,
});
