import { postMessageDown, listenToMessageUp } from "utils/messages";
import injectScript from "./utils/injectScript";

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
        value: items[StorageKeys.pluginSettings] as {
          [id: string]: { [key: string]: boolean };
        },
      });
      postMessageDown({
        type: "apply-plugins-enabled",
        value: items[StorageKeys.pluginsEnabled] as { [id: string]: boolean },
      });
    }
  );
}

listenToMessageUp((message) => {
  switch (message.type) {
    case "enable-script":
      if (message.scriptName === "wolfram2desmos") {
        injectScript("wolfram2desmos.js");
      }
      break;
    case "get-initial-data":
      getInitialData();
      break;
    case "set-plugins-enabled":
      chrome.storage.sync.set({
        [StorageKeys.pluginsEnabled]: message.value,
      });
      break;
    case "set-plugin-settings":
      chrome.storage.sync.set({
        [StorageKeys.pluginSettings]: message.value,
      });
      break;
  }
});

injectScript("script.js");
