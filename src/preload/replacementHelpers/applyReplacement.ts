import { syntaxError, runtimeError } from "./errors";
import { ReplacementRule } from "./parse";
import jsTokens, { Token } from "js-tokens";

export default function applyReplacement(
  replacement: ReplacementRule,
  fn: Function
) {
  const newCode = applyStringReplacement(
    replacement,
    Array.from(jsTokens(fn.toString()))
  )
    .map((t) => t.value)
    .join("");
  // use `Function` instead of `eval` to force treatment as an expression
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  return Function("return " + newCode)();
}

interface Range {
  start: number;
  length: number;
}

interface SymbolTable {
  // yes, there's two namespaces. What are you going to do about it?
  capturedIds: Map<string, Token>;
  ranges: Map<string, Range>;
}

/** Apply replacement to `str`, mutating and returning `str` */
function applyStringReplacement(
  replacement: ReplacementRule,
  str: Token[]
): Token[] {
  const table: SymbolTable = {
    capturedIds: new Map(),
    ranges: new Map(),
  };
  for (const command of replacement.commands) {
    switch (command.tag) {
      case "find": {
        const found = findPattern(command.code, str);
        found.capturedIds.forEach((v, k) => table.capturedIds.set(k, v));
        if (table.ranges.has(command.arg)) syntaxError("");
        table.ranges.set(command.arg, {
          start: found.startIndex,
          length: found.length,
        });
        break;
      }
      case "replace": {
        const range = table.ranges.get(command.arg);
        if (range === undefined) syntaxError(`Range not defined: \`${range}\``);
        replaceRange(str, range, command.code, table);
        break;
      }
      default:
        syntaxError(`Invalid command: *${command.tag}*`);
    }
  }
  return str;
}

function replaceRange(
  str: Token[],
  range: Range,
  to: Token[],
  table: SymbolTable
) {
  str.splice(
    range.start,
    range.length,
    ...to.map((token) => {
      if (token.type === "IdentifierName" && token.value.startsWith("$")) {
        const id = table.capturedIds.get(token.value);
        if (id === undefined)
          throw new Error(
            `Programming error: identifier ${token.value} in "to" not found in "from"`
          );
        return id;
      } else return token;
    })
  );
}

interface MatchResult {
  capturedIds: Map<string, Token>;
  startIndex: number;
  length: number;
}

function findPattern(pattern: Token[], str: Token[]): MatchResult {
  let found: MatchResult | null = null;
  for (let i = 0; i < str.length; ) {
    const match = patternMatch(pattern, str, i);
    if (match !== null) {
      if (found !== null) {
        console.error(
          "Duplicate replacement; ignoring it, but this might be a bug"
        );
        break;
      }
      found = match;
      i += match.length;
    } else {
      i++;
    }
  }
  if (found === null) runtimeError("Replacement not found");
  return found;
}

/** Return null if not matching, or a MatchResult if found. */
function patternMatch(
  pattern: Token[],
  str: Token[],
  startIndex: number
): MatchResult | null {
  const captured = new Map<string, Token>();
  let patternIndex = 0;
  let strIndex = startIndex;
  while (patternIndex < pattern.length) {
    const expectedToken = pattern[patternIndex];
    const foundToken = str[strIndex];
    if (foundToken === undefined) return null;
    if (isIgnoredWhitespace(expectedToken)) {
      patternIndex++;
      continue;
    }
    // ignore whitespace, except at the start of a match
    if (isIgnoredWhitespace(foundToken) && patternIndex > 0) {
      strIndex++;
      continue;
    }
    if (expectedToken.type !== foundToken.type) return null;
    if (
      expectedToken.type === "IdentifierName" &&
      expectedToken.value.startsWith("$")
    ) {
      const currValue = captured.get(expectedToken.value);
      if (currValue === undefined)
        captured.set(expectedToken.value, foundToken);
      else if (foundToken.value !== currValue.value)
        throw new Error(
          "Pattern error: Same $idPattern matches two different tokens"
        );
    } else if (expectedToken.value !== foundToken.value) return null;
    patternIndex++;
    strIndex++;
  }
  return {
    capturedIds: captured,
    startIndex,
    length: strIndex - startIndex,
  };
}

/** Is this token ignored for the purpose of matching? */
function isIgnoredWhitespace(token: Token) {
  return token.type === "WhiteSpace" || token.type === "LineTerminatorSequence";
}
