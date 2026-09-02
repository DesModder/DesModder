import { PluginController } from "../PluginController";
import { Config, configList } from "./config";

const settingsKeys = configList.map((e) => e.key);

export default class BuiltinSettings extends PluginController<Config> {
  static id = "builtin-settings" as const;
  static enabledByDefault = true;
  static config = configList;
  initialSettings: null | Config = null;

  afterEnable() {
    this.initialSettings = { ...this.settings };
    for (const key of settingsKeys) {
      this.initialSettings[key] =
        (
          this.calc.settings as typeof this.calc.settings & {
            advancedStyling: boolean;
            authorFeatures: boolean;
            showPerformanceMeter: boolean;
            showIDs: boolean;
          }
        )[key] ?? false;
    }
    this.updateConfig(this.settings);
  }

  afterDisable() {
    if (this.initialSettings !== null) this.updateConfig(this.initialSettings);
  }

  afterConfigChange() {
    this.updateConfig(this.settings);
  }

  private updateSettings(config: Config) {
    let { graphpaper, zoomButtons, expressions } = config;
    // zoomButtons is only allowed to be true if graphpaper is true.
    zoomButtons &&= graphpaper;
    // expressions must be true if graphpaper is false, to avoid softlock
    // https://github.com/DesModder/DesModder/issues/982
    expressions ||= !graphpaper;
    // Deal with zoomButtons needing to be off before graphpaper is disabled
    // But graphpaper needs to be on before zoomButtons is enabled.
    if (graphpaper) this.calc.updateSettings({ graphpaper });
    if (!zoomButtons) this.calc.updateSettings({ zoomButtons });
    // Copy so that the extraneous entries of config (such as showIDs)
    // do not get sent to `updateSettings`.
    const settings: any = {};
    for (const key of settingsKeys) {
      settings[key] = config[key];
    }
    this.calc.updateSettings({
      ...settings,
      zoomButtons,
      graphpaper,
      expressions,
    });
  }

  updateConfig(config: Config) {
    this.updateSettings(config);
  }
}
