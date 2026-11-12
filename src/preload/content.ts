import { GenericSettings, PluginID } from "../plugins";
import {
  HeartbeatOptions,
  WindowHeartbeatOptions,
} from "../plugins/wakatime/heartbeat";
import injectScript from "#utils/injectScript.ts";
import { listenToMessageUp, postMessageDown } from "#utils/messages.ts";

enum StorageKeys {
  pluginsEnabled = "_plugins-enabled",
  forceDisabled = "_force-disabled",
  forceDisabledVersion = "_force-disabled-version",
  pluginSettings = "_plugin-settings",
  pluginSecretSettings = "_plugin-secret-settings",
}

interface InitialData {
  [StorageKeys.forceDisabled]: PluginID[];
  [StorageKeys.forceDisabledVersion]: string;
  [StorageKeys.pluginsEnabled]: Record<PluginID, boolean | undefined>;
  [StorageKeys.pluginSettings]: Record<PluginID, GenericSettings | undefined>;
  [StorageKeys.pluginSecretSettings]: Record<
    PluginID,
    GenericSettings | undefined
  >;
}

const initialDataDefaults: InitialData = {
  [StorageKeys.forceDisabled]: [], // default: no plugins force-disabled
  [StorageKeys.forceDisabledVersion]: "",
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  [StorageKeys.pluginsEnabled]: {} as Record<PluginID, boolean | undefined>,
  // default: no settings known
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  [StorageKeys.pluginSettings]: {} as Record<
    PluginID,
    GenericSettings | undefined
  >,
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  [StorageKeys.pluginSecretSettings]: {} as Record<
    PluginID,
    GenericSettings | undefined
  >,
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

const DUMMY_SECRET = "????????-????-????-????-????????????";

function pluginSettings(items: UntrustedInitialData) {
  return getItem(items, StorageKeys.pluginSettings);
}

function _sendHeartbeat(options: WindowHeartbeatOptions) {
  chrome.storage.sync.get(
    {
      [StorageKeys.pluginSettings]: {},
      [StorageKeys.pluginSecretSettings]: {},
    },
    (items) => {
      const secretKey =
        items?.[StorageKeys.pluginSecretSettings]?.wakatime?.secretKey;
      const s = items?.[StorageKeys.pluginSettings];
      const wakatime = s?.wakatime;
      const projectName = wakatime?.projectName;
      const splitProjects = wakatime?.splitProjects;
      const fullOptions: HeartbeatOptions = {
        ...options,
        secretKey,
        projectName,
        splitProjects,
      };

      if (!secretKey || secretKey === DUMMY_SECRET) {
        postMessageDown({
          type: "heartbeat-error",
          isAuthError: true,
          message: "Missing secret key.",
        });
        return;
      }

      // Background scripts bypass CORS/CSP, so send the heartbeat from the
      // background script, to avoid the need for special permissions in the manifest.
      chrome.runtime.sendMessage(
        chrome.runtime.id,
        { type: "send-background-heartbeat", options: fullOptions },
        (e) => {
          if (e?.type === "heartbeat-error") {
            postMessageDown(e);
          }
        }
      );
    }
  );
}

function injectStyle() {
  const s = document.createElement("link");
  s.rel = "stylesheet";
  s.href = chrome.runtime.getURL("script.css");
  (document.head || document.documentElement).appendChild(s);
}

function init() {
  if (document.location.hostname === "maintain.desmos.com") {
    // maintain.desmos.com is an old version, no point supporting.
    return;
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
      case "set-plugin-settings": {
        const { wakatime } = message.value;
        if (
          wakatime?.secretKey !== undefined &&
          wakatime.secretKey !== "" &&
          wakatime.secretKey !== DUMMY_SECRET
        ) {
          void chrome.storage.sync.set({
            [StorageKeys.pluginSecretSettings]: {
              wakatime: { secretKey: wakatime.secretKey },
            },
          });
          wakatime.secretKey = DUMMY_SECRET;
        }
        void chrome.storage.sync.set({
          [StorageKeys.pluginSettings]: message.value,
        });
        break;
      }
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
}

init();
