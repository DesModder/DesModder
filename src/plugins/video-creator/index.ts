import Controller from "./Controller";
import { initView, destroyView } from "./View";
import { Plugin } from "plugins";

export let controller: Controller;

function onEnable() {
  controller = new Controller();
  initView(); // async
  return controller;
}

function onDisable() {
  destroyView();
}

const videoCreator: Plugin = {
  id: "video-creator",
  onEnable,
  onDisable,
  enabledByDefault: true,
};
export default videoCreator;
