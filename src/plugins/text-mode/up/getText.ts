import { Calc } from "globals/window";
import rawToAug from "../aug/rawToAug";
import augToText from "./augToText";

// For now, just let Raw → Text be the same as Raw → Aug

export default function getText() {
  const state = Calc.getState();
  const aug = rawToAug(state);
  return augToText(aug);
}
