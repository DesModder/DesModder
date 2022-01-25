import { Calc } from "globals/window";
import augToRaw from "../aug/augToRaw";

// For now, just let Text → Raw be the same as Aug → Raw

export default function applyText(text: string) {
  const state = augToRaw(JSON.parse(text));
  console.log(state);
  Calc.setState(state);
}
