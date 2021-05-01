import Calc from "./Calc";

interface windowConfig extends Window {
  require(s: string): any;
  Calc: Calc;
  DesModder: any;
}

declare var window: windowConfig;

export default window;

export const Calc = window.Calc;

export const desmosRequire = window.require;

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
    fromEntries<T>(obj: T): FromEntriesWithReadOnly<T>;
  }
}
