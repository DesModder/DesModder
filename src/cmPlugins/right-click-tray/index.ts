import MainController from "../../MainController";
import { CMPluginSpec } from "../../plugins";
import { CMPlugin } from "../CMPlugin";
import { ViewPlugin } from "@codemirror/view";

export default class RightClickTray extends CMPlugin {
  static id = "right-click-tray" as const;
  static enabledByDefault = true;

  // modified by replacement
  public stopNextContextMenu = false;
}

export function rightClickTray(
  dsm: MainController
): CMPluginSpec<RightClickTray> {
  return {
    id: RightClickTray.id,
    category: "utility",
    config: [],
    plugin: ViewPlugin.define((view) => new RightClickTray(view, dsm)),
    extensions: [],
  };
}
