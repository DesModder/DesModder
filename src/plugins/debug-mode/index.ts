import { PluginController } from "../PluginController";
import { Calc } from "#globals";

export default class DebugMode extends PluginController {
  static id = "debug-mode" as const;
  static enabledByDefault = false;

  afterEnable() {
    // The displayed indexes are stored in some state somewhere, so
    // update the state first before updating views
    Calc.controller.updateTheComputedWorld();
    this.dsm.textMode?.updateDebugMode();
  }

  afterDisable() {
    Calc.controller.updateTheComputedWorld();
    this.dsm.textMode?.updateDebugMode();
  }
}
