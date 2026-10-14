import { Console } from "../../globals/window";
import { PluginController } from "../PluginController";
import { Config, configList } from "./config";
import { listenToMessageDown, postMessageUp } from "#utils/messages.ts";

const heartbeatInterval = 15 * 1000;

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
        const message = `WakaTime heartbeat error${msg.status ? ` (Status ${msg.status})` : ""}: ${msg.message}. Plugin has been deactivated.`;
        this.dsm.disablePlugin("wakatime");
        this.util.showToast({
          message,
          toastStyle: "error",
          hideAfter: 0,
        });

        Console.error(message);
      }
      if (msg.type === "heartbeat-updated-token") {
        for (const key of [
          "accessToken",
          "refreshToken",
          "expiresAt",
        ] as const) {
          this.dsm.setPluginSetting("wakatime", key, msg.updatedConfig[key]);
        }

        if (this.dsm.wakatime?.settings.notifyRefresh) {
          this.util.showToast({
            message: "Refreshed OAuth WakaTime token!",
            hideAfter: 5000,
          });
        }
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
    const graphName = this.util.getCurrentGraphTitle() ?? "Untitled Graph";
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
