import { DispatchedEvent } from "../../globals";
import { PluginID } from "../../plugins";
import { PluginController } from "../../plugins/PluginController";

interface HandlerRecord {
  /** Larger priorities run first, and vanilla has priority 0. */
  priority: number;
  id: PluginID | "vanilla";
  /** Returning `"abort-later-handlers"` means don't run any later handlers. */
  handler: (evt: DispatchedEvent) => "abort-later-handlers" | undefined;
}

export default class HandleDispatches extends PluginController {
  static id = "handle-dispatches" as const;
  static enabledByDefault = true;
  static isCore = true;

  private handlers: HandlerRecord[] = [];

  afterEnable() {
    this.handlers = [
      {
        priority: 0,
        id: "vanilla",
        // Assertion necessary because `void` is not assignable to `undefined`.
        handler: this.cc.handleDispatchedAction.bind(this.cc) as (
          evt: DispatchedEvent
        ) => undefined,
      },
    ];
    this.cc.handleDispatchedAction = this.handleDispatchedAction.bind(this);
  }

  beforeDisable() {
    throw new Error(
      "Programming Error: core plugin Handle Dispatches should not be disableable"
    );
  }

  handleDispatchedAction(evt: DispatchedEvent) {
    for (const { handler } of this.handlers) {
      const keepGoing = handler(evt);
      if (keepGoing === "abort-later-handlers") return;
    }
  }

  deregisterForPlugin(pluginID: PluginID) {
    // Remove all handlers with matching IDs
    // This is in general O(ND), but only one handler should be deleted typically.
    for (let i = this.handlers.length - 1; i >= 0; i--) {
      if (this.handlers[i].id === pluginID) {
        this.handlers.splice(i, 1);
      }
    }
  }

  /**
   * Register an additional handler to be called inside
   * `handleDispatchedAction`, the big switch statement of `calc.controller`.
   * The DSM controller will remove this handler when the plugin is disabled.
   *
   * @param priority
   *  Larger number corresponds to higher priority (runs first).
   *  The original Desmos switch has priority 0.
   *  Use positive priority if you want to run before Desmos's handlers.
   *  Use negative priority if you want to run after Desmos's handlers.
   *  Ties are broken by plugin ID.
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
    if (
      this.handlers.find(
        ({ id, priority: p }) => id === pluginID && p === priority
      )
    ) {
      throw new Error(
        `Cannot register two dispatch handlers for plugin '${pluginID}' with the same priority ${priority}.`
      );
    }
    this.handlers.push({
      id: pluginID,
      priority,
      handler: handleDispatchedAction,
    });
    this.handlers.sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      return b.id > a.id ? 1 : -1;
    });
  }
}
