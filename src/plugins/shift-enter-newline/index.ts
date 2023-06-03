import { PluginController } from "../PluginController";
import { Plugin } from "plugins";

export default class ShiftEnterNewline extends PluginController {
  static id = "shift-enter-newline" as const;
  static enabledByDefault = true;
}
ShiftEnterNewline satisfies Plugin;
