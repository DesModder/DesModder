import { PluginController } from "plugins/PluginController";

export default class CustomMathQuillConfig extends PluginController {
  static id = "custom-mathquill-config" as const;
  static enabledByDefault = false;

  oldName = "";

  afterEnable() {
    console.log("on!");
  }

  afterDisable() {
    console.log("off!");
  }
}
