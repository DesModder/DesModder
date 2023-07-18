import { Calc, Console } from "../../globals/window";
import { getCurrentGraphTitle } from "../../utils/depUtils";
import { PluginController } from "../PluginController";
import { Config, configList } from "./config";
import { listenToMessageDown, postMessageUp } from "utils/messages";

const heartbeatInterval = 120 * 1000;

export default class Wakatime extends PluginController<Config> {
  static id = "wakatime" as const;
  static config = configList;
  static enabledByDefault = false;

  lastUpdate = performance.now() - heartbeatInterval;
  handler!: string;

  afterEnable() {
    this.handler = Calc.controller.dispatcher.register((e) => {
      if (
        e.type === "on-evaluator-changes" ||
        e.type === "clear-unsaved-changes"
      ) {
        this.maybeSendHeartbeat(e.type === "clear-unsaved-changes");
      }
    });
    // TODO: avoid double-listen on disable-re-enable
    listenToMessageDown((msg) => {
      if (msg.type === "heartbeat-error") {
        if (msg.isAuthError) {
          this.dsm.disablePlugin("wakatime");
          Calc.controller._showToast({
            message:
              "WakaTime heartbeat error: check your secret key. Plugin has been deactivated.",
            toastStyle: "error",
            hideAfter: 0,
          });
        }
        Console.error("Wakatime heartbeat error:", msg.message);
      }
      return false;
    });
  }

  afterDisable() {
    Calc.controller.dispatcher.unregister(this.handler);
  }

  maybeSendHeartbeat(isWrite: boolean) {
    if (!(performance.now() - this.lastUpdate > heartbeatInterval || isWrite))
      return;
    const graphName = getCurrentGraphTitle() ?? "Untitled Graph";
    const graphURL = window.location.href;
    const lineCount = Calc.getExpressions().length;

    Console.debug("[WakaTime] Sending heartbeat at:", new Date());
    postMessageUp({
      type: "send-heartbeat",
      options: {
        graphName,
        graphURL,
        lineCount,
        isWrite,
      },
    });
    this.lastUpdate = performance.now();
  }
}
