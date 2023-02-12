/*
Post message conventions:
  Always have a type
  apply-* = message from content script to page, applying some data
  set-* = message from page to content script, asking to store data in chrome.storage
  get-* = message from page to content script, asking to get data in chrome.storage
*/
import { WindowHeartbeatOptions } from "../plugins/wakatime/heartbeat";
import { GenericSettings, PluginID } from "plugins";

type MessageWindowToContent =
  | {
      type: "enable-script";
      scriptName: string;
    }
  | {
      type: "set-plugins-enabled";
      value: Map<PluginID, boolean>;
    }
  | {
      type: "set-plugins-force-disabled";
      value: Set<PluginID>;
    }
  | {
      type: "set-plugin-settings";
      value: Map<PluginID, GenericSettings>;
    }
  | {
      type: "get-plugins-force-disabled";
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
      options: WindowHeartbeatOptions;
    };

type MessageContentToWindow =
  | {
      type: "apply-plugins-enabled";
      value: Map<PluginID, boolean>;
    }
  | {
      type: "apply-plugins-force-disabled";
      value: Set<PluginID>;
    }
  | {
      type: "apply-plugin-settings";
      value: Map<PluginID, GenericSettings>;
    }
  | {
      type: "set-script-url";
      value: string;
    }
  | {
      type: "set-worker-append-url";
      value: string;
    }
  | HeartbeatError;

export interface HeartbeatError {
  type: "heartbeat-error";
  isAuthError: boolean;
  message: string;
}

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
