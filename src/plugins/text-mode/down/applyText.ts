import { Diagnostic } from "@codemirror/lint";
import { Calc } from "desmodder";
import augToRaw from "../aug/augToRaw";
import textToAST from "../down/textToAST";
import astToAug from "./astToAug";
import { error } from "./diagnostics";

export default function applyText(text: string): Diagnostic[] {
  try {
    const ast = textToAST(text);
    const [errors, aug] = astToAug(ast);
    if (aug === null) return errors;
    const state = augToRaw(aug);
    Calc.setState(state);
    return errors;
  } catch (err) {
    console.error("Error while compiling to Desmos:\n", err);
    return [error(`Fatal error: ${err}`, undefined)];
  }
}
