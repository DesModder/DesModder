import Calc from "./Calc";

interface windowConfig extends Window {
  require(s: string): any;
  Calc: Calc;
  DesModder: any;
}

declare var window: windowConfig;

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
) as Calc;

// defer access of window.require to when it is used
export const desmosRequire = new Proxy(() => {}, {
  apply: function (_target, _that, args) {
    if (window.require === undefined) return undefined;
    return (window.require as any)(...args);
  },
}) as typeof window.require;
