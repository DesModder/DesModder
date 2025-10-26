import { format } from "#i18n";
import { drawGLesmosSketchToCtx } from "./plugins/GLesmos/drawGLesmosSketchToCtx";
import DSM from "#DSM";
import "./fonts/style.css";
import window, { Calc } from "#globals";

function initDsm() {
  const calc = (window as any).Calc as Calc;
  const dsm = new DSM(calc, {
    afterDestroy: () => {
      delete (window as any).DSM;
      delete (window as any).DesModder;

      // `setTimeout` to wait until after the event loop, with the idea that
      // the `destroy()` callee is likely to run `initializeApi()` in the
      // same event loop.
      setTimeout(() => {
        tryInitDsm();
      });
    },
  });

  window.DesModder = {
    controller: dsm,
    format,
    drawGLesmosSketchToCtx,
    // Not used by DesModder, but some external scripts may still reference this
    exposedPlugins: dsm.enabledPlugins,
  };
  window.DSM = dsm;

  dsm.init();
}

export function tryInitDsm() {
  if ((window as any).Calc !== undefined) initDsm();
  else setTimeout(tryInitDsm, 10);
}

tryInitDsm();
