import { Config, configList } from "./config";
import { Calc } from "globals/window";
import MainController from "main/Controller";
import { Plugin } from "plugins";
import { getQueryParams } from "utils/depUtils";

const managedKeys = configList.map((e) => e.key);

let initialSettings: null | Config = null;

function updateSettings(config: Config) {
  let { graphpaper, zoomButtons } = config;
  zoomButtons &&= graphpaper;
  // Deal with zoomButtons needing to be off before graphpaper is disabled
  // But graphpaper needs to be on before zoomButtons is enabled.
  if (graphpaper) Calc.updateSettings({ graphpaper });
  if (!zoomButtons) Calc.updateSettings({ zoomButtons });
  Calc.updateSettings({ ...config, zoomButtons, graphpaper });
}

function onEnable(_controller: MainController, config: Config) {
  initialSettings = { ...config };
  const queryParams = getQueryParams();
  for (const key of managedKeys) {
    initialSettings[key] =
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
  updateSettings(config);
  return undefined;
}

function onDisable() {
  if (initialSettings !== null) {
    updateSettings(initialSettings);
  }
}

const builtinSettings: Plugin = {
  id: "builtin-settings",
  onEnable,
  onDisable,
  enabledByDefault: true,
  config: configList,
  onConfigChange(config: Config) {
    // called only when plugin is active
    updateSettings(config);
  },
};
export default builtinSettings;
