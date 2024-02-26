import { Console } from "../../globals/window";
import { getCurrentGraphTitle } from "../../utils/depUtils";
import { PluginController } from "../PluginController";
import { Config, configList } from "./config";
import { listenToMessageDown, postMessageUp } from "#utils/messages.ts";

const heartbeatInterval = 120 * 1000;

export default class Wakatime extends PluginController<Config> {
  static id = "wakatime" as const;
  static config = configList;
  static enabledByDefault = false;

  lastUpdate = performance.now() - heartbeatInterval;
  handler!: string;

  enabled = true;
  afterEnable() {
    this.handler = this.cc.dispatcher.register((e) => {
      if (
        e.type === "on-evaluator-changes" ||
        e.type === "clear-unsaved-changes"
      ) {
        this.maybeSendHeartbeat(e.type === "clear-unsaved-changes");
      }
    });
    listenToMessageDown((msg) => {
      // Avoid double-listen on disable-re-enable
      if (!this.enabled) {
        return true;
      }
      if (msg.type === "heartbeat-error") {
        let message: string;
        if (msg.key === "invalid-api-key") {
          message =
            "WakaTime error: Invalid or missing API key. Check https://wakatime.com/settings for your key.";
          this.cc._showToast({
            message,
            toastStyle: "error",
            hideAfter: 12 * 1000,
          });
        } else {
          message = msg.message;
        }
        Console.error("Wakatime heartbeat error:", message);
      }
      return false;
    });
  }

  afterDisable() {
    this.cc.dispatcher.unregister(this.handler);
    this.enabled = false;
  }

  maybeSendHeartbeat(isWrite: boolean) {
    if (!(performance.now() - this.lastUpdate > heartbeatInterval || isWrite))
      return;
    const graphName = getCurrentGraphTitle(this.calc) ?? "Untitled Graph";
    const graphURL = window.location.href;
    const lineCount = this.calc.getExpressions().length;

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
