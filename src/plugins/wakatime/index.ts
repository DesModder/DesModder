import { Calc } from "../../globals/window";
import { desModderController } from "../../script";
import { postMessageUp } from "utils/messages";

const heartbeatIntervalMs = 120 * 1000;

let isEnabled = false;

const sleep = async (t: number) =>
  await new Promise((resolve) => setTimeout(resolve, t));

async function main() {
  // Date.now can be messed up by system clock changes
  let lastUpdate = performance.now() - heartbeatIntervalMs;
  // eslint-disable-next-line no-unmodified-loop-condition
  while (isEnabled) {
    const graphName =
      desModderController.topLevelComponents.graphsController.getCurrentGraphTitle() ??
      "Untitled Graph";
    const graphURL = window.location.href;
    const lineCount = Calc.getExpressions().length;

    console.debug("[WakaTime] Sending heartbeat at:", new Date());
    postMessageUp({
      type: "send-heartbeat",
      options: { graphName, graphURL, lineCount },
    });

    const now = performance.now();
    const elapsed = now - lastUpdate;
    lastUpdate = now;
    await sleep(Math.max(2 * heartbeatIntervalMs - elapsed, 0));
  }
}

async function onEnable() {
  isEnabled = true;
  void main();
}

function onDisable() {
  // main loop will stop
  isEnabled = false;
}

export default {
  id: "wakatime",
  onEnable,
  onDisable,
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
