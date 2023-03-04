import { Plugin } from "plugins";

const folderTools: Plugin = {
  id: "folder-tools",
  // Still need to declare empty onEnable and onDisable to get the right UI
  onEnable: () => {},
  onDisable: () => {},
  enabledByDefault: true,
  /* Has module overrides */
};
export default folderTools;
