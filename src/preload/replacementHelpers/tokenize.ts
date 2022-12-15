import { syntaxError } from "./errors";
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

export function tokenizeReplacement(replacementString: string) {
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
        text: line.slice(depth),
      });
    } else if (line.startsWith("*")) {
      const match = line.match(/^\*([^*]+)\*(.*)$/);
      if (match === null)
        syntaxError("Expected line starting with '*' to be valid command");
      tokens.push({
        tag: "emph",
        command: normalizeCommand(match[1]),
        args: inlineCodes(match[2]),
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
          value: patternTokens(lines.slice(codeStartLine + 1, i).join("\n")),
        });
        codeStartLine = null;
      }
    }
    // else: this line is a comment, or part of code block
  }
  return tokens;
}

function patternTokens(str: string): PatternToken[] {
  return [...jsTokens(str.trim().replace(/\s*<(\w+)>\s*/, "__$1__"))].map(
    (token) =>
      token.type !== "IdentifierName"
        ? token
        : /^__\w+__$/.test(token.value)
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
    };
