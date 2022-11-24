import { GenericSettings, PluginID } from "../plugins";
import {
  HeartbeatOptions,
  sendHeartbeat,
  WindowHeartbeatOptions,
} from "../plugins/wakatime/heartbeat";
import injectScript from "utils/injectScript";
import { listenToMessageUp, postMessageDown } from "utils/messages";

const StorageKeys = {
  pluginsEnabled: "_plugins-enabled",
  pluginSettings: "_plugin-settings",
} as const;

function recordToMap<V>(x: Record<string, V>): Map<string, V> {
  return new Map(Object.entries(x));
}

function getInitialData() {
  chrome.storage.sync.get(
    {
      [StorageKeys.pluginsEnabled]: {}, // default: do not know which are enabled
      [StorageKeys.pluginSettings]: {}, // default: no settings known
    },
    (items) => {
      const settingsDown: Record<PluginID, GenericSettings> = structuredClone(
        items?.[StorageKeys.pluginSettings] ?? {}
      );
      // Hide secret key from web page
      if (settingsDown.wakatime?.secretKey) {
        settingsDown.wakatime.secretKey =
          "????????-????-????-????-????????????";
      }
      postMessageDown({
        type: "apply-plugin-settings",
        value: recordToMap(settingsDown),
      });
      const pluginsEnabled: Record<PluginID, boolean> =
        items?.[StorageKeys.pluginsEnabled] ?? {};
      postMessageDown({
        type: "apply-plugins-enabled",
        value: recordToMap(pluginsEnabled),
      });
    }
  );
}

function _sendHeartbeat(options: WindowHeartbeatOptions) {
  chrome.storage.sync.get(
    {
      [StorageKeys.pluginSettings]: {},
    },
    (items) => {
      const s = items?.[StorageKeys.pluginSettings];
      const wakatime = s?.wakatime;
      const secretKey = wakatime?.secretKey;
      const projectName = wakatime?.projectName;
      const splitProjects = wakatime?.splitProjects;
      const fullOptions: HeartbeatOptions = {
        ...options,
        secretKey,
        projectName,
        splitProjects,
      };

      if (BROWSER === "chrome") {
        // Chrome can only send wakatime requests from the background page
        // pass message along to the background page
        chrome.runtime.sendMessage(
          chrome.runtime.id,
          { type: "send-background-heartbeat", options: fullOptions },
          (e) => {
            if (e?.type === "heartbeat-error") {
              postMessageDown(e);
            }
          }
        );
      } else {
        // Firefox can only send wakatime requests from the content script
        sendHeartbeat(fullOptions).catch((e) =>
          postMessageDown({
            type: "heartbeat-error",
            message: e,
          })
        );
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
