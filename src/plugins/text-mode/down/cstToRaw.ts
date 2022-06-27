import augToRaw from "../aug/augToRaw";
import { cstToAST } from "./cstToAST";
import astToAug from "./astToAug";
import { error } from "./diagnostics";
import { Tree } from "@lezer/common";
import { GraphState } from "@desmodder/graph-state";
import { Text } from "@codemirror/state";
import { ProgramAnalysis } from "../LanguageServer";

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
