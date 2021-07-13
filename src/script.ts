import Controller from "main/Controller";
import View from "main/View";
import window from "globals/window";
import "fonts/style.css";

export const controller = new Controller();
const view = new View();

window.DesModder = {
  view,
  controller,
};

controller.init(view);
view.init(controller);
