import { Calc } from "desmodder";
import augToRaw from "../aug/augToRaw";
import textToAST from "../down/textToAST";
import astToAug from "./astToAug";

export default function applyText(text: string) {
  const ast = textToAST(text);
  const aug = astToAug(ast);
  const state = augToRaw(aug);
  Calc.setState(state);
}
