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
  chrome.webRequest.onBeforeRequest.addListener(
    ({ url }) => ({
      cancel: url.endsWith(".js"),
    }),
    {
      urls: ["https://www.desmos.com/assets/build/calculator_desktop-*.js"],
    },
    ["blocking"]
  );
}
