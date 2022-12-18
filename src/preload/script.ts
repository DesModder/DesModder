import moduleOverrides from "./moduleOverrides";
import moduleReplacements from "./moduleReplacements";
import withDependencyMap from "./overrideHelpers/withDependencyMap";
import applyReplacement from "./replacementHelpers/applyReplacement";
import { Block } from "./replacementHelpers/parse";
import window from "globals/window";
import injectScript from "utils/injectScript";
import { postMessageUp, listenToMessageDown } from "utils/messages";
import { pollForValue } from "utils/utils";

/* This script is loaded at document_start, before the page's scripts, to give it 
time to set ALMOND_OVERRIDES and replace module definitions */

const reachedReplacements = new Set<Block>();

// assumes `oldDefine` gets defined before `newDefine` is needed
let oldDefine!: typeof window["define"];
function newDefine(
  moduleName: string,
  dependencies: string[],
  definition: Function
) {
  for (const r of moduleReplacements) {
    if (r.tag !== "ModuleBlock" || r.module !== moduleName) continue;
    reachedReplacements.add(r);
    try {
      definition = applyReplacement(r, definition);
    } catch (err) {
      console.error(`Error while applying ${nameReplacement(r)}:\n`, err);
    }
  }
  if (moduleName in moduleOverrides) {
    try {
      // override should either be `{dependencies, definition}` or just `definition`
      const override = withDependencyMap(moduleOverrides[moduleName])(
        definition,
        dependencies
      );
      definition = override;
    } catch (e) {
      alertFailure();
      throw e;
    }
  }
  if (moduleName === "toplevel/calculator_desktop") {
    doneLoading();
  }
  return oldDefine(moduleName, dependencies, definition);
}

function nameReplacement(r: Block) {
  return r.tag === "ModuleBlock"
    ? `${r.plugin} replacement "${r.heading}" in module "${r.module}"`
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
// trick to override `define`s
window.ALMOND_OVERRIDES = new Proxy(
  {},
  {
    get(target, prop, receiver) {
      if (prop === "define") {
        oldDefine = window.define;
        return newDefine;
      } else {
        return Reflect.get(target, prop, receiver);
      }
    },
  }
);

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
        or
        <a href="https://discord.gg/SdFsURWKvF">Discord</a>
        so we can fix it prompty.
      </li>
    </ol>
  `;
  document.body.appendChild(outerFailure);
}

function runCalculator() {
  /* The following script should have failed earlier because we blocked calculator_desktop.js.
  We copy it verbatim here to actually load the calculator. */

  window.require(
    ["toplevel/calculator_desktop", "testbridge", "jquery"],
    function (calcPromise: any, TestBridge: any, $: any) {
      $(".dcg-loading-div-container").hide();
      if (calcPromise === undefined) {
        console.error("No calc promise");
        alertFailure();
      }
      calcPromise.then(function (calc: any) {
        if (calc === undefined) {
          console.error("No calc");
          alertFailure();
        }
        window.Calc = calc;
        TestBridge.ready();
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
      });
    }
  );
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
    runCalculator();
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
      window.dsm_workerAppend = await response.text();
    });
    // cancel listener
    return true;
  }
  return false;
});
postMessageUp({
  type: "get-worker-append-url",
});
