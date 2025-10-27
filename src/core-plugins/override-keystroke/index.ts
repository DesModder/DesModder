import { PluginID } from "../../plugins";
import { PluginController } from "../../plugins/PluginController";

type MQKeystrokeCallback = (
  key: string,
  event: KeyboardEvent
) => undefined | "cancel";

export default class OverrideKeystroke extends PluginController {
  static id = "override-keystroke" as const;
  static enabledByDefault = true;
  static isCore = true;

  private readonly mqKeystrokeListeners = new Map<
    PluginID,
    MQKeystrokeCallback
  >();

  onMQKeystroke(key: string, event: KeyboardEvent): undefined | "cancel" {
    const plugins = [...this.mqKeystrokeListeners.keys()].sort();
    for (const pluginID of plugins) {
      if (!this.dsm.isPluginEnabled(pluginID)) continue;
      const cb = this.mqKeystrokeListeners.get(pluginID);
      if (!cb) continue;
      const ret = cb(key, event);
      if (ret === "cancel") return "cancel";
    }
  }

  /**
   * Add a listener. They will be resolved in sorted order by ID.
   * If one listener returns "cancel", then later listeners will not run.
   */
  setMQKeystrokeListener(pluginID: PluginID, cb: MQKeystrokeCallback) {
    this.mqKeystrokeListeners.set(pluginID, cb);
  }
}
