import Controller from "./Controller";
import "./glesmos.less";
import { Plugin } from "plugins";

export let controller: Controller | null = null;

function onEnable() {
  // We never remove the controller on disable to fix #492 (some context gets
  // messed up), so we re-use the old controller on a re-enable.
  // This is a hacky fix. There should be a way to clean up the GLesmos code
  // to avoid needing this.
  if (controller === null) controller = new Controller();
  return controller;
}

function onDisable() {
  // Don't delete the canvas
}

const glesmos: Plugin = {
  id: "GLesmos",
  onEnable,
  onDisable,
  enabledByDefault: false,
};
export default glesmos;
