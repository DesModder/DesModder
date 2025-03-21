import { sendHeartbeat } from "./plugins/wakatime/heartbeat";
import "./globals/env";

// Send requests that would otherwise be blocked by CORS if sent from a content script
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "send-background-heartbeat") {
    void sendHeartbeat(msg.options, sendResponse);
  }
  return true;
});

// Open /calculator when the browser action is clicked.
chrome.action.onClicked?.addListener(() => {
  void chrome.tabs.create({
    url: "https://www.desmos.com/calculator",
  });
});

const HOST_PERMISSIONS = {
  origins: ["https://*.desmos.com/*"],
};

// Necessary since Firefox doesn't grant host_permissions by default.
async function onInstall() {
  const good = await chrome.permissions.contains(HOST_PERMISSIONS);
  if (good) return;
  await chrome.permissions.request(HOST_PERMISSIONS);
}

chrome.runtime.onInstalled.addListener(() => {
  void onInstall();
});
