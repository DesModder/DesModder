import type { Calc, DispatchedEvent } from "#globals";

interface DispatchOverridingHandler {
  handler: (evt: DispatchedEvent) => boolean | undefined;
  priority: number;
  id: number;
}

const calcDispatchOverrideHandlers = new WeakMap<
  Calc,
  DispatchOverridingHandler[]
>();

let dispatchOverridingHandlerId = 0;

// schedule a function to run after every desmos event
// priorities determine which run first
// the handler can return false to force the dispatcher to stop early
// (e.g. to stop desmos from doing a default action upon pressing a key)
export function registerCustomDispatchOverridingHandler(
  calc: Calc,
  handler: (evt: DispatchedEvent) => boolean | undefined,
  priority: number
): number {
  const handlers = getDispatchOverrideHandlers(calc);
  const id = dispatchOverridingHandlerId++;
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
  id: number
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
      if (keepGoing === false) return;
    }

    old.call(this, evt);
  };
  return handlers;
}

// "attach" a function onto an existing function, performing some functionality
// and then optionally triggering the existing function.
// Returns an "unsubscribe" function that resets the attached function to its prior state
export function attach<F extends (...args: any) => any>(
  getTarget: () => F,
  setTarget: (f: F) => void,
  handler: (...params: Parameters<F>) => [false, ReturnType<F>] | undefined
): () => void {
  const oldTarget = getTarget();

  // @ts-expect-error contravariance
  setTarget((...args) => {
    // @ts-expect-error contravariance
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

type HookedFunctionCallback<Fn extends (...args: any[]) => any> = (
  stop: (ret: ReturnType<Fn>) => void,
  ...args: Parameters<Fn>
) => void;

type HookedFunction<Fn extends (...args: any[]) => any> = Fn & {
  __isMonkeypatchedIn: true;
  handlers: {
    key: string;
    fn: HookedFunctionCallback<Fn>;
    priority: number;
  }[];
  revert: () => void;
};

type MaybeHookedFunction<Fn extends (...args: any[]) => any> =
  | HookedFunction<Fn>
  | (Fn & {
      __isMonkeypatchedIn: undefined;
    });

export function hookIntoFunction<
  Key extends string,
  Obj extends { [K in Key]: (...args: any[]) => any },
  Fn extends Obj[Key]
>(
  obj: Obj,
  prop: Key,
  key: string,
  priority: number,
  fn: HookedFunctionCallback<Fn>
) {
  const oldfn = obj[prop].bind(obj) as MaybeHookedFunction<Fn>;

  // monkeypatch the function if it isn't monkeypatched already
  if (!oldfn.__isMonkeypatchedIn) {
    const monkeypatchedFunction = function (
      ...args: Parameters<Fn>
    ): ReturnType<Fn> {
      const handlersArray = (obj[prop] as HookedFunction<Fn>).handlers;

      for (const h of handlersArray) {
        let stop = false;
        let ret: ReturnType<Fn> | undefined;
        h.fn((r: ReturnType<Fn>) => {
          stop = true;
          ret = r;
        }, ...args);
        if (stop) return ret!;
      }

      return oldfn(...args);
    };
    monkeypatchedFunction.__isMonkeypatchedIn = true;
    monkeypatchedFunction.handlers = [] as HookedFunction<Fn>["handlers"];
    monkeypatchedFunction.revert = () => {
      obj[prop] = oldfn;
    };

    obj[prop] = monkeypatchedFunction as unknown as any;
  }

  const monkeypatchedFn = obj[prop] as HookedFunction<Fn>;

  // if theres already a handler with this key, update it
  const handler = monkeypatchedFn.handlers.find((h) => h.key === key);
  if (handler) {
    handler.priority = priority;
    handler.fn = fn;
    return;
  }

  // if there isn't one, add a new one
  monkeypatchedFn.handlers.push({
    key,
    priority,
    fn,
  });

  monkeypatchedFn.handlers.sort((a, b) => b.priority - a.priority);

  // function for removing this handler
  return () => {
    monkeypatchedFn.handlers = monkeypatchedFn.handlers.filter(
      (h) => h.key !== key
    );

    if (monkeypatchedFn.handlers.length === 0) {
      monkeypatchedFn.revert();
    }
  };
}
