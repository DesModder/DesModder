import { pollForValue } from "./utils";
import { MathQuillField } from "#components";
import { Calc, DispatchedEvent } from "#globals";

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
  return hookIntoFunction(
    mq.__options,
    "overrideKeystroke",
    key,
    priority,
    (stop, k, e) => {
      const cont = fn(k, e);
      if (cont === false) {
        stop();
      }
    }
  );
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
  Obj extends { [K in Key]: (...args: any[]) => any },
  Fn extends Obj[Key],
  Key extends keyof Obj
>(
  obj: Obj,
  prop: Key,
  key: string,
  priority: number,
  fn: HookedFunctionCallback<Fn>
) {
  const oldfn = obj[prop] as MaybeHookedFunction<Fn>;

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
        if (stop) return ret as ReturnType<Fn>;
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
