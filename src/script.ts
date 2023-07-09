import { format } from "./i18n/i18n-core";
import MainController from "MainController";
import "fonts/style.css";
import window from "globals/window";
import { drawGLesmosSketchToCtx } from "plugins/GLesmos/drawGLesmosSketchToCtx";

const controller = new MainController();

window.DesModder = {
  controller,
  format,
  drawGLesmosSketchToCtx,
  // Not used by DesModder, but some external scripts may still reference this
  exposedPlugins: controller.enabledPlugins,
};
window.DSM = controller;

controller.init();
