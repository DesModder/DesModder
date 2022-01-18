// This usage of background.ts works only in Chrome
// FIREFOX TODO: find Firefox equivalent. chrome.browserAction?
if (chrome.action?.onClicked) {
  chrome.action.onClicked.addListener(() => {
    chrome.tabs.create({
      url: "https://www.desmos.com/calculator",
    });
  });
}

console.log("background start");
console.log(chrome.webRequest.onBeforeRequest);
// Firefox only. FIREFOX TODO: split
chrome.webRequest.onBeforeRequest.addListener(
  ({ url }) => ({
    cancel: url.endsWith(".js"),
  }),
  {
    urls: ["https://www.desmos.com/assets/build/calculator_desktop-*.js"],
  },
  ["blocking"]
);
console.log("Listener added");
