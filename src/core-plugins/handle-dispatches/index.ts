import { DispatchedEvent } from "../../globals";
import { PluginID } from "../../plugins";
import { PluginController } from "../../plugins/PluginController";
import {
  DispatchID,
  deregisterCustomDispatchOverridingHandler,
  registerCustomDispatchOverridingHandler,
} from "./manageDispatches";

export default class HandleDispatches extends PluginController {
  static id = "handle-dispatches" as const;
  static enabledByDefault = true;
  static isCore = true;

  private readonly pluginDispatchHandlers = new Map<PluginID, DispatchID>();

  afterEnable() {}

  beforeDisable() {
    throw new Error(
      "Programming Error: core plugin Handle Dispatches should not be disableable"
    );
  }

  deregisterForPlugin(pluginID: PluginID) {
    const dispatchID = this.pluginDispatchHandlers.get(pluginID);
    if (dispatchID !== undefined) {
      deregisterCustomDispatchOverridingHandler(this.calc, dispatchID);
    }
  }

  /**
   * Register an additional handler to be called inside
   * `handleDispatchedAction`, the big switch statement of `calc.controller`.
   * The DSM controller will remove this handler when the plugin is disabled.
   *
   * @param priority
   *  Larger number corresponds to higher priority (runs first).
   *  TODO: The original Desmos switch has priority 0.
   *  TODO: Use positive priority if you want to run before Desmos's handlers.
   *  TODO: Use negative priority if you want to run after Desmos's handlers.
   *  TODO: Ties are broken by plugin ID.
   *
   * @param handleDispatchedAction
   *  Return `"abort-later-handlers"` if you don't want lower-priority
   *  handlers to run for this event. Otherwise, return `undefined`.
   */
  registerDispatchHandler(
    pluginID: PluginID,
    priority: number,
    handleDispatchedAction: (
      action: DispatchedEvent
    ) => "abort-later-handlers" | undefined
  ) {
    if (this.pluginDispatchHandlers.has(pluginID)) {
      throw new Error(
        "Cannot register a new dispatch override for the same plugin. Use only one override per plugin."
      );
    }
    const id = registerCustomDispatchOverridingHandler(
      this.calc,
      handleDispatchedAction,
      priority
    );
    this.pluginDispatchHandlers.set(pluginID, id);
  }
}
