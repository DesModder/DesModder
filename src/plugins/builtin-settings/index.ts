import { PluginController } from "../PluginController";
import { Config, configList } from "./config";

const managedKeys = configList.map((e) => e.key);

export default class BuiltinSettings extends PluginController<Config> {
  static id = "builtin-settings" as const;
  static enabledByDefault = true;
  static config = configList;
  initialSettings: null | Config = null;

  afterEnable() {
    this.initialSettings = { ...this.settings };
    for (const key of managedKeys) {
      this.initialSettings[key] =
        (
          this.calc.settings as typeof this.calc.settings & {
            advancedStyling: boolean;
            authorFeatures: boolean;
          }
        )[key] ?? false;
    }
    this.updateSettings(this.settings);
  }

  afterDisable() {
    if (this.initialSettings !== null)
      this.updateSettings(this.initialSettings);
  }

  afterConfigChange() {
    this.updateSettings(this.settings);
  }

  updateSettings(config: Config) {
    let { graphpaper, zoomButtons } = config;
    zoomButtons &&= graphpaper;
    // Deal with zoomButtons needing to be off before graphpaper is disabled
    // But graphpaper needs to be on before zoomButtons is enabled.
    if (graphpaper) this.calc.updateSettings({ graphpaper });
    if (!zoomButtons) this.calc.updateSettings({ zoomButtons });
    this.calc.updateSettings({ ...config, zoomButtons, graphpaper });
  }
}
