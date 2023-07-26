import { format } from "./i18n/i18n-core";
import { drawGLesmosSketchToCtx } from "./plugins/GLesmos/drawGLesmosSketchToCtx";
import DSM from "MainController";
import "fonts/style.css";
import window from "globals/window";

const dsm = new DSM();

window.DesModder = {
  controller: dsm,
  format,
  drawGLesmosSketchToCtx,
  // Not used by DesModder, but some external scripts may still reference this
  exposedPlugins: dsm.enabledPlugins,
};
window.DSM = dsm;

dsm.init();
