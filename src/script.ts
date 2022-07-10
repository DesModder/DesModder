import Controller from "main/Controller";
import View from "main/View";
import window from "globals/window";
import "fonts/style.css";

const controller = new Controller();
const view = new View();
export { controller as desModderController };

window.DesModder = {
  view,
  controller,
  exposedPlugins: controller.exposedPlugins,
};

controller.init(view);
view.init(controller);
