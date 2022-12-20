import "./hide-errors.less";
import { Plugin } from "plugins";

const hideErrors: Plugin = {
  id: "hide-errors",
  // Still need to declare empty onEnable and onDisable to get the right UI
  onEnable: () => {},
  onDisable: () => {},
  alwaysEnabled: true,
  enabledByDefault: true,
  /* Has module overrides */
};
export default hideErrors;
