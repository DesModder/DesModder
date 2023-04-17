import { Plugin } from "plugins";
import { configList } from "./config";
import Controller from "./Controller";

export let controller: Controller

function onEnable(){
    controller = new Controller();
    return controller;
}

const CustomSave: Plugin = {
    id: "custom-save",
    onEnable,
    onDisable: () => {},
    config: configList,
    onConfigChange: () => {console.log("AAAAAAA")},
    enabledByDefault: false,
}
export default CustomSave;