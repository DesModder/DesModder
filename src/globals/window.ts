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
