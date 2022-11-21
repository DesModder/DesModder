import { onEnable, onDisable } from "./backend";

export default {
  id: "right-click-tray",
  onEnable,
  onDisable,
  enabledByDefault: true,
} as const;
