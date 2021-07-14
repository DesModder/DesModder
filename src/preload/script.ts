import window from "globals/window";
import {
  pluginModuleOverrides,
  moduleOverridePluginList,
  ModuleOverrides,
} from "plugins/moduleOverridePlugins";
import { postMessageUp, listenToMessageDown } from "utils/messages";
import injectScript from "utils/injectScript";
import { pollForValue } from "utils/utils";

/* This script is loaded at document_start, before the page's scripts, to give it 
time to set ALMOND_OVERRIDES and replace module definitions */

let defineOverrides = {} as ModuleOverrides;
for (let pluginID of moduleOverridePluginList) {
  defineOverrides = {
    ...defineOverrides,
    ...(pluginModuleOverrides[pluginID] ?? {}),
  };
}

// assumes `oldDefine` gets defined before `newDefine` is needed
let oldDefine!: typeof window["define"];
function newDefine(
  moduleName: string,
  dependencies: string[],
  definition: Function
) {
  if (moduleName in defineOverrides) {
    // override should either be `{dependencies, definition}` or just `definition`
    console.debug("transforming", moduleName);
    const override = defineOverrides[moduleName](definition, dependencies);
    definition = override;
  }
  return oldDefine(moduleName, dependencies, definition);
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

function runCalculator() {
  /* The following script should have failed earlier because we blocked calculator_desktop.js.
  We copy it verbatim here to actually load the calculator. */

  window.require(
    ["toplevel/calculator_desktop", "testbridge", "jquery"],
    function (calcPromise: any, TestBridge: any, $: any) {
      $(".dcg-loading-div-container").hide();
      calcPromise.then(function (calc: any) {
        window.Calc = calc;
        TestBridge.ready();
        // following lines added
        listenToMessageDown((message) => {
          if (message.type === "set-script-url") {
            injectScript(message.value);
            // cancel listener
            return true;
          }
        });
        postMessageUp({
          type: "get-script-url",
        });
      });
    }
  );
}

pollForValue(
  () =>
    (
      document.querySelector(
        "script[src^='/assets/build/calculator_desktop']"
      ) as HTMLScriptElement
    )?.src
).then((src) => {
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
  document.body.appendChild(script);
});
