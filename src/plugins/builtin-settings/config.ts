export const configList = [
  {
    key: "advancedStyling",
    name: "Advanced styling",
    description:
      "Enable label editing, show-on-hover, text outline, and one-quadrant grid",
    type: "boolean",
    default: true,
  },
  {
    key: "graphpaper",
    name: "Graphpaper",
    type: "boolean",
    default: true,
  },
  {
    key: "administerSecretFolders",
    name: "Create hidden folders",
    type: "boolean",
    default: false,
  },
  {
    key: "pointsOfInterest",
    name: "Show points of interest",
    description: "Intercepts, holes, intersections, etc.",
    type: "boolean",
    default: true,
  },
  {
    key: "trace",
    name: "Trace along curves",
    type: "boolean",
    default: true,
  },
  {
    key: "lockViewport",
    name: "Lock Viewport",
    type: "boolean",
    default: false,
  },
  {
    key: "expressions",
    name: "Show Expressions",
    type: "boolean",
    default: true,
  },
  {
    key: "zoomButtons",
    name: "Show Zoom Buttons",
    type: "boolean",
    default: true,
  },
  {
    key: "expressionsTopbar",
    name: "Show Expressions Top Bar",
    type: "boolean",
    default: true,
  },
  {
    key: "border",
    name: "Border",
    description: "Subtle border around the calculator",
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
    name: "QWERTY Keyboard",
    type: "boolean",
    default: true,
  },
  // `as const` ensures that the key values can be used as types
  // instead of the type 'string'
] as const;

export interface Config {
  clickableObjects: boolean;
  advancedStyling: boolean;
  graphpaper: boolean;
  administerSecretFolders: boolean;
  pointsOfInterest: boolean;
  trace: boolean;
  lockViewport: boolean;
  expressions: boolean;
  zoomButtons: boolean;
  expressionsTopbar: boolean;
  border: boolean;
  keypad: boolean;
  qwertyKeyboard: boolean;
}
