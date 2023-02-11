import * as almond from "./almond";
import { fullReplacementCached } from "./replacementHelpers/cacheReplacement";
import window from "globals/window";
import injectScript from "utils/injectScript";
import { postMessageUp, listenToMessageDown } from "utils/messages";
import { pollForValue } from "utils/utils";

/* This script is loaded at document_start, before the page's scripts, to give it 
time to set ALMOND_OVERRIDES and replace module definitions */

// workerAppend will get filled in from a message
let workerAppend: string = "console.error('worker append not filled in')";

if (window.ALMOND_OVERRIDES !== undefined) {
  window.alert(
    "Warning: you have a script installed that overrides modules definitions. " +
      "This is incompatible with some features of DesModder, " +
      "so try disabling Tampermonkey scripts."
  );
}

(window as any).require = almond.require;

window.ALMOND_OVERRIDES = {
  define: almond.define,
  require: almond.require,
  requirejs: almond.requirejs,
};

/** The calculator is not loaded as soon as toplevel/calculator_desktop is
 * loaded; toplevel/calculator_desktop sneakily contains a thenable, so it
 * returns before actually initializing the calculator. This leads to a race
 * condition, so poll for Calc being ready. */
function tryRunDesModder() {
  if (window.Calc !== undefined) runDesModder();
  else setTimeout(tryRunDesModder, 10);
}

function runDesModder() {
  listenToMessageDown((message) => {
    if (message.type === "set-script-url") {
      injectScript(message.value);
      // cancel listener
      return true;
    }
    return false;
  });
  postMessageUp({
    type: "get-script-url",
  });
}

function getCalcDesktopURL() {
  return (
    document.querySelector(
      "script[src^='/assets/build/calculator_desktop']"
    ) as HTMLScriptElement
  )?.src;
}

void pollForValue(getCalcDesktopURL).then(async (srcURL: string) => {
  /* we blocked calculator_desktop.js earlier to ensure that the preload/override script runs first.
  Now we load it, but with '?' appended to prevent the web request rules from blocking it */
  const calcDesktop = await (await fetch(srcURL + "?")).text();
  // Apply replacements
  const newCode = await fullReplacementCached(calcDesktop, workerAppend);
  // tryRunDesModder polls until the following eval'd code is done.
  tryRunDesModder();
  // eslint-disable-next-line no-eval
  (0, eval)(newCode);
});

listenToMessageDown((message) => {
  if (message.type === "set-worker-append-url") {
    void fetch(message.value).then(async (response) => {
      workerAppend = await response.text();
    });
    // cancel listener
    return true;
  }
  return false;
});
postMessageUp({
  type: "get-worker-append-url",
});
