import { ReplacementToken } from "./tokenize";

export function syntaxError(s: string): never {
  throw new Error(`Replacement syntax error: ${s}`);
}

export function errorInBlock(
  s: string,
  heading: ReplacementToken & { tag: "heading" }
): never {
  throw new Error(`Replacement error under heading "${heading.text}": ${s}`);
}
