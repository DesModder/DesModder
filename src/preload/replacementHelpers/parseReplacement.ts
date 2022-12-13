import jsTokens, { Token } from "js-tokens";

export interface ReplacementRule {
  module: string;
  from: Token[];
  to: Token[];
}

export default function parseReplacement(
  replacementString: string
): ReplacementRule {
  const tokens = tokenizeReplacement(replacementString);
  if (
    tokens.length !== 3 ||
    tokens[0].tag !== "heading" ||
    tokens[1].tag !== "code" ||
    tokens[1].prefix !== "From:" ||
    tokens[2].tag !== "code" ||
    tokens[2].prefix !== "To:"
  )
    syntaxError("Currently only support (heading)(from)(to)");
  const moduleMatch = tokens[0].value.match(/Module `([^`]*)`/);
  if (tokens[0].depth !== 1 || !moduleMatch) syntaxError("Invalid heading");
  return {
    module: moduleMatch[1],
    from: tokens[1].value,
    to: tokens[2].value,
  };
}

function tokenizeReplacement(replacementString: string) {
  if (!replacementString.startsWith("#"))
    syntaxError("file must start with heading");
  const tokens: ReplacementToken[] = [];
  const lines = replacementString.split(/\n/g);
  // starting line (containing "```js") of the current code block, else null
  let codeStartLine: number | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("#")) {
      const depth = line.match(/^#+/)![0].length;
      tokens.push({
        tag: "heading",
        depth,
        value: line.slice(depth).trim(),
      });
    } else if (line.startsWith("```")) {
      const isStart = line.startsWith("```js");
      if (isStart) {
        if (codeStartLine !== null)
          syntaxError("Unexpected code block start after start");
        codeStartLine = i;
      } else {
        if (codeStartLine === null)
          syntaxError("Unexpected code block end without start");
        tokens.push({
          tag: "code",
          value: Array.from(
            jsTokens(lines.slice(codeStartLine + 1, i).join("\n"))
          ),
          prefix: lines[codeStartLine - 1],
        });
        codeStartLine = null;
      }
    }
    // else: this line is a comment, or part of code block
  }
  return tokens;
}

type ReplacementToken =
  | {
      tag: "code";
      value: Token[];
      /** prefix should something like From: or To: */
      prefix: string;
    }
  | {
      tag: "heading";
      depth: number;
      value: string;
    };

function syntaxError(s: string): never {
  throw new Error(`Replacement syntax error: ${s}`);
}
