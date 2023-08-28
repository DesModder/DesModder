/*
Post message conventions:
  Always have a type
  apply-* = message from content script to page, applying some data
  set-* = message from page to content script, asking to store data in chrome.storage
  get-* = message from page to content script, asking to get data in chrome.storage
*/
import { WindowHeartbeatOptions } from "#plugins/wakatime/heartbeat.ts";
import { GenericSettings, PluginID } from "#plugins/index.ts";

type MessageWindowToContent =
  | {
      type: "set-plugins-enabled";
      value: Record<PluginID, boolean>;
    }
  | {
      type: "set-plugins-force-disabled";
      value: PluginID[];
    }
  | {
      type: "set-plugin-settings";
      value: Record<PluginID, GenericSettings | undefined>;
    }
  | {
      type: "get-initial-data";
    }
  | {
      type: "send-heartbeat";
      options: WindowHeartbeatOptions;
    };

type MessageContentToWindow =
  | {
      type: "apply-initial-data";
      pluginsEnabled: Record<PluginID, boolean | undefined>;
      pluginsForceDisabled: PluginID[];
      pluginSettings: Record<PluginID, GenericSettings | undefined>;
      scriptURL: string;
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

/** Security issue on Firefox with posting a Map, so use this to convert a
 * Map to a Record (plain JS object). */
export function mapToRecord<K extends string, V>(x: Map<K, V>): Record<K, V> {
  return Object.fromEntries(x.entries()) as Record<K, V>;
}

/** Security issue on Firefox with posting a Map, so use this to convert a
 * Record (plain JS object) back to a Map. */
export function recordToMap<K extends string, V>(x: Record<K, V>): Map<K, V> {
  return new Map(Object.entries(x)) as Map<K, V>;
}

/** Security issue on Firefox with posting a Set, so use this to convert a
 * Set to an Array. */
export function setToArray<V>(x: Set<V>): Array<V> {
  return Array.from(x);
}

/** Security issue on Firefox with posting a Map, so use this to convert an
 * Array to a Set. */
export function arrayToSet<V>(x: Array<V>): Set<V> {
  return new Set(x);
}
