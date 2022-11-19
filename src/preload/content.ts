import injectScript from "utils/injectScript";
import { listenToMessageUp, postMessageDown } from "utils/messages";

const StorageKeys = {
  pluginsEnabled: "_plugins-enabled",
  pluginSettings: "_plugin-settings",
} as const;

function getInitialData() {
  chrome.storage.sync.get(
    {
      [StorageKeys.pluginsEnabled]: {}, // default: do not know which are enabled
      [StorageKeys.pluginSettings]: {}, // default: no settings known
    },
    (items) => {
      postMessageDown({
        type: "apply-plugin-settings",
        value: (items?.[StorageKeys.pluginSettings] ?? {}) as {
          [id: string]: { [key: string]: boolean };
        },
      });
      postMessageDown({
        type: "apply-plugins-enabled",
        value: (items?.[StorageKeys.pluginsEnabled] ?? {}) as {
          [id: string]: boolean;
        },
      });
    }
  );
}

listenToMessageUp((message) => {
  switch (message.type) {
    case "enable-script":
      if (message.scriptName === "wolfram2desmos") {
        injectScript(chrome.runtime.getURL("wolfram2desmos.js"));
      }
      break;
    case "get-initial-data":
      getInitialData();
      break;
    case "set-plugins-enabled":
      void chrome.storage.sync.set({
        [StorageKeys.pluginsEnabled]: message.value,
      });
      break;
    case "set-plugin-settings":
      void chrome.storage.sync.set({
        [StorageKeys.pluginSettings]: message.value,
      });
      break;
    case "get-script-url":
      postMessageDown({
        type: "set-script-url",
        value: chrome.runtime.getURL("script.js"),
      });
      break;
    case "get-worker-append-url":
      postMessageDown({
        type: "set-worker-append-url",
        value: chrome.runtime.getURL("workerAppend.js"),
      });
      break;
    case "get-ext-id":
      postMessageDown({ type: "set-ext-id", value: chrome.runtime.id });
      break;
  }
  return false;
});

injectScript(chrome.runtime.getURL("preloadScript.js"));
