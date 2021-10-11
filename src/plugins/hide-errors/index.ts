export default {
  id: "hide-errors",
  name: "Hide Errors",
  description: "Click error triangles to fade them and hide suggested sliders.",
  // Still need to declare empty onEnable and onDisable to get the right UI
  onEnable: () => {},
  onDisable: () => {},
  alwaysEnabled: true,
  enabledByDefault: true,
} as const;
