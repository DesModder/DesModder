import { Calc } from "globals/window";
import { OptionalProperties } from "utils/utils";
import { getQueryParams } from "utils/depUtils";
import { Config, configList } from "./config";

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
    if (false === proposedConfig.graphpaper) {
      newChanges.graphpaper = true;
    }
  }
  if (false === changes.graphpaper && proposedConfig.zoomButtons) {
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

export default {
  id: "builtin-settings",
  onEnable: onEnable,
  onDisable: onDisable,
  enabledByDefault: true,
  config: configList,
  onConfigChange(changes: ConfigOptional) {
    // called only when plugin is active
    Calc.updateSettings(changes);
  },
  manageConfigChange,
} as const;
