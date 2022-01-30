import { Calc } from "globals/window";
import augToRaw from "../aug/augToRaw";
import textToAST from "../down/textToAST";

// For now, just let Text → Raw be the same as Aug → Raw

export default function applyText(text: string) {
  const ast = textToAST(text);
  console.log(ast);
  // const state = augToRaw(JSON.parse(text));
  // Calc.setState(state);
}
