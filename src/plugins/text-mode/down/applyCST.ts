import { Diagnostic } from "@codemirror/lint";
import { Calc } from "desmodder";
import augToRaw from "../aug/augToRaw";
import { cstToAST } from "../down/textToAST";
import astToAug from "./astToAug";
import { error } from "./diagnostics";
import { Tree } from "@lezer/common";

export default function applyCST(cst: Tree, text: string): Diagnostic[] {
  try {
    const [parseErrors, ast] = cstToAST(cst, text);
    const [allErrors, aug] = astToAug(parseErrors, ast);
    if (aug === null) return allErrors;
    const state = augToRaw(aug);
    Calc.setState(state, {
      allowUndo: true,
    });
    return allErrors;
  } catch (err) {
    console.error("Error while compiling to Desmos:\n", err);
    return [error(`Fatal error: ${err}`, undefined)];
  }
}
