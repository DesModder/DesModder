import { syntaxError, runtimeError } from "./errors";
import { ReplacementRule } from "./parse";
import { PatternToken } from "./tokenize";
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
        const found = findPattern(command.code, str, table);
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
  to: PatternToken[],
  table: SymbolTable
) {
  str.splice(
    range.start,
    range.length,
    ...to.flatMap((token) => {
      if (token.type === "PatternBalanced") {
        const range = table.ranges.get(token.value);
        if (range === undefined)
          throw new Error(
            `Programming error: range ${token.value} in "to" not found in "from"`
          );
        return str.slice(range.start, range.start + range.length);
      } else if (token.type === "PatternIdentifier") {
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

function findPattern(
  pattern: PatternToken[],
  str: Token[],
  table: SymbolTable
): MatchResult {
  let found: MatchResult | null = null;
  for (let i = 0; i < str.length; ) {
    const match = patternMatch(pattern, str, i, table);
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
  if (found === null) runtimeError("Pattern not found");
  return found;
}

/** Return null if not matching, or a MatchResult if found. */
function patternMatch(
  pattern: PatternToken[],
  str: Token[],
  startIndex: number,
  table: SymbolTable
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
    if (expectedToken.type === "PatternBalanced") {
      const prev = pattern[patternIndex - 1].value;
      const next = pattern[patternIndex + 1].value;
      if (!balanced.has(prev) || balanced.get(prev) !== next)
        syntaxError(
          `Balanced ${expectedToken.value} must be inside balanced braces`
        );
      // Gobble up tokens while matching
      const punctStack = [prev];
      let currIndex = strIndex;
      while (punctStack.length > 0) {
        currIndex++;
        const curr = str[currIndex].value;
        if (curr === balanced.get(punctStack[punctStack.length - 1]))
          punctStack.pop();
        else if (balanced.has(curr)) punctStack.push(curr);
      }
      table.ranges.set(expectedToken.value, {
        start: strIndex,
        length: currIndex - strIndex,
      });
      // while loop stops when currIndex points to the matching close brace
      // but patternIndex points to the <balanced> before it, so subtract 1
      strIndex = currIndex - 1;
    } else if (expectedToken.type === "PatternIdentifier") {
      if (foundToken.type !== "IdentifierName") return null;
      const currValue = captured.get(expectedToken.value);
      if (currValue === undefined)
        captured.set(expectedToken.value, foundToken);
      else if (foundToken.value !== currValue.value)
        throw new Error(
          "Pattern error: Same $idPattern matches two different tokens"
        );
    } else if (
      expectedToken.type !== foundToken.type ||
      expectedToken.value !== foundToken.value
    ) {
      return null;
    }
    patternIndex++;
    strIndex++;
  }
  return {
    capturedIds: captured,
    startIndex,
    length: strIndex - startIndex,
  };
}

const balanced = new Map([
  ["(", ")"],
  ["[", "]"],
  ["{", "}"],
]);

/** Is this token ignored for the purpose of matching? */
function isIgnoredWhitespace(token: PatternToken) {
  return token.type === "WhiteSpace" || token.type === "LineTerminatorSequence";
}
