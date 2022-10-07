import Controller from "./Controller";
import { InitView } from "./View";

export let controller: Controller;
export let view: ReturnType<typeof InitView>;

function onEnable() {
  controller = new Controller();
  view = InitView(controller);
  return controller;
}

function onDisable() {
  controller.deleteCanvas();
  view.destroyPillboxMenu();
}

export default {
  id: "GLesmos",
  onEnable: onEnable,
  onDisable: onDisable,
  enabledByDefault: false,
} as const;
