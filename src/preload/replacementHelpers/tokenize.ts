import { ReplacementError } from "./errors";
import jsTokens, { Token } from "js-tokens";

export type PatternToken =
  | Token
  | {
      type: "PatternBalanced";
      value: string;
    }
  | {
      type: "PatternIdentifier";
      value: string;
    };

function errorOnLine(msg: string, lineIndex: number, line: string): never {
  throw new ReplacementError(`${msg} (line ${lineIndex + 1}): ${line}`);
}

export function tokenizeReplacement(replacementString: string) {
  replacementString = replacementString.replace(/\r/g, "");
  if (!replacementString.startsWith("#"))
    throw new ReplacementError("File is missing heading (line 1)");
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
        text: line.slice(depth).trim(),
      });
    } else if (line.startsWith("*")) {
      const match = line.match(/^\*([^*]+)\*(.*)$/);
      if (match === null)
        errorOnLine(`Line starting with '*' missing second '*'`, i, line);
      const parts = match[2].split("=>");
      if (parts.length > 2)
        errorOnLine("Duplicate '=>'; only one is allowed", i, line);
      const args = inlineCodes(parts[0]);
      const ret = inlineCodes(parts[1] ?? "");
      if (ret.length > 1)
        errorOnLine("Duplicate return capture variable", i, line);
      tokens.push({
        tag: "emph",
        command: normalizeCommand(match[1]),
        args,
        returns: ret[0],
      });
    } else if (line.startsWith("```")) {
      const isStart = line.startsWith("```js");
      if (isStart) {
        if (codeStartLine !== null)
          errorOnLine(
            "Unexpected code block start after start. " +
              "Missing '```' or duplicated '```js'",
            i,
            line
          );
        codeStartLine = i;
      } else {
        if (codeStartLine === null)
          errorOnLine(
            "Unexpected code block end without start. " +
              "Code blocks need to start with '```js'",
            i,
            line
          );
        tokens.push({
          tag: "code",
          value: patternTokens(lines.slice(codeStartLine + 1, i).join("\n")),
        });
        codeStartLine = null;
      }
    }
    // else: this line is a comment, or part of code block
  }
  return tokens;
}

export function patternTokens(str: string): PatternToken[] {
  return [...jsTokens(str.trim().replace(/\s*<(\w+)>\s*/, "__$1__"))].map(
    (token) =>
      token.type !== "IdentifierName"
        ? token
        : /^__\w*__$/.test(token.value)
        ? { type: "PatternBalanced", value: token.value }
        : token.value.startsWith("$")
        ? { type: "PatternIdentifier", value: token.value }
        : token
  );
}

function normalizeCommand(command: string) {
  return command.trim().toLowerCase().replace(/\W/g, "");
}

function inlineCodes(str: string) {
  return [...str.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
}

export type ReplacementToken =
  | {
      tag: "code";
      value: PatternToken[];
    }
  | {
      tag: "heading";
      depth: number;
      text: string;
    }
  | {
      tag: "emph";
      command: string;
      args: string[];
      returns?: string;
    };
