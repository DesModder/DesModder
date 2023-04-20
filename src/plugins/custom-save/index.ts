import Controller from "./Controller";
import { Plugin } from "plugins";

export let controller: Controller;

function onEnable() {
  controller = new Controller();
  return controller;
}

const CustomSave: Plugin = {
  id: "custom-save",
  onEnable,
  onDisable: () => {},
  onConfigChange: () => {
    console.log("AAAAAAA");
  },
  enabledByDefault: false,
};
export default CustomSave;
