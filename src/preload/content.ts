import { postMessageDown, listenToMessageUp } from "utils/messages";
import injectScript from "utils/injectScript";

function getPreloadEnabled() {
  chrome.storage.sync.get(
    {
      "_plugins-enabled": {}, // default: do not know which are enabled
    },
    (items) => {
      postMessageDown({
        type: "apply-preload-enabled",
        value: items["_plugins-enabled"] as { [id: string]: boolean },
      });
    }
  );
}

listenToMessageUp((message) => {
  message.type === "get-preload-enabled" && getPreloadEnabled();
});

injectScript("./preloadScript.js");
