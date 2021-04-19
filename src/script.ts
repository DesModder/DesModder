import Controller from "Controller";
import View from "View";
import { pollForValue } from "utils";
import window from "globals/window";
import plugins from "./plugins";

const controller = new Controller();
const view = new View();

window.DesModder = {
  view,
  controller,
  registerPlugin: controller.registerPlugin,
};

pollForValue(() => window.Calc && window.Calc.controller).then(() => {
  controller.init(view);
  view.init(controller);

  plugins.forEach((plugin) => {
    controller.registerPlugin(plugin);
  });
});
