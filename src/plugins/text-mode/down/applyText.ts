import { Calc } from "desmodder";
import augToRaw from "../aug/augToRaw";
import textToAST from "../down/textToAST";
import astToAug from "./astToAug";

export default function applyText(text: string) {
  let state;
  try {
    const ast = textToAST(text);
    const aug = astToAug(ast);
    state = augToRaw(aug);
  } catch (err) {
    console.error("Error while compiling to Desmos:\n", err);
  }
  Calc.setState(state);
}
