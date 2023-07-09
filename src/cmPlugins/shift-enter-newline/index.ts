import MainController from "../../MainController";
import { CMPluginSpec } from "../../plugins";
import { CMPlugin } from "../CMPlugin";
import { ViewPlugin } from "@codemirror/view";

export default class ShiftEnterNewline extends CMPlugin {
  static id = "shift-enter-newline" as const;
  static enabledByDefault = true;
}

export function shiftEnterNewline(
  dsm: MainController
): CMPluginSpec<ShiftEnterNewline> {
  return {
    id: ShiftEnterNewline.id,
    category: "utility",
    config: [],
    plugin: ViewPlugin.define((view) => new ShiftEnterNewline(view, dsm)),
    extensions: [],
  };
}
