import { PluginController } from "../PluginController";
import "./compact.css";
import "./compact.less";
import { Config, configList } from "./config";

function toggleBodyClass(className: string, bool: boolean) {
  document.body.classList.toggle(className, bool);
}

export default class CompactView extends PluginController<Config> {
  static id = "compact-view" as const;
  static enabledByDefault = false;
  static config = configList;

  afterConfigChange(): void {
    toggleBodyClass(
      "compact-view-remove-spacing-enabled",
      this.settings.compactFactor > 0
    );
    toggleBodyClass(
      "compact-view-no-separating-lines",
      this.settings.noSeparatingLines
    );
    toggleBodyClass(
      "compact-view-highlight-alternating-lines",
      this.settings.highlightAlternatingLines
    );

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
    document.body.style.setProperty(
      "--dsm-compact-mode-multiplier",
      `${this.settings.compactFactor}`
    );
  }

  afterEnable() {
    this.afterConfigChange();
    document.body.classList.add("compact-view-enabled");
  }

  afterDisable() {
    document.body.classList.remove("compact-view-enabled");
  }
}
