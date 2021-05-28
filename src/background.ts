chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({
    url: "https://www.desmos.com/calculator",
  });
});
