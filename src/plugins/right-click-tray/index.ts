import { onEnable, onDisable } from "./backend";

export default {
  id: "right-click-tray",
  onEnable: onEnable,
  onDisable: onDisable,
  enabledByDefault: true,
} as const;
