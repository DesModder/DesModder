import { DispatchedEvent } from "globals/Calc";
import { Calc } from "globals/window";

const dispatchOverridingHandlers: [
  (evt: DispatchedEvent) => boolean | undefined,
  number,
  number
][] = [];

let dispatchOverridingHandlerId = 0;

// schedule a function to run after every desmos event
// priorities determine which run first
// the handler can return false to force the dispatcher to stop early
// (e.g. to stop desmos from doing a default action upon pressing a key)
export function registerCustomDispatchOverridingHandler(
  handler: (evt: DispatchedEvent) => boolean | undefined,
  priority: number
): number {
  const id = dispatchOverridingHandlerId++;
  // add the handler
  dispatchOverridingHandlers.push([handler, priority, id]);

  // sort the handlers so that higher priorities are first
  // could easily be optimized but prob not a bottleneck
  dispatchOverridingHandlers.sort((a, b) => b[1] - a[1]);

  return id;
}

// deregisters a function created with registerCustomDispatchOverridingHandler
// uses the id that the former function returns
export function deregisterCustomDispatchOverridingHandler(id: number): void {
  // find the handler by id
  const firstIndex = dispatchOverridingHandlers.findIndex(
    ([_, __, id2]) => id2 === id
  );
  if (firstIndex === -1) {
    // eslint-disable-next-line no-console
    console.error(
      `Failed to deregister the dispatch overriding handler '${id}'.`
    );
  }

  // remove the handler
  dispatchOverridingHandlers.splice(firstIndex, 1);
}

// once Calc is defined, change handleDispatchedAction to first
// run a set of custom handlers
const interval = setInterval(() => {
  if (!Calc) return;
  clearInterval(interval);

  // @ts-expect-error this exists
  const old = Calc.controller.handleDispatchedAction;
  // @ts-expect-error this exists
  Calc.controller.handleDispatchedAction = function (evt) {
    for (const [handler] of dispatchOverridingHandlers) {
      const keepGoing = handler(evt);
      if (keepGoing === false) return;
    }

    old.call(this, evt);
  };
}, 0);
