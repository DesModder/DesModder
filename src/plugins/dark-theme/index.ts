import { PluginController } from "../PluginController.ts";
import "./index.less";

export default class DarkTheme extends PluginController {
  static id = "dark-theme" as const;
  static enabledByDefault = false;

  afterEnable(): void {
    document.body.classList.add("dark");
  }

  afterDisable(): void {
    document.body.classList.remove("dark");
  }
}
