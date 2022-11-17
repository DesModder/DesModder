import { ProgramAnalysis } from "../LanguageServer";
import augToRaw from "../aug/augToRaw";
import astToAug from "./astToAug";
import { cstToAST } from "./cstToAST";
import { error } from "./diagnostics";
import { Text } from "@codemirror/state";
import { GraphState } from "@desmodder/graph-state";
import { Tree } from "@lezer/common";

export default function cstToRaw(
  cst: Tree,
  text: Text
): [ProgramAnalysis, GraphState | null] {
  const [parseErrors, ast] = cstToAST(cst, text);
  try {
    const [analysis, aug] = astToAug(parseErrors, ast);
    return [analysis, aug ? augToRaw(aug) : null];
  } catch (err) {
    console.error("Error while compiling to Desmos:\n", err);
    return [
      {
        diagnostics: [error(`Fatal error: ${err}`, undefined)],
        ast,
        mapIDstmt: {},
      },
      null,
    ];
  }
}
