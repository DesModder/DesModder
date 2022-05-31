import { Diagnostic } from "@codemirror/lint";
import { Pos } from "./TextAST";

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
