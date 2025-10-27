import DSM from "#DSM";
import "./fonts/style.css";
import window, { Calc } from "#globals";

const query = new URLSearchParams(window.location.search);

function initDsm() {
  const calc = (window as any).Calc as Calc;
  const dsm = new DSM(calc, {
    afterDestroy: () => {
      delete (window as any).DSM;
      delete (window as any).DesModder.controller;
      delete (window as any).DesModder.exposedPlugins;

      // `setTimeout` to wait until after the event loop, with the idea that
      // the `destroy()` callee is likely to run `initializeApi()` in the
      // same event loop.
      if (!query.has("dsmTestingSuppressAutoRestart"))
        setTimeout(() => {
          tryInitDsm();
        });
    },
  });

  window.DesModder.controller = dsm;
  // Not used by DesModder, but some external scripts may still reference this
  window.DesModder.exposedPlugins = dsm.enabledPlugins;
  window.DSM = dsm;

  dsm.init();
}

export function tryInitDsm() {
  if ((window as any).Calc !== undefined) initDsm();
  else setTimeout(tryInitDsm, 10);
}

if (query.has("dsmTestingDelayLoad")) {
  (window as any).tryInitDsm = tryInitDsm;
} else {
  tryInitDsm();
}
