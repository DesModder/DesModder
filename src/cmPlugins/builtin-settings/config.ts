export const configList = [
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
    key: "expressions",
    type: "boolean",
    default: true,
  },
  {
    key: "expressionsTopbar",
    type: "boolean",
    default: true,
  },
  {
    key: "border",
    type: "boolean",
    default: false,
  },
  {
    key: "keypad",
    name: "Show keypad",
    type: "boolean",
    default: true,
  },
  {
    key: "qwertyKeyboard",
    type: "boolean",
    default: true,
  },
  // `as const` ensures that the key values can be used as types
  // instead of the type 'string'
] as const;

export interface Config {
  advancedStyling: boolean;
  graphpaper: boolean;
  authorFeatures: boolean;
  pointsOfInterest: boolean;
  trace: boolean;
  expressions: boolean;
  zoomButtons: boolean;
  expressionsTopbar: boolean;
  border: boolean;
  keypad: boolean;
  qwertyKeyboard: boolean;
}
