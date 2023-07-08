import { PluginController } from "../PluginController";

export default class ShiftEnterNewline extends PluginController {
  static id = "shift-enter-newline" as const;
  static enabledByDefault = true;
  static category = "utility";
}
