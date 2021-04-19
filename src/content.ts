// https://stackoverflow.com/a/9517879
// injects script.ts into the correct window context
function injectScript(url: string) {
  let s = document.createElement("script");
  s.src = chrome.runtime.getURL(url);
  s.onload = function () {
    // remove the script so it doesn't appear in the DOM tree
    s.remove();
  };
  const head = document.head || document.documentElement;
  if (head !== null) {
    head.appendChild(s);
  }
}

injectScript("script.js");

// https://stackoverflow.com/a/11431812/7481517
window.addEventListener("message", (event) => {
  if (event.source !== window) {
    return;
  }
  const message = event.data;
  if (message.type === "enable-script") {
    if (message.scriptName === "wolfram2desmos") {
      injectScript("wolfram2desmos.js");
    }
  }
});
