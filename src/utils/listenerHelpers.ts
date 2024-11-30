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
  Obj extends Record<Key, (...args: any[]) => any>,
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
