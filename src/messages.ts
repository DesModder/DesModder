/*
Post message conventions:
  Always have a type
  Start type with an underscore (e.g. "_plugins-enabled") for DesModder
    (leaves non-underscore namespace free for plugins)
  apply-* = message from content script to page, applying some data
  set-* = message from page to content script, asking to store data in chrome.storage
  get-* = message from page to content script, asking to get data in chrome.storage
*/

type MessageWindowToContent =
  | {
      type: "enable-script";
      scriptName: string;
    }
  | {
      type: "set-plugins-enabled";
      value: { [key: string]: boolean };
    }
  | {
      type: "get-plugins-enabled";
    };

type MessageContentToWindow = {
  type: "apply-plugins-enabled";
  value: { [key: string]: boolean };
};

function postMessage<T extends { type: string }>(message: T) {
  window.postMessage(message, "*");
}

export function postMessageUp(message: MessageWindowToContent) {
  console.log("posting message up, but chrome is", chrome);
  postMessage(message);
}

export function postMessageDown(message: MessageContentToWindow) {
  postMessage(message);
}

type ShouldCancel = boolean | void;

// https://stackoverflow.com/a/11431812/7481517
function listenToMessage<T>(callback: (message: T) => ShouldCancel) {
  const wrappedCallback = (event: MessageEvent<T>) => {
    if (event.source !== window) {
      return;
    }
    const cancel = callback(event.data);
    if (cancel) {
      console.log("-1 removed listener", callback);
      window.removeEventListener("message", wrappedCallback, false);
    }
  };
  console.log("+1 added listener", callback);
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
