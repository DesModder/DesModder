import { ReplacementError } from "./errors";
import jsTokens, { Token } from "js-tokens";

export type PatternToken =
  | Token
  | {
      type: "PatternBalanced";
      value: string;
    }
  | {
      type: "PatternBalancedNonGreedy";
      value: string;
    }
  | {
      type: "PatternIdentifierDot";
      value: string;
    }
  | {
      type: "PatternIdentifier";
      value: string;
    };

function errorOnLine(msg: string, lineIndex: number, line: string): never {
  throw new ReplacementError(`${msg} (line ${lineIndex + 1}): ${line}`);
}

export function tokenizeReplacement(
  replacementString: string,
  filename: string
) {
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
      const depth = /^#+/.exec(line)![0].length;
      tokens.push({
        tag: "heading",
        depth,
        text: line.slice(depth).trim(),
      });
    } else if (line.startsWith("*")) {
      const match = /^\*([^*]+)\*(.*)$/.exec(line);
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
          value: patternTokens(
            lines.slice(codeStartLine + 1, i).join("\n"),
            filename
          ),
        });
        codeStartLine = null;
      }
    }
    // else: this line is a comment, or part of code block
  }
  return tokens;
}

export function patternTokens(str: string, msg: string) {
  return [..._patternTokens(str, msg)];
}

const allowIDs = "allow-ids:";
const keywords = ["do", "if", "for", "in", "let", "new", "null", "try", "var"];
const defaultAllowedIDs = ["window", "DesModder", "DSM"].concat(keywords);

function* _patternTokens(str: string, msg: string): Generator<PatternToken> {
  const allowedIDs = new Set<string>(defaultAllowedIDs);
  str = safeDSM(str);
  const tokens = [..._patternTokensRaw(str)];
  for (const [i, token] of tokens.entries()) {
    // check if there's an "allow-ids:" comment
    const comment = commentInner(token);
    if (comment !== undefined) {
      if (comment.startsWith(allowIDs)) {
        comment
          .slice(allowIDs.length)
          .split(",")
          .forEach((s) => allowedIDs.add(s.trim()));
      }
      continue;
    }
    // disallow long IDs
    if (token.type === "IdentifierName" && token.value.length <= 3) {
      const dotAccessName = ["?.", "."].includes(tokens[i - 1]?.value);
      const propertyName = tokens[i + 1]?.value === ":";
      const probablyFine = dotAccessName || propertyName;
      // This may be a global/local variable, and it might be brittle
      if (!probablyFine && !allowedIDs.has(token.value)) {
        // This can't fail due to Desmos's fault, only DesModder's fault,
        // so it's safe to throw an error here.
        throw new Error(
          `Identifier '${token.value}' in '${msg}' may depend on specific minified naming. ` +
            "Prepend a '$' to indicate you want to match any identifier, or " +
            "lengthen it to longer than 3 letters, or " +
            `write '// ${allowIDs} ${token.value}' to indicate this is a ` +
            "global or local variable with a fixed name."
        );
      }
    }
    yield token;
  }
}

function* _patternTokensRaw(str: string): Generator<PatternToken> {
  for (const token of jsTokens(str.trim())) {
    yield parseToken(token);
  }
}

function parseToken(token: Token): PatternToken {
  switch (true) {
    case token.type !== "IdentifierName":
      return token;
    case /^__\w*__$/.test(token.value):
      return { type: "PatternBalanced", value: token.value };
    case /^__\w*__\$$/.test(token.value):
      return { type: "PatternBalancedNonGreedy", value: token.value };
    case token.value.startsWith("$$"):
      return { type: "PatternIdentifierDot", value: token.value };
    case token.value.startsWith("$"):
      return { type: "PatternIdentifier", value: token.value };
    default:
      return token;
  }
}

function commentInner(token: PatternToken) {
  if (token.type === "SingleLineComment")
    return token.value.replace(/^\/+/, "").trim();
  else if (token.type === "MultiLineComment")
    return token.value.replace(/\/\*+/, "").replace(/\*\//, "").trim();
}

function safeDSM(str: string) {
  return str.replace(/(?<!\.)DSM\??\./g, "globalThis.DSM?.");
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
