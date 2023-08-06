import { ConfigDefaultsAdvanced } from "./generate-css";
import { ConfigItem } from "plugins";

export { ConfigDefaultsAdvanced } from "./generate-css";

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
      type: "string",
      default: "Default",
      key: "themeName",
    },
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
