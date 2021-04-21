import { DesmosRightClick } from "./backend";

const ENABLE_DEF = true;
const desmosRightClick = new DesmosRightClick(ENABLE_DEF);

function onEnable() {
  desmosRightClick.enable();
}

function onDisable() {
  desmosRightClick.disable();
}

export default {
  name: "Right Click Tray",
  description: "Open the expression menu with right click",
  onEnable: onEnable,
  onDisable: onDisable,
  enabledByDefault: ENABLE_DEF,
};
