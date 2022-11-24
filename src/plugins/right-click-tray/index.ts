import { onEnable, onDisable } from "./backend";
import { Plugin } from "plugins";

const rightClickTray: Plugin = {
  id: "right-click-tray",
  onEnable,
  onDisable,
  enabledByDefault: true,
} as const;
export default rightClickTray;
