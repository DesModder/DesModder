import { Program, Statement } from "./TextAST";
import { Diagnostic } from "@codemirror/lint";

export interface ProgramAnalysis {
  program: Program;
  diagnostics: readonly Diagnostic[];
  mapIDstmt: Record<string, Statement>;
}
