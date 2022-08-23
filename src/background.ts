import "globals/env";

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({
    url: "https://www.desmos.com/calculator",
  });
});

export type HearbeatMessage = {
  type: "sendHeartbeat";
  options: RequestInit | undefined;
};
export type RuntimeMessage = HearbeatMessage;

export type ErrorResponse = { type: "error"; message: string };
export type SuccessResponse = { type: "success" };
export type RuntimeResponse = ErrorResponse | SuccessResponse;

async function sendHeartbeat(
  req: HearbeatMessage,
  sendResponse: (res: RuntimeResponse) => void
) {
  const r = await fetch(
    "https://wakatime.com/api/v1/users/current/heartbeats",
    req.options
  );
  // for now we don't care about the response content, just the status.
  if (r.status != 201) {
    const res: ErrorResponse = {
      type: "error",
      message:
        `Request failed with status ${r.status} (expected 201).` +
        "Check background page network tab for details.",
    };
    return sendResponse(res);
  }
  const res: SuccessResponse = { type: "success" };
  sendResponse(res);
}

// Send requests that would otherwise be blocked by CORS if sent from a content script
chrome.runtime.onMessageExternal.addListener(
  async (msg, sender, sendResponse) => {
    const req = msg as RuntimeMessage;
    try {
      if (req.type == "sendHeartbeat") {
        await sendHeartbeat(req, sendResponse);
      }
    } catch (e: any) {
      console.error(e);
      // if a response has already been sent this will be a no-op
      const res: ErrorResponse = { type: "error", message: e?.message ?? "" };
      sendResponse(res);
    }
  }
);

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
