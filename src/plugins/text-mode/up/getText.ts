import { Calc } from "globals/window";
import rawToAug from "../aug/rawToAug";

// For now, just let Raw → Text be the same as Raw → Aug

export default function getText() {
  const state = Calc.getState();
  return JSON.stringify(rawToAug(state), null, 2);
}
