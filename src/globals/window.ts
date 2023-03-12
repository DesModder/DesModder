import CalcType from "./Calc";

interface windowConfig extends Window {
  Calc: CalcType;
  DesModder: any;
  ALMOND_OVERRIDES: { [key: string]: Function };
  DesModderForceDisabled?: Set<string>;
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

export const Fragile = new Proxy(
  {},
  {
    get(_target, prop) {
      if ((window as any).Desmos === undefined) return undefined;
      const fragile = (window as any).Desmos?.Private?.Fragile;
      if (fragile === undefined) return undefined;
      return fragile[prop];
    },
  }
) as any;

export const Private = new Proxy(
  {},
  {
    get(_target, prop) {
      if ((window as any).Desmos === undefined) return undefined;
      const priv = (window as any).Desmos.Private;
      if (priv === undefined) return undefined;
      return priv[prop];
    },
  }
) as any;

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
