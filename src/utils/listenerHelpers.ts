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

// attach a function onto an existing function.
// acts as a decorator that can be disabled later.
export function attach<F extends (...args: any) => any>(
  getTarget: () => F,
  setTarget: (f: F) => void,
  handler: (...params: Parameters<F>) => [false, ReturnType<F>] | undefined
): () => void {
  const oldTarget = getTarget();

  // @ts-expect-error go away
  setTarget((...args) => {
    const ret = handler(...args);

    // intentional
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-boolean-literal-compare
    if (ret?.[0] === false) return ret[1];
    return oldTarget(...args);
  });

  return () => setTarget(oldTarget);
}

// helper function for attach
export function propGetSet<Obj extends object, Key extends keyof Obj>(
  obj: Obj,
  key: Key
) {
  return [() => obj[key], (v: Obj[Key]) => (obj[key] = v)] as const;
}
