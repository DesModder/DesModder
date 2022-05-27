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
  name: "GLesmos",
  description:
    "Render implicits on the GPU. Disabled on tab reload. Can cause the UI to slow down or freeze in rare cases; reload the page if you have issues.",
  onEnable: onEnable,
  onDisable: onDisable,
  enabledByDefault: false,
} as const;
