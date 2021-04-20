import { Calc } from "desmodder";
import { Config, configList } from "./config";

type ConfigOptional = {
  [K in keyof Config]?: Config[K];
};

const managedKeys = configList.map((e) => e.key);

let initialSettings: null | Config = null;

function onEnable(config: Config) {
  initialSettings = { ...config };
  for (const key of managedKeys) {
    initialSettings[key] = Calc.settings[key];
  }
  Calc.updateSettings(config);
}

function onDisable() {
  if (initialSettings !== null) {
    Calc.updateSettings(initialSettings);
  }
}

export default {
  name: "Desmos settings",
  description: "Modify settings built-in to Desmos, including clickableObjects",
  onEnable: onEnable,
  onDisable: onDisable,
  enabledByDefault: false,
  config: configList,
  onConfigChange(changes: ConfigOptional) {
    // called only when plugin is active
    Calc.updateSettings(changes);
  },
  manageConfigChange(current: Config, changes: ConfigOptional) {
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
      if (proposedConfig.lockViewport) {
        newChanges.lockViewport = false;
      }
    }
    if (changes.lockViewport && proposedConfig.zoomButtons) {
      newChanges.zoomButtons = false;
    }
    if (false === changes.graphpaper && proposedConfig.zoomButtons) {
      newChanges.zoomButtons = false;
    }
    return newChanges;
  },
};
