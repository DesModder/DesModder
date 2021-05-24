import { onEnable, onDisable } from "./backend";

export default {
  id: "right-click-tray",
  name: "Right Click Tray",
  description:
    "Allows you to right click the settings bubble (style circle) to open the settings tray instead of having to hold left click.",
  onEnable: onEnable,
  onDisable: onDisable,
  enabledByDefault: true,
} as const;
