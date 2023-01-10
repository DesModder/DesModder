import * as almond from "./almond";
import moduleReplacements from "./moduleReplacements";
import { tryApplyReplacement } from "./replacementHelpers/applyReplacement";
import { Block, ModuleBlock } from "./replacementHelpers/parse";
import window from "globals/window";
import injectScript from "utils/injectScript";
import { postMessageUp, listenToMessageDown } from "utils/messages";
import { pollForValue } from "utils/utils";

/* This script is loaded at document_start, before the page's scripts, to give it 
time to set ALMOND_OVERRIDES and replace module definitions */

// workerAppend will get filled in from a message
let workerAppend: string = "console.error('worker append not filled in ')";

const reachedReplacements = new Set<Block>();

/** Find the replacements with the given module name, and mark them as reached */
function matchingReplacements(moduleName: string) {
  const mr = moduleReplacements.filter(
    (r) => r.tag === "ModuleBlock" && r.modules.includes(moduleName)
  ) as ModuleBlock[];
  mr.forEach((r) => reachedReplacements.add(r));
  return mr;
}

function newDefine(
  moduleName: string,
  dependencies: string[],
  definition: Function
): void {
  if (moduleName === "text!worker_src_underlying") {
    const workerSource = definition() as string;
    definition = () => overrideWorkerSource(workerSource);
  } else {
    const mr = matchingReplacements(moduleName);
    if (mr.length > 0) {
      const newCode = mr.reduce(
        (def, r) => tryApplyReplacement(r, def, moduleReplacements, moduleName),
        definition.toString()
      );
      // use `Function` instead of `eval` to force treatment as an expression
      // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
      definition = Function("return " + newCode)();
    }
  }
  if (moduleName === "toplevel/calculator_desktop") {
    doneLoading();
  }
  return almond.define(moduleName, dependencies, definition);
}

function overrideWorkerSource(src: string) {
  const lines = [];
  for (const line of src.split("\n")) {
    const match = line.match(/^define\(['"]([^'"]*)['"]/);
    if (match !== null) {
      const moduleName = match[1];
      const newCode = matchingReplacements(moduleName).reduce(
        (def, r) => tryApplyReplacement(r, def, moduleReplacements, moduleName),
        line
      );
      lines.push(newCode);
    } else {
      lines.push(line);
    }
  }
  // Place at the beginning of the code for the source mapping to line up
  // Call at the end of the code to run after modules defined
  return (
    `function loadDesModderWorker(){${workerAppend}\n}` +
    lines.join("\n") +
    "\nloadDesModderWorker();"
  );
}

function nameReplacement(r: Block) {
  return r.tag === "ModuleBlock"
    ? `${r.plugin} replacement "${r.heading}" in modules: ${r.modules.join(
        ","
      )}`
    : `helper "${r.heading}" defining command "${r.commandName}"`;
}

function doneLoading() {
  const unusedReplacements = moduleReplacements.filter(
    (r) => !reachedReplacements.has(r)
  );
  for (const r of unusedReplacements) {
    // ignore defines in checking that they're all used
    if (r.tag !== "ModuleBlock") continue;
    console.error("Replacement not applied:", nameReplacement(r));
  }
}

// without this, you get Error: touchtracking missing jquery
newDefine.amd = {
  jQuery: true,
};

if (window.ALMOND_OVERRIDES !== undefined) {
  window.alert(
    "Warning: you have a script installed that overrides modules definitions. " +
      "This is incompatible with some features of DesModder, " +
      "so try disabling Tampermonkey scripts."
  );
}

window.ALMOND_OVERRIDES = {
  define: newDefine,
  require: almond.require,
  requirejs: almond.requirejs,
};

window.define = newDefine;
window.require = almond.require;

function alertFailure() {
  /* Assuming only the DOM API is available */
  if (document.getElementById("dsm-load-failure") !== null) {
    return;
  }
  const outerFailure = document.createElement("div");
  outerFailure.id = "dsm-load-failure";
  outerFailure.style.cssText = `
    position: absolute;
    inset: 0;
    z-index: 9999;
    background: white;
    padding: 2em;
    user-select: text;
  `;
  outerFailure.innerHTML = `
    <h2> Oh no! Desmos+DesModder failed to load properly. </h2>
    <p> Troubleshooting tips: </p>
    <ol>
      <li>
        Reload the page:
        <a onclick="window.location.reload();" href="">Reload</a>
      </li>
      <li>
        Open a new, blank graph:
        <a href="https://www.desmos.com/calculator" target="_blank">Open</a>
      </li>
      <li>
        Disable DesModder in ${
          BROWSER === "firefox" ? "about:addons" : "chrome://extensions"
        }.
      </li>
      <li>
        If #3 worked, DO NOT report this to Desmos. This is an issue with DesModder.
        Please report this to the DesModder devs on
        <a href="https://github.com/DesModder/DesModder/issues/new">GitHub</a>
        so we can fix it prompty.
      </li>
    </ol>
  `;
  document.body.appendChild(outerFailure);
}

function runDesModder() {
  // following lines added
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

void pollForValue(
  () =>
    (
      document.querySelector(
        "script[src^='/assets/build/calculator_desktop']"
      ) as HTMLScriptElement
    )?.src
).then((src: string) => {
  /* we blocked calculator_desktop.js earlier to ensure that the preload/override script runs first.
  Now we load it, but with '?' appended to prevent the web request rules from blocking it */
  const script = document.createElement("script");
  script.src = src + "?";
  script.async = false;
  script.onload = () => {
    // remove from DOM
    script.remove();
    runDesModder();
  };
  script.onerror = () => {
    console.error("Injected script onerror");
    alertFailure();
  };
  document.body.appendChild(script);
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
