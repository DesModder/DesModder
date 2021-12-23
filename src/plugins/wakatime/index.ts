import { FetchMessage, RuntimeResponse } from "../../background";
import { Calc } from "../../globals/window";
import { Plugin } from "../index";

// TODO: Make this a config option
const secretKey = "";
const heartbeatIntervalMs = 120 * 1000;

function sendHeartbeat(
  key: string,
  graphName: string,
  graphURL: string,
  lineCount: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = "https://wakatime.com/api/v1/users/current/heartbeats";
    const data = {
      // This is background information for WakaTime to handle. These values need no change.
      language: "Desmos", // constant
      category: "coding", // constant
      type: "app", // constant
      dependencies: [], // constant
      time: Date.now() * 0.001, // constant
      lines: lineCount, // constant
      lineno: null, // (int) I tend not to touch this; seems redundant for visualizations
      cursorpos: null, // redundant
      is_write: null, // (boolean) Maybe this could be implemented in the future?

      // Everything below will show up in your Leaderboard.
      // This is personally the heartbeat scheme that I use.
      project: "Desmos Projects",
      entity: graphURL,
      branch: graphName,

      // But if you are unhappy with the above, you can opt with this instead.
      /*
      "project": graphName,
      "entity": graphURL,
      "branch": null
      */
    };

    const options: RequestInit = {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(key)}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(data),
    };

    const message: FetchMessage = { type: "fetch", url, options };
    chrome.runtime.sendMessage(message, (res: RuntimeResponse) => {
      if (res.type == "error") {
        reject(new Error(`Backend reported error: ${res.message}`));
      } else if (res.type == "success") {
        resolve();
      }
    });
  });
}

let isEnabled = false;

const sleep = (t: number) => new Promise((res) => setTimeout(res, t));

async function main() {
  // Date.now can be messed up by system clock changes
  let lastUpdate = performance.now();
  while (isEnabled) {
    const graphName =
      (document.querySelector(".dcg-variable-title") as any).innerText ?? "";
    const graphURL = window.location.href;
    const lineCount = Calc.getExpressions().length;

    if (secretKey) {
      try {
        await sendHeartbeat(secretKey, graphName, graphURL, lineCount);
        console.log("[WakaTime] Heartbeat sent sucessfully");
      } catch (e) {
        console.error("[WakaTime] Error sending heartbeat:", e);
      }
    }

    const now = performance.now();
    const elapsed = now - lastUpdate;
    lastUpdate = now;
    await sleep(Math.max(heartbeatIntervalMs - elapsed, 0));
  }
}

function onEnable() {
  isEnabled = true;
  main().catch((e) => console.error("[WakaTime] Main loop crashed", e));
}

function onDisable() {
  // main loop will stop
  isEnabled = false;
}

const wakatime: Plugin = {
  id: "wakatime",
  name: "WakaTime",
  description: "Track your desmos activity on WakaTime.com",
  onEnable,
  onDisable,
};
export default wakatime;
