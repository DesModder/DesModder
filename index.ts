import { Calc } from "desmodder";

let initialSettings: null | typeof Calc.settings = null;

function onEnable() {
  initialSettings = Calc.settings;
  Calc.updateSettings({
    clickableObjects: true,
    advancedStyling: true,
    administerSecretFolders: true,
  });
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
