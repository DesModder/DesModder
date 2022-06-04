import { Diagnostic } from "@codemirror/lint";
import { Calc } from "desmodder";
import augToRaw from "../aug/augToRaw";
import { cstToAST } from "../down/textToAST";
import astToAug from "./astToAug";
import { error } from "./diagnostics";
import { Tree } from "@lezer/common";
import { MapIDPosition } from "../modify/mapIDPosition";

export default function applyCST(
  cst: Tree,
  text: string
): [Diagnostic[], MapIDPosition] {
  try {
    const [parseErrors, ast] = cstToAST(cst, text);
    const [allErrors, aug, idMap] = astToAug(parseErrors, ast);
    if (aug === null) return [allErrors, idMap];
    const state = augToRaw(aug);
    Calc.setState(state, {
      allowUndo: true,
    });
    return [allErrors, idMap];
  } catch (err) {
    console.error("Error while compiling to Desmos:\n", err);
    return [[error(`Fatal error: ${err}`, undefined)], {}];
  }
}
