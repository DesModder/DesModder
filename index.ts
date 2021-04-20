import { Calc } from "desmodder";
import { Config, configList } from "./config";

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
  onConfigChange<K extends keyof Config>(key: K, value: Config[K]) {
    Calc.updateSettings({
      [key]: value,
    });
  },
};
