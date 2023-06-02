import "fonts/style.css";
import window from "globals/window";
import Controller from "main/Controller";

const controller = new Controller();
export { controller as desModderController, Controller as DesModderController };
export const DSM = controller.enabledPlugins;

window.DesModder = {
  controller,
  // Not used by DesModder, but some external scripts may still reference this
  exposedPlugins: controller.enabledPlugins,
};
window.DSM = DSM;

controller.init();
