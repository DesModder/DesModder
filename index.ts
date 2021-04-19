import { Calc } from "desmodder";

const defaultSettings = {
  clickableObjects: true,
  advancedStyling: true,
  administerSecretFolders: true,
};

const managedKeys = Object.keys(defaultSettings) as [
  keyof typeof defaultSettings
];

let initialSettings: null | typeof defaultSettings = null;

function onEnable() {
  initialSettings = { ...defaultSettings };
  for (const key of managedKeys) {
    initialSettings[key] = Calc.settings[key];
  }
  Calc.updateSettings(defaultSettings);
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
};
