import { Diagnostic } from "@codemirror/lint";
import { Calc } from "desmodder";
import augToRaw from "../aug/augToRaw";
import textToAST from "../down/textToAST";
import astToAug from "./astToAug";
import { error } from "./diagnostics";

export default function applyText(text: string): Diagnostic[] {
  try {
    const [parseErrors, ast] = textToAST(text);
    const [allErrors, aug] = astToAug(parseErrors, ast);
    if (aug === null) return allErrors;
    const state = augToRaw(aug);
    Calc.setState(state);
    return allErrors;
  } catch (err) {
    console.error("Error while compiling to Desmos:\n", err);
    return [error(`Fatal error: ${err}`, undefined)];
  }
}
