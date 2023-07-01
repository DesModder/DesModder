import { PluginController } from "../PluginController";
import "./compact.less";
import { Config, configList } from "./config";

export default class CompactView extends PluginController<Config> {
  static id = "compact-view" as const;
  static enabledByDefault = false;
  static config = configList;

  afterConfigChange(): void {
    if (this.settings.removeSpacing) {
      document.body.classList.add("compact-view-remove-spacing-enabled");
    } else {
      document.body.classList.remove("compact-view-remove-spacing-enabled");
    }

    document.body.style.setProperty(
      "--math-font-size",
      `${this.settings.mathFontSize}px`
    );
    document.body.style.setProperty(
      "--text-font-size",
      `${this.settings.textFontSize}px`
    );
    document.body.style.setProperty(
      "--bracket-font-size-factor",
      `${this.settings.bracketFontSizeFactor}em`
    );

    document.body.style.setProperty(
      "--minimum-font-size",
      `${this.settings.minimumFontSize}px`
    );
  }

  afterEnable() {
    this.afterConfigChange();
  }

  afterDisable() {}
}
