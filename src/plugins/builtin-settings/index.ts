import { Config, configList } from "./config";
import { Calc } from "globals/window";
import { Plugin } from "plugins";
import { getQueryParams } from "utils/depUtils";
import { OptionalProperties } from "utils/utils";

type ConfigOptional = OptionalProperties<Config>;

const managedKeys = configList.map((e) => e.key);

let initialSettings: null | Config = null;

function manageConfigChange(current: Config, changes: ConfigOptional) {
  const proposedConfig = {
    ...current,
    ...changes,
  };
  const newChanges = {
    ...changes,
  };
  if (changes.zoomButtons) {
    if (!proposedConfig.graphpaper) {
      newChanges.graphpaper = true;
    }
  }
  if (changes.graphpaper === false && proposedConfig.zoomButtons) {
    newChanges.zoomButtons = false;
  }
  return newChanges;
}

function onEnable(config: Config) {
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
  const queryConfig: ConfigOptional = {};
  for (const key of managedKeys) {
    if (queryParams[key]) {
      queryConfig[key] = true;
    }
    if (queryParams["no" + key]) {
      queryConfig[key] = false;
    }
  }
  const newChanges = manageConfigChange(config, queryConfig);
  Calc.updateSettings({
    ...config,
    ...newChanges,
  });
}

function onDisable() {
  if (initialSettings !== null) {
    Calc.updateSettings(initialSettings);
  }
}

const builtinSettings: Plugin = {
  id: "builtin-settings",
  onEnable,
  onDisable,
  enabledByDefault: true,
  config: configList,
  onConfigChange(changes: ConfigOptional) {
    // called only when plugin is active
    Calc.updateSettings(changes);
  },
  manageConfigChange,
};
export default builtinSettings;
