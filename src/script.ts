import Controller from "Controller";
import View from "View";
import { pollForValue } from "utils";
import window from "globals/window";

export const controller = new Controller();
const view = new View();

window.DesModder = {
  view,
  controller,
};

pollForValue(() => window.Calc && window.Calc.controller).then(() => {
  controller.init(view);
  view.init(controller);
});
