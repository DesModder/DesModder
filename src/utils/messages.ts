/*
Post message conventions:
  Always have a type
  apply-* = message from content script to page, applying some data
  set-* = message from page to content script, asking to store data in chrome.storage
  get-* = message from page to content script, asking to get data in chrome.storage
*/
import { HeartbeatOptions } from "../plugins/wakatime/heartbeat";
import { GenericSettings } from "plugins";

type MessageWindowToContent =
  | {
      type: "enable-script";
      scriptName: string;
    }
  | {
      type: "set-plugins-enabled";
      value: { [id: string]: any };
    }
  | {
      type: "set-plugin-settings";
      value: { [id: string]: GenericSettings };
    }
  | {
      type: "get-initial-data";
    }
  | {
      type: "get-preload-enabled";
    }
  | {
      type: "get-script-url";
    }
  | {
      type: "get-worker-append-url";
    }
  | {
      type: "send-heartbeat";
      options: HeartbeatOptions;
    };

type MessageContentToWindow =
  | {
      type: "apply-preload-enabled";
      value: { [key: string]: boolean };
    }
  | {
      type: "apply-plugins-enabled";
      value: { [key: string]: boolean };
    }
  | {
      type: "apply-plugin-settings";
      value: { [id: string]: { [key: string]: any } };
    }
  | {
      type: "set-script-url";
      value: string;
    }
  | {
      type: "set-worker-append-url";
      value: string;
    }
  | {
      type: "heartbeat-error";
      message: any;
    };

function postMessage<T extends { type: string }>(message: T) {
  window.postMessage(message, "*");
}

export function postMessageUp(message: MessageWindowToContent) {
  postMessage(message);
}

export function postMessageDown(message: MessageContentToWindow) {
  postMessage(message);
}

type ShouldCancel = boolean;

// https://stackoverflow.com/a/11431812/7481517
function listenToMessage<T>(callback: (message: T) => ShouldCancel) {
  const wrappedCallback = (event: MessageEvent<T>) => {
    if (event.source !== window) {
      return;
    }
    const cancel = callback(event.data);
    if (cancel) {
      window.removeEventListener("message", wrappedCallback, false);
    }
  };
  window.addEventListener("message", wrappedCallback, false);
  return wrappedCallback;
}

export function listenToMessageUp(
  callback: (message: MessageWindowToContent) => ShouldCancel
) {
  listenToMessage(callback);
}

export function listenToMessageDown(
  callback: (message: MessageContentToWindow) => ShouldCancel
) {
  listenToMessage(callback);
}
