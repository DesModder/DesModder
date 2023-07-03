import { pollForValue } from "./utils";
import { MathQuillField } from "components";
import { DispatchedEvent } from "globals/Calc";
import { Calc } from "globals/window";

let dispatchOverridingHandlers: {
  handler: (evt: DispatchedEvent) => boolean | undefined;
  priority: number;
  id: number;
}[] = [];

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
  dispatchOverridingHandlers.push({ handler, priority, id });

  // sort the handlers so that higher priorities are first
  // could easily be optimized but prob not a bottleneck
  dispatchOverridingHandlers.sort((a, b) => b.priority - a.priority);

  return id;
}

// deregisters a function created with registerCustomDispatchOverridingHandler
// uses the id that the former function returns
export function deregisterCustomDispatchOverridingHandler(id: number): void {
  // remove all handlers with matching IDs
  dispatchOverridingHandlers = dispatchOverridingHandlers.filter(
    (entry) => entry.id !== id
  );
}

// once Calc is defined, change handleDispatchedAction to first
// run a set of custom handlers
export function setupDispatchOverride() {
  const old = Calc.controller.handleDispatchedAction;
  Calc.controller.handleDispatchedAction = function (evt) {
    for (const { handler } of dispatchOverridingHandlers) {
      const keepGoing = handler(evt);
      if (keepGoing === false) return;
    }

    old.call(this, evt);
  };
}

void (async () => {
  await pollForValue(() => Calc);
  setupDispatchOverride();
})();

// "attach" a function onto an existing function, performing some functionality
// and then optionally triggering the existing function.
// Returns an "unsubscribe" function that resets the attached function to its prior state
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

// helper function for attach; makes a getter/setter for an object property
export function propGetSet<Obj extends object, Key extends keyof Obj>(
  obj: Obj,
  key: Key
) {
  return [() => obj[key], (v: Obj[Key]) => (obj[key] = v)] as const;
}

// override all keyboard inputs entering a MathQuill field
// and optionally prevent them from doing their default behavior
export function hookIntoOverrideKeystroke(
  // field for which to override kb inputs
  mq: MathQuillField,
  // callback function
  // return false to override all other events
  fn: (key: string, evt: KeyboardEvent) => boolean | undefined,
  // higher priority --> runs first
  priority: number,
  // unique key to prevent adding duplicate hooks
  key: string
) {
  // @ts-expect-error adding properties to functions
  if (!mq.__options.overrideKeystroke.isMonkeypatchedIn) {
    const unsub = attach(
      ...propGetSet(mq.__options, "overrideKeystroke"),
      (key, evt) => {
        // @ts-expect-error adding properties to functions
        for (const h of mq.__options.overrideKeystroke.handlers as {
          fn: (key: string, evt: KeyboardEvent) => boolean | undefined;
          priority: number;
        }[]) {
          if (h.fn(key, evt) === false) return [false, undefined];
        }
      }
    );

    // @ts-expect-error adding properties to functions
    mq.__options.overrideKeystroke.unsub = unsub;
    // @ts-expect-error adding properties to functions
    mq.__options.overrideKeystroke.isMonkeypatchedIn = true;
    // @ts-expect-error adding properties to functions
    mq.__options.overrideKeystroke.handlers = [];
  }

  const handler = { priority, fn, key };

  const overrideKeystroke = mq.__options
    .overrideKeystroke as typeof mq.__options.overrideKeystroke & {
    handlers: {
      priority: number;
      fn: (key: string, evt: KeyboardEvent) => boolean | undefined;
      key: string;
    }[];
    unsub: () => void;
  };

  // if a handler with the key already exists, return nothing
  // to prevent duplicate unsub functions from being created
  const h = overrideKeystroke.handlers.find((h) => h.key === key);
  if (h) {
    h.priority = priority;
    h.fn = fn;
    // add the handler normally
  } else {
    overrideKeystroke.handlers.push(handler);
  }

  // sort by priority properly
  overrideKeystroke.handlers.sort(
    (a: { priority: number }, b: { priority: number }) =>
      b.priority - a.priority
  );

  console.log(overrideKeystroke);

  // return a function that removes the handler
  return () => {
    overrideKeystroke.handlers = overrideKeystroke.handlers.filter(
      (h) => h.key !== key
    );

    // completely revert overrideKeystroke if there's no handlers registered anymore
    if (overrideKeystroke.handlers.length === 0) overrideKeystroke.unsub();
  };
}
