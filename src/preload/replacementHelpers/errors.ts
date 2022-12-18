export class ReplacementError extends Error {
  readonly langStack: StackFrame[] = [];
  readonly originalMessage: string;

  constructor(readonly message: string) {
    super(message);
    this.originalMessage = message;
    this.name = "ReplacementError";
    this.stack = this.message;
  }

  pushToStack(...s: StackFrame[]) {
    this.langStack.push(...s);
    // Chrome only shows the stack
    this.stack =
      "ReplacementError: " +
      this.originalMessage +
      this.langStack
        // Use "in" instead of "at" to prevent filename from being clickable in Chrome.
        .map((x) => `\n    in ${x.message} (${x.filename})`)
        .join("");
    // Firefox only shows the message
    (this as any).message = this.stack;
  }
}

interface StackFrame {
  message: string;
  filename: string;
}

export function tryWithErrorContext<T>(f: () => T, ...s: StackFrame[]): T {
  try {
    return f();
  } catch (err) {
    if (err instanceof ReplacementError) err.pushToStack(...s);
    throw err;
  }
}
