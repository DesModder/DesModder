import { GenericSettings, PluginID } from "../plugins";
import {
  HeartbeatOptions,
  sendHeartbeat,
  WindowHeartbeatOptions,
} from "../plugins/wakatime/heartbeat";
import injectScript from "#utils/injectScript.ts";
import { listenToMessageUp, postMessageDown } from "#utils/messages.ts";

enum StorageKeys {
  pluginsEnabled = "_plugins-enabled",
  forceDisabled = "_force-disabled",
  forceDisabledVersion = "_force-disabled-version",
  pluginSettings = "_plugin-settings",
}

interface InitialData {
  [StorageKeys.forceDisabled]: PluginID[];
  [StorageKeys.forceDisabledVersion]: string;
  [StorageKeys.pluginsEnabled]: Record<PluginID, boolean | undefined>;
  [StorageKeys.pluginSettings]: Record<PluginID, GenericSettings | undefined>;
}

const initialDataDefaults: InitialData = {
  [StorageKeys.forceDisabled]: [], // default: no plugins force-disabled
  [StorageKeys.forceDisabledVersion]: "",
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  [StorageKeys.pluginsEnabled]: {} as Record<PluginID, boolean | undefined>,
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  [StorageKeys.pluginSettings]: {} as Record<
    PluginID,
    GenericSettings | undefined
  >, // default: no settings known
};

type UntrustedInitialData = Partial<InitialData> | undefined;

function getInitialData() {
  chrome.storage.sync.get(initialDataDefaults, (_items) => {
    const items = _items as UntrustedInitialData;
    postMessageDown({
      type: "apply-initial-data",
      pluginsEnabled: getItem(items, StorageKeys.pluginsEnabled),
      pluginsForceDisabled: pluginsForceDisabled(items),
      pluginSettings: pluginSettings(items),
      scriptURL: chrome.runtime.getURL("script.js"),
    });
  });
}

type KID = keyof InitialData;
function getItem<T extends KID>(items: UntrustedInitialData, key: T) {
  return items?.[key] ?? initialDataDefaults[key];
}

function pluginsForceDisabled(items: UntrustedInitialData) {
  const forceDisabledVersion = getItem(items, StorageKeys.forceDisabledVersion);
  if (forceDisabledVersion !== VERSION) {
    void chrome.storage.sync.set({
      [StorageKeys.forceDisabled]: [],
      [StorageKeys.forceDisabledVersion]: VERSION,
    });
    return [];
  }
  return getItem(items, StorageKeys.forceDisabled);
}

function pluginSettings(items: UntrustedInitialData) {
  const settingsDown: Record<PluginID, GenericSettings | undefined> =
    structuredClone(getItem(items, StorageKeys.pluginSettings));
  // Hide secret key from web page
  if (settingsDown.wakatime?.secretKey)
    settingsDown.wakatime.secretKey = "????????-????-????-????-????????????";
  return settingsDown;
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

function injectStyle() {
  const s = document.createElement("link");
  s.rel = "stylesheet";
  s.href = chrome.runtime.getURL("script.css");
  (document.head || document.documentElement).appendChild(s);
}

listenToMessageUp((message) => {
  switch (message.type) {
    case "get-initial-data": {
      injectStyle();
      getInitialData();
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
    case "send-heartbeat":
      _sendHeartbeat(message.options);
      break;
    default:
      message satisfies never;
  }
  return false;
});

// run preload code, which handles replacements then calls the main code
injectScript(chrome.runtime.getURL("preload/script.js"));
