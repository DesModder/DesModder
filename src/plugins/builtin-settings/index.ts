import { PluginController } from "../PluginController";
import { Config, configList } from "./config";
import { Calc } from "#globals";
import { getQueryParams } from "#utils/depUtils.ts";

const managedKeys = configList.map((e) => e.key);

function updateSettings(config: Config) {
  let { graphpaper, zoomButtons } = config;
  zoomButtons &&= graphpaper;
  // Deal with zoomButtons needing to be off before graphpaper is disabled
  // But graphpaper needs to be on before zoomButtons is enabled.
  if (graphpaper) Calc.updateSettings({ graphpaper });
  if (!zoomButtons) Calc.updateSettings({ zoomButtons });
  Calc.updateSettings({ ...config, zoomButtons, graphpaper });
}

export default class BuiltinSettings extends PluginController<Config> {
  static id = "builtin-settings" as const;
  static enabledByDefault = true;
  static config = configList;
  initialSettings: null | Config = null;

  afterEnable() {
    this.initialSettings = { ...this.settings };
    const queryParams = getQueryParams();
    for (const key of managedKeys) {
      this.initialSettings[key] =
        (
          Calc.settings as typeof Calc.settings & {
            advancedStyling: boolean;
            authorFeatures: boolean;
          }
        )[key] ?? false;
    }
    const queryConfig: Partial<Config> = {};
    for (const key of managedKeys) {
      if (queryParams[key]) {
        queryConfig[key] = true;
      }
      if (queryParams["no" + key]) {
        queryConfig[key] = false;
      }
    }
    updateSettings(this.settings);
  }

  afterDisable() {
    if (this.initialSettings !== null) updateSettings(this.initialSettings);
  }

  afterConfigChange() {
    updateSettings(this.settings);
  }
}
