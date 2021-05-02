import { onEnable, onDisable } from "./backend";

export default {
  id: "right-click-tray",
  name: "Right Click Tray",
  description: "Open the expression menu with right click",
  onEnable: onEnable,
  onDisable: onDisable,
  enabledByDefault: true,
} as const;
