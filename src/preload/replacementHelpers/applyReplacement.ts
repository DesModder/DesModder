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

function sameIdentifier(a: Token, b: Token) {
  return (
    a.type === "IdentifierName" &&
    b.type === "IdentifierName" &&
    a.value === b.value
  );
}

class SymbolTable extends Map<string, Range> {
  constructor(private readonly str: Token[]) {
    super();
  }

  /** set overridden to prevent duplicate bindings */
  set(key: string, value: Range) {
    const curr = this.get(key);
    if (
      curr !== undefined &&
      // duplicate bindings are ok if both are equal identifiers
      !(
        curr.length === 1 &&
        value.length === 1 &&
        sameIdentifier(this.str[curr.start], this.str[value.start])
      )
    )
      runtimeError(`Duplicate binding: ${key}`);
    super.set(key, value);
    return this;
  }

  /** Mutate this in place by grabbing all of other's entries */
  merge(other: SymbolTable) {
    for (const [key, value] of other.entries()) this.set(key, value);
  }

  /** get but throws an error if not found */
  getRequired(key: string) {
    const got = this.get(key);
    if (got === undefined) runtimeError(`Binding not found: ${key}`);
    return got;
  }

  /** get but give the underlying token array */
  getSlice(key: string): Token[] {
    const range = this.getRequired(key);
    return this.str.slice(range.start, range.start + range.length);
  }
}

/** Apply replacement to `str`, and returned the changed value */
function applyStringReplacement(
  replacement: ReplacementRule,
  str: Token[]
): Token[] {
  const table = new SymbolTable(str);
  for (const command of replacement.commands) {
    switch (command.tag) {
      case "find": {
        const found = findPattern(command.code, str);
        table.merge(found.newBindings);
        table.set(command.arg, {
          start: found.startIndex,
          length: found.length,
        });
        break;
      }
      case "replace":
        str = replaceRange(
          str,
          table.getRequired(command.arg),
          command.code,
          table
        );
        break;
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
  str = structuredClone(str);
  str.splice(
    range.start,
    range.length,
    ...to.flatMap((token) => {
      if (
        token.type === "PatternBalanced" ||
        token.type === "PatternIdentifier"
      ) {
        return table.getSlice(token.value);
      } else return token;
    })
  );
  return str;
}

interface MatchResult {
  newBindings: SymbolTable;
  startIndex: number;
  length: number;
}

function findPattern(pattern: PatternToken[], str: Token[]): MatchResult {
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
  if (found === null) runtimeError("Pattern not found");
  return found;
}

/** Return null if not matching, or a MatchResult if found. */
function patternMatch(
  pattern: PatternToken[],
  str: Token[],
  startIndex: number
): MatchResult | null {
  const table = new SymbolTable(str);
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
      table.set(expectedToken.value, {
        start: strIndex,
        length: currIndex - strIndex,
      });
      // while loop stops when currIndex points to the matching close brace
      // but patternIndex points to the <balanced> before it, so subtract 1
      strIndex = currIndex - 1;
    } else if (expectedToken.type === "PatternIdentifier") {
      if (foundToken.type !== "IdentifierName") return null;
      table.set(expectedToken.value, { start: strIndex, length: 1 });
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
    newBindings: table,
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
