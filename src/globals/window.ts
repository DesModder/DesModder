import CalcType from "./Calc";

interface windowConfig extends Window {
  require: ((s: string[], callback: Function) => void) & ((s: string) => any);
  Calc: CalcType;
  DesModder: any;
  define: (
    moduleName: string,
    dependencies: string[],
    definition: Function
  ) => void;
  ALMOND_OVERRIDES: { [key: string]: Function };
}

declare let window: windowConfig;

export default window;

// defer access of Calc.controller, Calc.observe, etc. to when they are called
// avoid Calc === undefined but window.Calc !== undefined
export const Calc = new Proxy(
  {},
  {
    get(_target, prop) {
      if (window.Calc === undefined) return undefined;
      if (prop in window.Calc) {
        return window.Calc[prop as keyof typeof window.Calc];
      }
    },
  }
) as CalcType;

// defer access of window.require to when it is used
export const desmosRequire = new Proxy(() => {}, {
  apply: function (_target, _that, args) {
    if (window.require === undefined) return undefined;
    return (window.require as any)(...args);
  },
}) as typeof window.require;

/* Object.fromEntries based on https://dev.to/svehla/typescript-object-fromentries-389c */
type DeepWriteable<T> = { -readonly [P in keyof T]: DeepWriteable<T[P]> };
type FromEntries<T> = T extends [infer Key, any][]
  ? {
      [K in Key extends string ? Key : string]: Extract<T[number], [K, any]>[1];
    }
  : { [key in string]: any };

export type FromEntriesWithReadOnly<T> = FromEntries<DeepWriteable<T>>;

declare global {
  interface ObjectConstructor {
    // eslint-disable-next-line @typescript-eslint/method-signature-style
    fromEntries<T>(obj: T): FromEntriesWithReadOnly<T>;
  }
}

export interface TopLevelComponents {
  graphsController: {
    getCurrentGraphTitle: () => string | undefined;
  };
}
