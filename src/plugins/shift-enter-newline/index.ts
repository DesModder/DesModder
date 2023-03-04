import { Plugin } from "plugins";

const shiftEnterNewline: Plugin = {
  id: "shift-enter-newline",
  // Still need to declare empty onEnable and onDisable to get the right UI
  onEnable: () => {},
  onDisable: () => {},
  enabledByDefault: true,
  /* Has module overrides */
} as const;
export default shiftEnterNewline;
