export default {
  id: "shift-enter-newline",
  name: "Shift+Enter Newline",
  description:
    "Use Shift+Enter to type newlines in notes and image/folder titles.",
  // Still need to declare empty onEnable and onDisable to get the right UI
  onEnable: () => {},
  onDisable: () => {},
  alwaysEnabled: true,
  enabledByDefault: true,
  /* Has module overrides */
} as const;
