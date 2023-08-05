import { ConfigItem } from "plugins";

export const ConfigDefaultsSimple = {
  // ===================== SIMPLE MODE =====================

  // general
  simpleForeground: "#000000",
  simpleBackground: "#ffffff",
  simpleBackground2: "#ededed",
  simpleBorder: "#cecece",

  simpleButtonLight: "#ffffff",
  simpleButtonGray: "#f6f6f6",

  simpleToggleSwitch: "#666666",
  simpleToggleView: "#dddddd",
};

export const ConfigDefaultsAdvanced = {
  // =================== ADVANCED MODE ===================

  // general
  foreground: "#000000",
  background: "#ffffff",
  pillboxButtonBackground: "#ededed",
  sectionHeading: "#666666",
  checkboxLabel: "#333333",
  caretIcon: "#999999",

  // exppanel
  exppanelDraggerBackground: "#eeeeee",
  error: "#e66b3c",
  exppanelBorder: "#cecece",

  // exppanel top
  exprTopBarBackground1: "#fcfcfc",
  exprTopBarBackground2: "#eaeaea",
  redButtonBackground: "#ce4945",
  redButtonBorder: "#aa3a37",
  buttonText: "#ffffff",

  // expression settings menu
  expressionSettingsBorder: "#d3d3d3",

  // settings
  settingsMenuSeparator: "#dddddd",
  settingsAxisLabelLabelColor: "#666666",
  settingsAxisLabelInputColor: "#666666",

  // tooltips
  tooltipBackground: "#000000",
  tooltipForeground: "#ffffff",

  // toggles
  toggleSwitch: "#666666",
  toggleView: "#dddddd",

  // desmodder menu
  desmodderMenuTitle: "#222222",
  desmodderMenuDescription: "#444444",
  desmodderInputBorder: "#aaaaaa",
  desmodderCategorySeparator: "#e2e2e2",

  // keypad
  keypadBackground: "#ededed",
  keypadLightButtonBackground1: "#ffffff",
  keypadLightButtonBackground2: "#fafafa",
  keypadLightButtonBorder: "#d8d8d8",
  keypadLightGrayButtonBackground1: "#f6f6f6",
  keypadLightGrayButtonBackground2: "#f0f0f0",
  keypadDarkButtonBorder: "#bbbbbb",
};

export const ConfigDefaultsColors = {
  ...ConfigDefaultsSimple,
  ...ConfigDefaultsAdvanced,
};

export const ConfigDefaults = {
  advancedModeEnabled: false,
  ...ConfigDefaultsColors,
};

export const ConfigList: ConfigItem[] = (
  [
    {
      type: "boolean",
      default: false,
      key: "advancedModeEnabled",
    },
  ] as ConfigItem[]
).concat(
  Array.from(Object.entries(ConfigDefaultsColors)).map(([k, v]) => {
    const ci: ConfigItem = {
      type: "string",
      variant: "color",
      default: v,
      key: k,
      shouldShow: (ConfigDefaultsSimple as Record<string, string | undefined>)[
        k
      ]
        ? (s) => !s.advancedModeEnabled
        : (s) => s.advancedModeEnabled,
    };
    return ci as ConfigItem;
  })
);
