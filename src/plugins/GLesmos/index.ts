import Controller from "./Controller";
import { Plugin } from "plugins";

export let controller: Controller;

function onEnable() {
  controller = new Controller();
  return controller;
}

function onDisable() {
  controller.deleteCanvas();
}

const glesmos: Plugin = {
  id: "GLesmos",
  onEnable,
  onDisable,
  enabledByDefault: false,
};
export default glesmos;
