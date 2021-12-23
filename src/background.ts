chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({
    url: "https://www.desmos.com/calculator",
  });
});

export type FetchMessage = {
  type: "fetch";
  url: string;
  options: RequestInit | undefined;
};
export type RuntimeMessage = FetchMessage;

export type ErrorResponse = { type: "error"; message: string };
export type SuccessResponse = { type: "success" };
export type RuntimeResponse = ErrorResponse | SuccessResponse;

async function handleFetch(
  req: FetchMessage,
  sendResponse: (res: RuntimeResponse) => void
) {
  const r = await fetch(req.url, req.options);
  // for now we don't care about the response.
  if (r.status != 200) {
    const res: ErrorResponse = {
      type: "error",
      message: `Request failed with status ${r.status}`,
    };
    return sendResponse(res);
  }
  const res: SuccessResponse = { type: "success" };
  sendResponse(res);
}

// Send requests that would otherwise be blocked by CORS if sent from a content script
chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  const req = msg as RuntimeMessage;
  try {
    if (req.type == "fetch") {
      await handleFetch(req, sendResponse);
    }
  } catch (e: any) {
    console.error(e);
    // if a response has already been sent this will be a no-op
    const res: ErrorResponse = { type: "error", message: e?.message ?? "" };
    sendResponse(res);
  }
});
