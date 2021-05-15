import { postMessageDown, listenToMessageUp } from "messages";

// *** Messages

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

// *** Script Injection

// https://stackoverflow.com/a/9517879
// injects script.ts into the correct window context
function injectScript(url: string) {
  let s = document.createElement("script");
  s.src = chrome.runtime.getURL(url);
  s.onload = function () {
    // remove the script so it doesn't appear in the DOM tree
    s.remove();
  };
  const head = document.head || document.documentElement;
  if (head !== null) {
    head.appendChild(s);
  }
}

injectScript("script.js");
