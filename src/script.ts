import "fonts/style.css";
import window from "globals/window";
import Controller from "main/Controller";

const controller = new Controller();
export { controller as desModderController, Controller as DesModderController };

window.DesModder = {
  controller,
  exposedPlugins: controller.exposedPlugins,
};

controller.init();
