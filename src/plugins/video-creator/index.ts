import Controller from "./Controller";
import { initView, destroyView } from "./View";

export let controller: Controller;

function onEnable() {
  controller = new Controller();
  initView(); // async
  return controller;
}

function onDisable() {
  destroyView();
}

export default {
  id: "video-creator",
  onEnable,
  onDisable,
  enabledByDefault: true,
} as const;
