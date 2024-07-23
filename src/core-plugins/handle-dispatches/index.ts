import { DispatchedEvent } from "../../globals";
import { PluginID } from "../../plugins";
import { PluginController } from "../../plugins/PluginController";

interface HandlerRecord {
  id: PluginID | "vanilla";
  /** Returning `"abort-later-handlers"` means don't run any later handlers. */
  handler: (evt: DispatchedEvent) => "abort-later-handlers" | undefined;
}

export default class HandleDispatches extends PluginController {
  static id = "handle-dispatches" as const;
  static enabledByDefault = true;
  static isCore = true;

  private readonly handlers: HandlerRecord[] = [];

  private vanillaHandler: (evt: DispatchedEvent) => void = () => {};

  afterEnable() {
    this.vanillaHandler = this.cc.handleDispatchedAction.bind(this.cc);
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
    this.vanillaHandler(evt);
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
   * The handlers run in lexicographic order of plugin IDs, and
   * the vanilla handlers are ran at the end.
   *
   * @param handleDispatchedAction
   *  Return `"abort-later-handlers"` if you don't want lower-priority
   *  handlers to run for this event. Otherwise, return `undefined`.
   */
  registerDispatchHandler(
    pluginID: PluginID,
    handleDispatchedAction: (
      action: DispatchedEvent
    ) => "abort-later-handlers" | undefined
  ) {
    if (this.handlers.find(({ id }) => id === pluginID)) {
      throw new Error(
        `Cannot register two dispatch handlers for plugin '${pluginID}'.`
      );
    }
    this.handlers.push({
      id: pluginID,
      handler: handleDispatchedAction,
    });
    this.handlers.sort((a, b) => {
      return b.id > a.id ? 1 : -1;
    });
  }
}
