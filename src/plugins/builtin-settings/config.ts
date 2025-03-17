export const settingsConfigList = [
  {
    key: "advancedStyling",
    type: "boolean",
    default: true,
  },
  {
    key: "graphpaper",
    type: "boolean",
    default: true,
  },
  {
    key: "zoomButtons",
    type: "boolean",
    default: true,
    shouldShow: (config: Config) => !!config.graphpaper,
  },
  {
    key: "expressions",
    type: "boolean",
    default: true,
    shouldShow: (config: Config) => !!config.graphpaper,
  },
  {
    key: "authorFeatures",
    type: "boolean",
    default: false,
  },
  {
    key: "pointsOfInterest",
    type: "boolean",
    default: true,
  },
  {
    key: "trace",
    type: "boolean",
    default: true,
  },
  {
    key: "keypad",
    name: "Show keypad",
    type: "boolean",
    default: true,
  },
  {
    key: "showPerformanceMeter",
    name: "Show performance meter",
    type: "boolean",
    default: false,
  },
  // `as const` ensures that the key values can be used as types
  // instead of the type 'string'
] as const;

export const specialConfigList = [
  {
    key: "showIDs",
    name: "Show IDs",
    type: "boolean",
    default: false,
  },
] as const;

export const configList = [...settingsConfigList, ...specialConfigList];

export interface SettingsConfig {
  advancedStyling: boolean;
  graphpaper: boolean;
  authorFeatures: boolean;
  pointsOfInterest: boolean;
  trace: boolean;
  /** We will ignore expressions (treat it as true) if graphpaper is false. */
  expressions: boolean;
  /** We will ignore zoomButtons (treat it as false) if graphpaper is false. */
  zoomButtons: boolean;
  keypad: boolean;
  showPerformanceMeter: boolean;
}

export interface Config extends SettingsConfig {
  showIDs: boolean;
}
