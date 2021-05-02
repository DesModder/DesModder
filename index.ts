import Controller from "./Controller";
import { initView, destroyView } from "./View";

export let controller: Controller;

function onEnable() {
  controller = new Controller();
  initView(); // async
}

function onDisable() {
  destroyView();
}

export default {
  id: "video-creator",
  name: "Video Creator",
  description: "Easily export videos",
  onEnable: onEnable,
  onDisable: onDisable,
  enabledByDefault: true,
} as const;
