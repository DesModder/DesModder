import { Calc } from "globals/window";

// For now, just let Raw → Text be the same as JSON stringify

export default function getText() {
  const state = Calc.getState();
  return JSON.stringify(state, null, 2);
}
