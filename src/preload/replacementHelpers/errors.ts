export class ReplacementError extends Error {
  readonly langStack: string[] = [];

  constructor(readonly message: string) {
    super(message);
    this.name = "ReplacementError";
    this.stack = this.message;
  }

  pushToStack(...s: string[]) {
    this.langStack.push(...s);
    // TODO: get actual line numbers (source map?)
    this.stack =
      "ReplacementError: " +
      this.message +
      this.langStack
        .map((x) => "\n    at " + x + " (applyReplacement:0:0)")
        .join("");
  }
}

export function tryWithErrorContext<T>(f: () => T, ...s: string[]): T {
  try {
    return f();
  } catch (err) {
    if (err instanceof ReplacementError) err.pushToStack(...s);
    throw err;
  }
}
