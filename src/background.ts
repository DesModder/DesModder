import "globals/env";

if (BROWSER === "chrome") {
  // FIREFOX TODO: find Firefox equivalent. chrome.browserAction?
  if (chrome.action?.onClicked) {
    chrome.action.onClicked.addListener(() => {
      chrome.tabs.create({
        url: "https://www.desmos.com/calculator",
      });
    });
  }
}

if (BROWSER === "firefox") {
  // Inside this block is the manifest v2 web request manipulation
  // The MV3 manipulation is done through public/chrome/net_request_rules.json
  // Description of why this works is in public/chrome/net_request_rules.md

  // Block the initial load of calculator.js in order to run a modified version later
  chrome.webRequest.onBeforeRequest.addListener(
    ({ url }) => ({
      cancel: url.endsWith(".js"),
    }),
    {
      urls: ["https://www.desmos.com/assets/build/calculator_desktop-*.js"],
    },
    ["blocking"]
  );
  // Modify headers on all resources to enabled SharedArrayBuffer for FFmpeg
  chrome.webRequest.onHeadersReceived.addListener(
    (details) => ({
      ...details,
      responseHeaders: [
        ...(details.responseHeaders?.filter(
          ({ name }) =>
            name !== "Cross-Origin-Embedder-Policy" &&
            name !== "Cross-Origin-Opener-Policy"
        ) ?? []),
        {
          name: "Cross-Origin-Embedder-Policy",
          value: "require-corp",
        },
        {
          name: "Cross-Origin-Opener-Policy",
          value: "same-origin",
        },
      ],
    }),
    {
      urls: ["https://www.desmos.com/*"],
    },
    ["blocking", "responseHeaders"]
  );
  chrome.webRequest.onHeadersReceived.addListener(
    (details) => ({
      ...details,
      responseHeaders: [
        ...(details.responseHeaders?.filter(
          ({ name }) => name !== "Cross-Origin-Resource-Policy"
        ) ?? []),
        {
          name: "Cross-Origin-Resource-Policy",
          value: "cross-origin",
        },
      ],
    }),
    {
      urls: [
        "https://saved-work.desmos.com/calc_thumbs/**/*",
        "https://saved-work.desmos.com/calc-recovery-thumbs/**/*",
      ],
    },
    ["blocking", "responseHeaders"]
  );
}
