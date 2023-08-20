import { PluginController } from "../PluginController";
import { Calc } from "globals/window";

export default class DebugMode extends PluginController {
  static id = "debug-mode" as const;
  static enabledByDefault = false;

  afterEnable() {
    // The displayed indexes are stored in some state somewhere, so
    // update the state first before updating views
    Calc.controller.updateTheComputedWorld();
  }

  afterDisable() {
    Calc.controller.updateTheComputedWorld();
  }
}
