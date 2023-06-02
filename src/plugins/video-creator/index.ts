import Controller from "./Controller";
import { initView, destroyView } from "./View";
import MainController from "main/Controller";
import { Plugin } from "plugins";

export let controller: Controller;

function onEnable(c: MainController) {
  controller = new Controller(c);
  initView(c); // async
  return controller;
}

function onDisable() {
  destroyView(controller.controller);
}

const videoCreator: Plugin = {
  id: "video-creator",
  key: "videoCreator",
  onEnable,
  onDisable,
  enabledByDefault: true,
};
export default videoCreator;
