import { destroyView, initView } from "./View";
import Controller from "./Controller";

export let controller: Controller;

function onEnable() {
  controller = new Controller();
  initView(controller);
  controller.initCanvas();
  return controller;
}

function onDisable() {
  controller.deleteCanvas();
  destroyView();
}

export default {
  id: "GLesmos",
  name: "GLesmos",
  description: "Export as a GLSL fragment shader",
  onEnable: onEnable,
  onDisable: onDisable,
  enabledByDefault: true,
} as const;
