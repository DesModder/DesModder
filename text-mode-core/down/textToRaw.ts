import { ProgramAnalysis } from "../ProgramAnalysis";
import { latexTreeToString } from "../aug/augLatexToRaw";
import augToRaw from "../aug/augToRaw";
import astToAug, { childExprToAug } from "./astToAug";
import { error } from "./diagnostics";
import { parse } from "./textToAST";
import { GraphState } from "@desmodder/graph-state";
import { Console } from "globals/window";

export default function textToRaw(
  text: string
): [ProgramAnalysis, GraphState | null] {
  const analysis = parse(text);
  try {
    const [analysis2, aug] = astToAug(analysis);
    return [analysis2, aug ? augToRaw(aug) : null];
  } catch (err) {
    Console.warn("Error while compiling to Desmos:\n", err);
    return [
      {
        diagnostics: [error(`Fatal error: ${err}`, undefined)],
        program: analysis.program,
        mapIDstmt: {},
      },
      null,
    ];
  }
}

export function textModeExprToLatex(tmExpr: string) {
  const parsedTextMode = parse(tmExpr);
  if (
    parsedTextMode.program.children.length !== 1 ||
    parsedTextMode.diagnostics.length > 0
  )
    return;
  const parsedExpr = parsedTextMode.program.children[0];
  if (parsedExpr && parsedExpr.type === "ExprStatement") {
    const aug = childExprToAug(parsedExpr.expr);
    const latex = latexTreeToString(aug);
    return latex;
  }
}
