export const configList = [
  {
    key: "clickableObjects",
    name: "Clickable Objects",
    description: "Enable simulations and clickable objects (buttons)",
    type: "boolean",
    default: true,
  },
  {
    key: "advancedStyling",
    name: "Advanced Styling",
    description: "Enable label editing, text outline, and show-on-hover",
    type: "boolean",
    default: true,
  },
  {
    key: "administerSecretFolders",
    name: "Administer Secret Folders",
    // description: "Create hidden folders",
    type: "boolean",
    default: false,
  },
  // `as const` ensure that the key values can be used as types
  // instead of the type 'string'
] as const;

export interface Config {
  clickableObjects: boolean;
  advancedStyling: boolean;
  administerSecretFolders: boolean;
}
