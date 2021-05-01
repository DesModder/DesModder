import Controller from "./Controller";
import View from "./View";

let view: View;
let controller: Controller;

function onEnable() {
  controller = new Controller();
  view = new View(controller);
  controller.init(view);
  view.initView(); // async
}

function onDisable() {
  view.destroyView();
}

export default {
  id: "video-creator",
  name: "Video Creator",
  description: "Easily export videos",
  onEnable: onEnable,
  onDisable: onDisable,
  enabledByDefault: true,
} as const;
