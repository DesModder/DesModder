import { ValueType } from "#globals";
import { PluginController } from "../PluginController";

export default class BetterFractionView extends PluginController {
  static id = "better-fraction-view" as const;
  static enabledByDefault = true;

  public readonly type = ValueType.ListOfNumber;
}
