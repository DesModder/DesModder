import { Calc, OptionalProperties } from "desmodder";
import { Config, configList } from "./config";

type ConfigOptional = OptionalProperties<Config>;

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
  id: "builtin-settings",
  name: "Calculator Settings",
  description:
    "Lets you toggle features built-in to Desmos including simulations, clickable objects, and more." +
    " Most options apply only to your own browser and are ignored when you share graphs with others.",
  onEnable: onEnable,
  onDisable: onDisable,
  enabledByDefault: true,
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
} as const;
