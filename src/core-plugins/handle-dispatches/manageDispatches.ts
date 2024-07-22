import type { Calc, DispatchedEvent } from "#globals";

export type DispatchID = number & { _nominallyDispatchID: unknown };

interface DispatchOverridingHandler {
  /** Returning `"abort-later-handlers"` means don't run any later handlers. */
  handler: (evt: DispatchedEvent) => "abort-later-handlers" | undefined;
  priority: number;
  id: DispatchID;
}

const calcDispatchOverrideHandlers = new WeakMap<
  Calc,
  DispatchOverridingHandler[]
>();

let dispatchOverridingHandlerId = 0;

/**
 * Schedule a function to run after every desmos event.
 * Priorities determine which run first. Larger number runs first.
 * The handler can return `"abort-later-handlers"` to force the dispatcher to stop early
 * (e.g. to stop desmos from doing a default action upon pressing a key)
 */

export function registerCustomDispatchOverridingHandler(
  calc: Calc,
  handler: (evt: DispatchedEvent) => "abort-later-handlers" | undefined,
  priority: number
): DispatchID {
  const handlers = getDispatchOverrideHandlers(calc);
  const id = dispatchOverridingHandlerId++ as DispatchID;
  // add the handler
  handlers.push({ handler, priority, id });

  // sort the handlers so that higher priorities are first
  // could easily be optimized but prob not a bottleneck
  handlers.sort((a, b) => b.priority - a.priority);

  return id;
}

// deregisters a function created with registerCustomDispatchOverridingHandler
// uses the id that the former function returns
export function deregisterCustomDispatchOverridingHandler(
  calc: Calc,
  id: DispatchID
): void {
  const handlers = getDispatchOverrideHandlers(calc);
  // remove all handlers with matching IDs
  // This is in general O(ND), but only one handler should be deleted typically.
  for (let i = handlers.length - 1; i >= 0; i--) {
    if (handlers[i].id === id) {
      handlers.splice(i, 1);
    }
  }
}

function getDispatchOverrideHandlers(calc: Calc) {
  const curr = calcDispatchOverrideHandlers.get(calc);
  if (curr) return curr;
  const newHandlers = setupDispatchOverride(calc);
  calcDispatchOverrideHandlers.set(calc, newHandlers);
  return newHandlers;
}

// Change calc.handleDispatchedAction to first run a set of custom handlers
export function setupDispatchOverride(calc: Calc) {
  const old = calc.controller.handleDispatchedAction;
  const handlers: DispatchOverridingHandler[] = [];
  calc.controller.handleDispatchedAction = function (evt) {
    for (const { handler } of handlers) {
      const keepGoing = handler(evt);
      if (keepGoing === "abort-later-handlers") return;
    }

    old.call(this, evt);
  };
  return handlers;
}
