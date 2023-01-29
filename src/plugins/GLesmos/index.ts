import Controller from "./Controller";
import "./glesmos.less";
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
  enabledByDefault: true,
};
export default glesmos;
