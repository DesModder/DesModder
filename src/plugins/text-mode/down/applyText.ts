import { Calc } from "globals/window";

// For now, just let Text → Raw be the same as JSON parse

export default function applyText(text: string) {
  Calc.setState(JSON.parse(text));
}
