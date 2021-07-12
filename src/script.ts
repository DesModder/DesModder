import Controller from "main/Controller";
import View from "main/View";
import { pollForValue } from "utils/utils";
import window from "globals/window";
import "fonts/style.css";

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
