import { Calc } from "../../globals/window";
import { desModderController } from "../../script";
import { HeartbeatMessage, RuntimeResponse } from "background";
import { listenToMessageDown, postMessageUp } from "utils/messages";

interface Config {
  secretKey: string;
}

let config!: Config;

const heartbeatIntervalMs = 120 * 1000;

let isEnabled = false;

async function sendHeartbeat(
  extId: string,
  key: string,
  graphName: string,
  graphURL: string,
  lineCount: number
): Promise<void> {
  return await new Promise((resolve, reject) => {
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
      project: graphName,
      entity: graphURL,
      branch: null,
    };

    const options: RequestInit = {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(key)}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(data),
    };

    const message: HeartbeatMessage = { type: "sendHeartbeat", options };
    chrome.runtime.sendMessage(
      extId,
      message,
      (res: RuntimeResponse | undefined) => {
        if (res?.type === "success") {
          resolve();
        } else {
          reject(new Error(`Backend reported error: ${res?.message}`));
        }
      }
    );
  });
}

const sleep = async (t: number) =>
  await new Promise((resolve) => setTimeout(resolve, t));

async function main(extId: string) {
  // Date.now can be messed up by system clock changes
  let lastUpdate = performance.now() - heartbeatIntervalMs;
  // eslint-disable-next-line no-unmodified-loop-condition
  while (isEnabled) {
    const graphName =
      desModderController.topLevelComponents.graphsController.getCurrentGraphTitle() ??
      "Untitled Graph";
    const graphURL = window.location.href;
    const lineCount = Calc.getExpressions().length;

    if (config.secretKey) {
      try {
        await sendHeartbeat(
          extId,
          config.secretKey,
          graphName,
          graphURL,
          lineCount
        );
        console.debug("[WakaTime] Heartbeat sent sucessfully at", new Date());
      } catch (e) {
        console.error("[WakaTime] Error sending heartbeat:", e);
      }
    }

    const now = performance.now();
    const elapsed = now - lastUpdate;
    lastUpdate = now;
    await sleep(Math.max(2 * heartbeatIntervalMs - elapsed, 0));
  }
}

async function getExtId(): Promise<string> {
  return await new Promise((resolve) => {
    listenToMessageDown((msg) => {
      if (msg.type === "set-ext-id") {
        resolve(msg.value);
        // cancel = true
        return true;
      }
      return false;
    });
    postMessageUp({ type: "get-ext-id" });
  });
}

async function onEnable(newConfig: Config) {
  config = newConfig;
  isEnabled = true;
  const extId = await getExtId();
  try {
    await main(extId);
  } catch (e) {
    console.error("[WakaTime] Main loop crashed", e);
  }
}

function onConfigChange(_: any, newConfig: Config) {
  config = newConfig;
}

function onDisable() {
  // main loop will stop
  isEnabled = false;
}

export default {
  id: "wakatime",
  onEnable,
  onDisable,
  onConfigChange,
  config: [
    {
      key: "secretKey",
      type: "string",
      variant: "password",
      default: "",
    },
  ] as const,
  enabledByDefault: false,
} as const;
