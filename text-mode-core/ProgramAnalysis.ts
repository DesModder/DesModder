import { Program, Statement } from "./TextAST";
import type { Diagnostic } from "@codemirror/lint";

export interface ProgramAnalysis {
  program: Program;
  diagnostics: readonly Diagnostic[];
  mapIDstmt: Record<string, Statement>;
}
