import { Console } from "#globals";
import { getCurrentGraphTitle } from "#utils/depUtils.ts";
import { PluginController } from "../PluginController";
import { Config, configList } from "./config";
import { listenToMessageDown, postMessageUp } from "#messages";

const heartbeatInterval = 120 * 1000;

export default class Wakatime extends PluginController<Config> {
  static id = "wakatime" as const;
  static config = configList;
  static enabledByDefault = false;

  lastUpdate = performance.now() - heartbeatInterval;
  handler!: string;

  afterEnable() {
    this.handler = this.cc.dispatcher.register((e) => {
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
          this.cc._showToast({
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
    this.cc.dispatcher.unregister(this.handler);
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
