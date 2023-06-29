import { addForceDisabled } from "../panic/panic";
import moduleReplacements from "./moduleReplacements";
import { fullReplacementCached } from "./replacementHelpers/cacheReplacement";
import window from "globals/window";
import injectScript from "utils/injectScript";
import { postMessageUp, listenToMessageDown, arrayToSet } from "utils/messages";
import { pollForValue } from "utils/utils";

/* This script is loaded at document_start, before the page's scripts */

/** The calculator is not loaded as soon as toplevel/calculator_desktop is
 * loaded; toplevel/calculator_desktop sneakily contains a thenable, so it
 * returns before actually initializing the calculator. This leads to a race
 * condition, so poll for Calc being ready. */
function tryRunDesModder() {
  if (window.Calc !== undefined) runDesModder();
  else setTimeout(tryRunDesModder, 10);
}

let scriptURL: string;

function runDesModder() {
  injectScript(scriptURL);
}

function getCalcDesktopURL() {
  return (
    (document.querySelector("script[src*='calculator_desktop']") ??
      document.querySelector(
        "script[src*='calculator_geometry']"
      )) as HTMLScriptElement
  )?.src;
}

async function load(pluginsForceDisabled: Set<string>) {
  const srcURL = await pollForValue(getCalcDesktopURL);
  /* we blocked calculator_desktop.js earlier to ensure that the preload/override script runs first.
  Now we load it, but with '?' appended to prevent the web request rules from blocking it */
  const calcDesktop = await (await fetch(srcURL + "?")).text();
  // Filter out force-disabled replacements
  const enabledReplacements = moduleReplacements.filter(
    (r) => !r.plugins.every((p) => pluginsForceDisabled.has(p))
  );
  // Apply replacements
  const newCode = await fullReplacementCached(calcDesktop, enabledReplacements);
  // tryRunDesModder polls until the following eval'd code is done.
  tryRunDesModder();
  // eslint-disable-next-line no-eval
  (0, eval)(newCode);
  delete (window as any).dsm_workerAppend;
}

listenToMessageDown((message) => {
  if (message.type === "apply-initial-data") {
    message.pluginsForceDisabled.forEach((disabledPlugin) =>
      addForceDisabled(disabledPlugin)
    );
    scriptURL = message.scriptURL;
    window.DesModderPreload = {
      pluginsForceDisabled: arrayToSet(message.pluginsForceDisabled),
      pluginsEnabled: message.pluginsEnabled,
      pluginSettings: message.pluginSettings,
    };
    // Helps with the case of replacements ran before initialization
    window.DSM = {} as any;
    void load(arrayToSet(message.pluginsForceDisabled));
    // cancel listener
    return true;
  }
  return false;
});

postMessageUp({ type: "get-initial-data" });
