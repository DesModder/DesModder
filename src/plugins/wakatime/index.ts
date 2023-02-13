import { Calc } from "../../globals/window";
import { desModderController } from "../../script";
import { getCurrentGraphTitle } from "../../utils/depUtils";
import { configList } from "./config";
import { Plugin } from "plugins";
import { listenToMessageDown, postMessageUp } from "utils/messages";

const heartbeatInterval = 120 * 1000;
let lastUpdate = performance.now() - heartbeatInterval;

let handler: string;

async function maybeSendHeartbeat(isWrite: boolean) {
  if (!(performance.now() - lastUpdate > heartbeatInterval || isWrite)) return;
  const graphName = getCurrentGraphTitle() ?? "Untitled Graph";
  const graphURL = window.location.href;
  const lineCount = Calc.getExpressions().length;

  console.debug("[WakaTime] Sending heartbeat at:", new Date());
  postMessageUp({
    type: "send-heartbeat",
    options: {
      graphName,
      graphURL,
      lineCount,
      isWrite,
    },
  });
  lastUpdate = performance.now();
}

async function onEnable() {
  handler = Calc.controller.dispatcher.register((e) => {
    if (
      e.type === "on-evaluator-changes" ||
      e.type === "clear-unsaved-changes"
    ) {
      void maybeSendHeartbeat(e.type === "clear-unsaved-changes");
    }
  });
}

function onDisable() {
  Calc.controller.dispatcher.unregister(handler);
}

listenToMessageDown((msg) => {
  if (msg.type === "heartbeat-error") {
    if (msg.isAuthError) {
      desModderController.disablePlugin("wakatime");
      Calc.controller._showToast({
        message:
          "WakaTime heartbeat error: check your secret key. Plugin has been deactivated.",
        toastStyle: "error",
        hideAfter: 0,
      });
    }
    console.error("Wakatime heartbeat error:", msg.message);
  }
  return false;
});

const wakatime: Plugin = {
  id: "wakatime",
  onEnable,
  onDisable,
  config: configList,
  enabledByDefault: false,
};
export default wakatime;
