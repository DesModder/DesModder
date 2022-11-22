import { HeartbeatOptions, sendHeartbeat } from "../plugins/wakatime/heartbeat";
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
      const settings = (items?.[StorageKeys.pluginSettings] ?? {}) as {
        [id: string]: { [key: string]: any };
      };
      // Hide secret key from web page
      if (settings.wakatime?.secretKey !== "") {
        settings.wakatime.secretKey = "????????-????-????-????-????????????";
      }
      postMessageDown({
        type: "apply-plugin-settings",
        value: settings,
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

function _sendHeartbeat(options: HeartbeatOptions) {
  chrome.storage.sync.get(
    {
      [StorageKeys.pluginSettings]: {},
    },
    (items) => {
      const s = items?.[StorageKeys.pluginSettings];
      const secretKey = s?.wakatime?.secretKey;

      if (BROWSER === "chrome") {
        // Chrome can only send wakatime requests from the background page
        // pass message along to the background page
        chrome.runtime.sendMessage(
          chrome.runtime.id,
          { type: "send-background-heartbeat", options, secretKey },
          // TODO handle error
          () => {}
        );
      } else {
        // Firefox can only send wakatime requests from the content script
        void sendHeartbeat(secretKey, options);
        // TODO error handling
      }
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
    case "send-heartbeat":
      _sendHeartbeat(message.options);
      break;
  }
  return false;
});

injectScript(chrome.runtime.getURL("preloadScript.js"));
