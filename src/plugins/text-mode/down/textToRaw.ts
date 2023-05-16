import { Console } from "../../../globals/window";
import { ProgramAnalysis } from "../LanguageServer";
import augToRaw from "../aug/augToRaw";
import astToAug from "./astToAug";
import { error } from "./diagnostics";
import { parse } from "./textToAST";
import { GraphState } from "@desmodder/graph-state";

export default function textToRaw(
  text: string
): [ProgramAnalysis, GraphState | null] {
  const [parseErrors, ast] = parse(text);
  try {
    const [analysis, aug] = astToAug(parseErrors, ast);
    return [analysis, aug ? augToRaw(aug) : null];
  } catch (err) {
    Console.warn("Error while compiling to Desmos:\n", err);
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
