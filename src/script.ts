import { pollForValue } from "./utils/utils";
import "fonts/style.css";
import window from "globals/window";
import Controller from "main/Controller";
import View from "main/View";

const controller = new Controller();
const view = new View();
export { controller as desModderController };

window.DesModder = {
  view,
  controller,
  exposedPlugins: controller.exposedPlugins,
};
void (async () => {
  const pillbox = (await pollForValue(() =>
    document.querySelector(".dcg-overgraph-pillbox-elements")
  )) as HTMLElement;
  controller.init(view);
  view.init(controller, pillbox);
})();
