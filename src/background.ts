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
