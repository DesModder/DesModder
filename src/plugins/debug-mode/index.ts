import { PluginController } from "../PluginController";

export default class DebugMode extends PluginController {
  static id = "debug-mode" as const;
  static enabledByDefault = false;

  afterEnable() {
    // The displayed indexes are stored in some state somewhere, so
    // update the state first before updating views
    this.cc.updateTheComputedWorld();
  }

  afterDisable() {
    this.cc.updateTheComputedWorld();
  }
}
