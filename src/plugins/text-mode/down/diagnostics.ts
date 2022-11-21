import TextAST, { Pos } from "./TextAST";
import { Diagnostic } from "@codemirror/lint";

function diagnostic(
  severity: "error" | "warning",
  message: string,
  pos: Pos | undefined
) {
  return {
    message,
    severity,
    from: pos?.from ?? 0,
    to: pos?.to ?? 0,
  };
}

export function error(message: string, pos: Pos | undefined): Diagnostic {
  return diagnostic("error", message, pos);
}

export function warning(message: string, pos: Pos | undefined): Diagnostic {
  return diagnostic("warning", message, pos);
}

export class DiagnosticsState {
  constructor(public diagnostics: Diagnostic[] = []) {}

  pushError(message: string, pos: TextAST.Pos | undefined) {
    this.diagnostics.push(error(message, pos));
  }

  pushWarning(message: string, pos: TextAST.Pos | undefined) {
    this.diagnostics.push(warning(message, pos));
  }
}
