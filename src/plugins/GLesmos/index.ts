import Controller from "./Controller";

export let controller: Controller;

function onEnable() {
  controller = new Controller();
  return controller;
}

function onDisable() {
  controller.deleteCanvas();
}

export default {
  id: "GLesmos",
  onEnable,
  onDisable,
  enabledByDefault: false,
} as const;
