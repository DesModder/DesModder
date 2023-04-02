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
  forceDisabled: "_force-disabled",
  forceDisabledVersion: "_force-disabled-version",
  pluginSettings: "_plugin-settings",
} as const;

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
        value: settingsDown,
      });
      const pluginsEnabled: Record<PluginID, boolean> =
        items?.[StorageKeys.pluginsEnabled] ?? {};
      postMessageDown({
        type: "apply-plugins-enabled",
        value: pluginsEnabled,
      });
    }
  );
}

function getPluginsForceDisabled() {
  chrome.storage.sync.get(
    {
      [StorageKeys.forceDisabled]: [], // default: no plugins force-disabled
      [StorageKeys.forceDisabledVersion]: "",
    },
    (items) => {
      let forceDisabled: PluginID[] = items?.[StorageKeys.forceDisabled] ?? [];
      const forceDisabledVersion: string =
        items?.[StorageKeys.forceDisabledVersion] ?? "";
      if (forceDisabledVersion !== VERSION) {
        forceDisabled = [];
        void chrome.storage.sync.set({
          [StorageKeys.forceDisabled]: [],
          [StorageKeys.forceDisabledVersion]: VERSION,
        });
      }
      postMessageDown({
        type: "apply-plugins-force-disabled",
        value: forceDisabled,
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
        void sendHeartbeat(fullOptions, (e) => postMessageDown(e));
      }
    }
  );
}

listenToMessageUp((message) => {
  switch (message.type) {
    case "get-plugins-force-disabled":
      getPluginsForceDisabled();
      break;
    case "get-initial-data": {
      // prep to send data back down
      getInitialData();
      // but also insert style sheet
      const s = document.createElement("link");
      s.rel = "stylesheet";
      s.href = chrome.runtime.getURL("script.css");
      document.head.appendChild(s);
      break;
    }
    case "set-plugins-enabled":
      void chrome.storage.sync.set({
        [StorageKeys.pluginsEnabled]: message.value,
      });
      break;
    case "set-plugins-force-disabled":
      void chrome.storage.sync.set({
        [StorageKeys.forceDisabled]: Array.from(message.value),
        [StorageKeys.forceDisabledVersion]: VERSION,
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
    case "send-heartbeat":
      _sendHeartbeat(message.options);
      break;
  }
  return false;
});

injectScript(chrome.runtime.getURL("preload/script.js"));
