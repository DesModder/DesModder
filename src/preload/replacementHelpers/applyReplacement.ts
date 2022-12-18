import { syntaxError, runtimeError } from "./errors";
import { ModuleBlock } from "./parse";
import { PatternToken } from "./tokenize";
import jsTokens, { Token } from "js-tokens";

export default function applyReplacement(
  replacement: ModuleBlock,
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

function symbolName(str: string) {
  return str.trim().replace(/[_$]/g, "");
}

class SymbolTable {
  private readonly map = new Map<string, Range>();

  constructor(private readonly str: Token[]) {}

  has(key: string) {
    return this.map.has(symbolName(key));
  }

  uncheckedSet(key: string, value: Range) {
    key = symbolName(key);
    if (key === "") return;
    return this.map.set(key, value);
  }

  get(key: string) {
    return this.map.get(symbolName(key));
  }

  /** set but checking for duplicate bindings */
  set(key: string, value: Range) {
    if (this.has(key)) runtimeError(`Duplicate binding: ${key}`);
    this.uncheckedSet(key, value);
    return this;
  }

  /** Mutate this in place by grabbing all of other's entries */
  merge(other: SymbolTable) {
    for (const [key, value] of other.map.entries()) this.set(key, value);
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
  replacement: ModuleBlock,
  str: Token[]
): Token[] {
  const table = new SymbolTable(str);
  let didReplace = false;
  for (const command of replacement.commands) {
    if (didReplace)
      runtimeError("Command after a *replace* command; not allowed");
    switch (command.command) {
      case "find": {
        if (command.args.length > 1)
          runtimeError(
            `*find* command must have either 0 or 1 arguments. You passed ${command.args.length}`
          );
        if (command.patternArg === undefined)
          runtimeError(`*find* command missing a pattern argument.`);
        const inside = command.args[0]
          ? table.getRequired(command.args[0])
          : { start: 0, length: str.length };
        const found = findPattern(
          command.patternArg,
          str,
          inside,
          // if the first arg is blank, duplicates are allowed
          command.returns === undefined || symbolName(command.returns) === ""
        );
        table.merge(found.newBindings);
        if (command.returns)
          table.set(command.returns, {
            start: found.startIndex,
            length: found.length,
          });
        break;
      }
      case "replace":
        if (command.args.length !== 1)
          runtimeError(
            `*replace* command must have exactly 1 argument. You passed ${command.args.length}`
          );
        if (command.patternArg === undefined)
          runtimeError(`*replace* command missing a pattern argument.`);
        str = replaceRange(
          str,
          table.getRequired(command.args[0]),
          command.patternArg,
          table
        );
        didReplace = true;
        break;
      default: {
        // user-defined command
        // TODO
      }
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

function findPattern(
  pattern: PatternToken[],
  str: Token[],
  inside: Range,
  allowDuplicates: boolean
): MatchResult {
  // filter whitespace out of pattern
  pattern = pattern.filter((token) => !isIgnoredWhitespace(token));
  let found: MatchResult | null = null;
  for (let i = inside.start; i < inside.start + inside.length; ) {
    const match = patternMatch(pattern, str, i, inside);
    if (match !== null) {
      if (allowDuplicates) return match;
      if (found !== null) runtimeError("Duplicate pattern match");
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
  inside: Range
): MatchResult | null {
  const table = new SymbolTable(str);
  let patternIndex = 0;
  let strIndex = startIndex;
  while (patternIndex < pattern.length) {
    let expectedToken = pattern[patternIndex];
    // If a pattern identifier appears twice, then use the old value
    // e.g. `$DCGView.createElement('div', {class: $DCGView.const`
    if (
      expectedToken.type === "PatternIdentifier" &&
      table.has(expectedToken.value)
    ) {
      const currValue = table.getSlice(expectedToken.value);
      if (currValue.length !== 1 || currValue[0].type !== "IdentifierName")
        runtimeError(
          `Identifier pattern ${expectedToken.value} already bound to a non-identifier`
        );
      expectedToken = currValue[0];
    }
    const foundToken = str[strIndex];
    if (foundToken === undefined) return null;
    // whitespace is already filtered out of pattern
    // ignore whitespace in str, except at the start of a match
    if (isIgnoredWhitespace(foundToken) && patternIndex > 0) {
      strIndex++;
      continue;
    }
    if (expectedToken.type === "PatternBalanced") {
      const next = pattern[patternIndex + 1].value;
      const closeBraces = new Set([")", "]", "}"]);
      const openBraces = new Set(["(", "[", "{"]);
      if (!closeBraces.has(next))
        syntaxError(
          `Balanced ${expectedToken.value} must be immediately followed by a close brace`
        );
      // Scan right, keeping track of nested depth
      let depth = 1;
      let currIndex = strIndex;
      while (depth > 0) {
        currIndex++;
        const curr = str[currIndex].value;
        if (closeBraces.has(curr)) depth--;
        else if (openBraces.has(curr)) depth++;
      }
      // done scanning: currIndex points to a close brace in `str`
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
    } else if (!tokensEqual(expectedToken, foundToken)) {
      return null;
    }
    patternIndex++;
    strIndex++;
    if (strIndex > inside.start + inside.length) return null;
  }
  return {
    newBindings: table,
    startIndex,
    length: strIndex - startIndex,
  };
}

function tokensEqual(a: Token, b: Token) {
  if (a.type !== b.type) return false;
  else if (a.type === "StringLiteral") {
    return a.value.replace(/"/g, "'") === b.value.replace(/"/g, "'");
  } else {
    return a.value === b.value;
  }
}

/** Is this token ignored for the purpose of matching? */
function isIgnoredWhitespace(token: PatternToken) {
  return token.type === "WhiteSpace" || token.type === "LineTerminatorSequence";
}
