import { Diagnostic } from "@codemirror/lint";
import augToRaw from "../aug/augToRaw";
import { cstToAST } from "../down/textToAST";
import astToAug from "./astToAug";
import { error } from "./diagnostics";
import { Tree } from "@lezer/common";
import { MapIDPosition } from "../modify/mapIDPosition";
import { GraphState } from "@desmodder/graph-state";

export default function cstToRaw(
  cst: Tree,
  text: string
): [Diagnostic[], GraphState | null, MapIDPosition] {
  try {
    const [parseErrors, ast] = cstToAST(cst, text);
    const [allErrors, aug, idMap] = astToAug(parseErrors, ast);
    if (aug === null) return [allErrors, null, idMap];
    const state = augToRaw(aug);
    return [allErrors, state, idMap];
  } catch (err) {
    console.error("Error while compiling to Desmos:\n", err);
    return [[error(`Fatal error: ${err}`, undefined)], null, {}];
  }
}
