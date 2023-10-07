import { format } from "#i18n";
import { drawGLesmosSketchToCtx } from "./plugins/GLesmos/drawGLesmosSketchToCtx";
import DSM from "#DSM";
import "./fonts/style.css";
import window, { Calc } from "#globals";

const dsm = new DSM((window as any).Calc as Calc);

window.DesModder = {
  controller: dsm,
  format,
  drawGLesmosSketchToCtx,
  // Not used by DesModder, but some external scripts may still reference this
  exposedPlugins: dsm.enabledPlugins,
};
window.DSM = dsm;

dsm.init();
