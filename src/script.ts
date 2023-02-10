import { addPanic } from "./panic/panic";
import { pollForValue } from "./utils/utils";
import "fonts/style.css";
import window from "globals/window";
import Controller from "main/Controller";
import View from "main/View";

let controller;
export { controller as desModderController };

try {
  controller = new Controller();
  const view = new View();

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
} catch (e) {
  addPanic("DesModder");
}
