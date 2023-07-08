import { PillboxButton } from ".";
import { Facet } from "@codemirror/state";

export const pillboxButton = Facet.define<
  PillboxButton,
  readonly PillboxButton[]
>({
  combine: (values) => values,
  static: true,
});
