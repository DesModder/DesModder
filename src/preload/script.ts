import * as almond from "./almond";
import moduleReplacements from "./moduleReplacements";
import { applyReplacements } from "./replacementHelpers/applyReplacement";
import window from "globals/window";
import jsTokens from "js-tokens";
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
  const newCode = applyReplacements(
    moduleReplacements.filter((r) => !r.workerOnly),
    calcDesktop
  );
  const newerCode = applyWorkerReplacements(newCode);
  // tryRunDesModder polls until the following eval'd code is done.
  tryRunDesModder();
  // eslint-disable-next-line no-eval
  (0, eval)(newerCode);
});

function applyWorkerReplacements(src: string): string {
  // Apply replacements to the worker. This could also be done by tweaking the
  // Worker constructor, but currently all of these replacements could be
  // performed outside the main page
  const tokens = Array.from(jsTokens(src));
  const workerCodeTokens = tokens.filter(
    (x) =>
      x.type === "StringLiteral" &&
      x.value.length > 200000 &&
      // JS is sure to have &&. Protects against translations getting longer
      // than the length cutoff, which is intentionally low in case of huge
      // improvements in minification.
      x.value.includes("&&")
  );
  if (workerCodeTokens.length > 1)
    throw new Error("More than one worker code found");
  const wcToken = workerCodeTokens[0];
  wcToken.value = JSON.stringify(
    // Place at the beginning of the code for the source mapping to line up
    // Call at the end of the code to run after modules defined
    `function loadDesModderWorker(){${workerAppend}\n}` +
      applyReplacements(
        moduleReplacements.filter((r) => r.workerOnly),
        // JSON.parse doesn't work because this is a single-quoted string.
        // js-tokens tokenized this as a string anyway, so it should be
        // safely eval'able to a string.
        // eslint-disable-next-line no-eval
        (0, eval)(wcToken.value) as string
      ) +
      "\nloadDesModderWorker();"
  );
  return tokens.map((x) => x.value).join("");
}

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
