import { ProgramAnalysis } from "../ProgramAnalysis";
import { Config } from "../TextModeConfig";
import { latexTreeToString } from "../aug/augLatexToRaw";
import augToRaw from "../aug/augToRaw";
import astToAug, { childExprToAug } from "./astToAug";
import { error } from "./diagnostics";
import { parse } from "./textToAST";
import type { GraphState } from "@desmodder/graph-state";

export default function textToRaw(
  cfg: Config,
  text: string
): [ProgramAnalysis, GraphState | null] {
  const analysis = parse(cfg, text);
  try {
    const [analysis2, aug] = astToAug(cfg, analysis);
    return [analysis2, aug ? augToRaw(cfg, aug) : null];
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("Error while compiling to Desmos:\n", err);
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

export function textModeExprToLatex(cfg: Config, tmExpr: string) {
  const parsedTextMode = parse(cfg, tmExpr);
  if (
    parsedTextMode.program.children.length !== 1 ||
    parsedTextMode.diagnostics.length > 0
  )
    return;
  const parsedExpr = parsedTextMode.program.children[0];
  if (parsedExpr && parsedExpr.type === "ExprStatement") {
    const aug = childExprToAug(parsedExpr.expr);
    const latex = latexTreeToString(cfg, aug);
    return latex;
  }
}
