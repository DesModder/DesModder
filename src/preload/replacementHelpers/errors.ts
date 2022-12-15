import { ReplacementToken } from "./tokenize";

export function syntaxError(s: string): never {
  throw new Error(
    `Error with replacement: ${s}\n` +
      "This is a problem with a .replacement file"
  );
}

export function errorInBlock(
  s: string,
  heading: ReplacementToken & { tag: "heading" }
): never {
  throw new Error(`Replacement error under heading "${heading.text}": ${s}`);
}

export function runtimeError(s: string): never {
  throw new Error(
    `Runtime error while applying replacement: ${s}\n` +
      "This might be a problem with a .replacement file, or Desmos's code has changed"
  );
}
