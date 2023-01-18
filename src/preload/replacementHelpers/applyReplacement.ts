import { ReplacementError } from "./errors";
import { Command, Block } from "./parse";
import { PatternToken, patternTokens } from "./tokenize";
import jsTokens, { Token } from "js-tokens";

export function applyReplacements(repls: Block[], file: string): string {
  return applyStringReplacements(repls, Array.from(jsTokens(file)))
    .map((t) => t.value)
    .join("");
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
  /** A set of invalidated names: invalidated by replacing a range including
   * them. At all times, the map must not have any invalidated keys */
  private readonly invalidated = new Set<string>();

  constructor(public str: Token[]) {}

  keyInvalidated(key: string): boolean {
    return this.invalidated.has(symbolName(key));
  }

  has(key: string): boolean {
    return this.map.has(symbolName(key));
  }

  uncheckedSet(key: string, value: Range) {
    key = symbolName(key);
    if (key === "") return;
    return this.map.set(key, value);
  }

  get(key: string): Range | undefined {
    return this.map.get(symbolName(key));
  }

  /** set but checking for duplicate bindings */
  set(key: string, value: Range) {
    if (this.has(key)) throw new ReplacementError(`Duplicate binding: ${key}`);
    if (this.keyInvalidated(key))
      throw new ReplacementError(
        `Key ${key} already invalidated from a previous replacement`
      );
    this.uncheckedSet(key, value);
    return this;
  }

  /** Mutate this in place by prefixing all names */
  prefix(p: string) {
    const entries = [...this.map.entries()];
    this.map.clear();
    for (const [k, v] of entries) {
      this.map.set(p + k, v);
    }
    const s = [...this.invalidated.entries()];
    this.invalidated.clear();
    for (const [k] of s) this.invalidated.add(k);
    return this;
  }

  /** Mutate this in place by grabbing all of other's entries */
  merge(other: SymbolTable) {
    for (const [key, value] of other.map.entries()) this.set(key, value);
    for (const key of other.invalidated) this.invalidated.add(key);
  }

  /** get but throws an error if not found */
  getRequired(key: string) {
    const got = this.get(key);
    if (got === undefined) {
      const hint = this.keyInvalidated(symbolName(key))
        ? ". It has been removed in a previous *replace*."
        : "";
      throw new ReplacementError(`Binding not found: ${key}` + hint);
    }
    return got;
  }

  /** get but give the underlying token array */
  getSlice(key: string): Token[] {
    const range = this.getRequired(key);
    return this.str.slice(range.start, range.start + range.length);
  }
}

function getSymbols(commands: Command[], str: Token[]): SymbolTable {
  const table = new SymbolTable(str);
  for (const command of commands) {
    switch (command.command) {
      case "find": {
        if (command.args.length > 1)
          throw new ReplacementError(
            `*find* command must have either 0 or 1 arguments. You passed ${command.args.length}`
          );
        if (command.patternArg === undefined)
          throw new ReplacementError(
            `*find* command missing a pattern argument.`
          );
        const inside = command.args[0]
          ? table.getRequired(command.args[0])
          : { start: 0, length: table.str.length };
        const found = findPattern(
          command.patternArg,
          table.str,
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
      case "find_surrounding_template": {
        if (command.args.length > 1)
          throw new ReplacementError(
            `*find_surrounding_template* command must exactly 1 argument. You passed ${command.args.length}`
          );
        if (command.patternArg !== undefined)
          throw new ReplacementError(
            `*find_surrounding_template* should not have a pattern argument.`
          );
        if (command.returns === undefined)
          throw new ReplacementError(
            `*find_surrounding_template* must have return value specified`
          );
        const around = table.getRequired(command.args[0]);
        const ts = findTemplateStartBefore(table, around.start);
        const found = findPattern(
          patternTokens(".template=function(){__return__}"),
          table.str,
          { start: ts, length: table.str.length - ts - 1 },
          true
        );
        table.set(command.returns, {
          start: found.startIndex,
          length: found.length,
        });
        break;
      }
      case "replace":
        throw new ReplacementError(
          "Programming Error: *replace* where it shouldn't be"
        );
    }
  }
  return table;
}

/** Apply replacement to `str`, and returned the changed value */
function applyStringReplacements(repls: Block[], str: Token[]): Token[] {
  const idTable = new Map<Block, string>(
    repls.map((r) => [r, r.heading + "_" + Math.random().toString() + "_"])
  );
  const table = new SymbolTable(str);
  for (const r of repls) {
    const prefix = idTable.get(r)!;
    table.merge(getSymbols(r.commands, str).prefix(prefix));
  }
  const finalRepls = repls.flatMap((r) => {
    const prefix = idTable.get(r)!;
    return r.replaceCommands.map((command) => {
      if (command.command !== "replace")
        throw new ReplacementError(
          "Programming error: replaceCommand is not *replace*"
        );
      if (command.args.length !== 1)
        throw new ReplacementError(
          `*replace* command must have exactly 1 argument. You passed ${command.args.length}`
        );
      if (command.patternArg === undefined)
        throw new ReplacementError(
          `*replace* command missing a pattern argument.`
        );
      const res: Replacement = {
        heading: r.heading,
        from: table.getRequired(prefix + command.args[0]),
        to: command.patternArg.flatMap((token) => {
          if (
            token.type === "PatternBalanced" ||
            token.type === "PatternIdentifier"
          ) {
            return table.getSlice(prefix + token.value);
          } else return token;
        }),
      };
      return res;
    });
  });

  return Array.from(withReplacements(table.str, finalRepls));
}

function* withReplacements(tokens: readonly Token[], repls: Replacement[]) {
  repls.sort((a, b) => a.from.start - b.from.start);
  repls.forEach((e, i) => {
    if (i > 0 && e.from.start + e.from.length <= repls[i - 1].from.start)
      throw new Error(
        `Overlapping replacements: "${repls[i - 1].heading}" and "${e.heading}"`
      );
  });
  let start = 0;
  for (const { from, to } of repls) {
    yield* tokens.slice(start, from.start);
    yield* to;
    start = from.start + from.length;
  }
  yield* tokens.slice(start);
}

interface Replacement {
  heading: string;
  from: Range;
  to: Token[];
}

interface MatchResult {
  newBindings: SymbolTable;
  startIndex: number;
  length: number;
}

function findTemplateStartBefore(table: SymbolTable, before: number) {
  for (let i = before; i > 0; i--) {
    if (
      tokensEqual(table.str[i], {
        type: "IdentifierName",
        value: "template",
      }) &&
      tokensEqual(table.str[i + 1], { type: "Punctuator", value: "=" }) &&
      tokensEqual(table.str[i - 1], { type: "Punctuator", value: "." })
    )
      return i - 1;
  }
  throw new ReplacementError(`Template not found before index ${before}`);
}

function findPattern(
  pattern: PatternToken[],
  str: Token[],
  inside: Range,
  allowDuplicates: boolean
): MatchResult {
  const fullPattern = pattern;
  // filter whitespace out of pattern
  pattern = pattern.filter((token) => !isIgnoredWhitespace(token));
  // find a forced token; used to optimize the search a little
  const fixedToken = pattern.find(
    (x) => !x.type.startsWith("Pattern")
  ) as Token;
  if (fixedToken === undefined)
    throw new Error("Pattern Error: No fixed token found");
  const fixedTokenIdx = pattern.indexOf(fixedToken);
  if (pattern.slice(0, fixedTokenIdx).some((x) => x.type === "PatternBalanced"))
    throw new Error("First fixed token is after a variable-width span.");

  // search time!
  let found: MatchResult | null = null;
  const end = inside.start + inside.length - pattern.length;
  for (let i = inside.start; i < end; ) {
    if (!tokensEqual(str[i + fixedTokenIdx], fixedToken)) {
      i++;
      continue;
    }
    const match =
      patternMatch(pattern, str, i, inside, false) !== null
        ? patternMatch(pattern, str, i, inside, true)
        : null;
    if (match !== null) {
      if (allowDuplicates) return match;
      if (found !== null) throw new ReplacementError("Duplicate pattern match");
      found = match;
      i += match.length;
    } else {
      i++;
    }
  }
  if (found === null)
    throw new ReplacementError(
      `Pattern not found: ${fullPattern.map((v) => v.value).join("")}`
    );
  return found;
}

function patternMatch(
  pattern: PatternToken[],
  str: Token[],
  startIndex: number,
  inside: Range,
  doTable: true
): MatchResult | null;
function patternMatch(
  pattern: PatternToken[],
  str: Token[],
  startIndex: number,
  inside: Range,
  doTable: false
): true | null;
function patternMatch(
  pattern: PatternToken[],
  str: Token[],
  startIndex: number,
  inside: Range,
  doTable: boolean
): MatchResult | true | null {
  let table: SymbolTable | null = null;
  if (doTable) table = new SymbolTable(str);
  let patternIndex = 0;
  let strIndex = startIndex;
  while (patternIndex < pattern.length) {
    let expectedToken = pattern[patternIndex];
    // If a pattern identifier appears twice, then use the old value
    // e.g. `$DCGView.createElement('div', {class: $DCGView.const`
    if (
      doTable &&
      expectedToken.type === "PatternIdentifier" &&
      table!.has(expectedToken.value)
    ) {
      const currValue = table!.getSlice(expectedToken.value);
      if (currValue.length !== 1 || currValue[0].type !== "IdentifierName")
        throw new ReplacementError(
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
      const closeBraces = new Set([")", "]", "}"]);
      const openBraces = new Set(["(", "[", "{"]);
      // Scan right, keeping track of nested depth
      let depth = 1;
      let currIndex = strIndex - 1;
      while (depth > 0) {
        currIndex++;
        const curr = str[currIndex].value;
        if (closeBraces.has(curr)) depth--;
        else if (openBraces.has(curr)) depth++;
      }
      // done scanning: currIndex points to a close brace in `str`
      if (doTable)
        table!.set(expectedToken.value, {
          start: strIndex,
          length: currIndex - strIndex,
        });
      // while loop stops when currIndex points to the matching close brace
      // but patternIndex points to the <balanced> before it, so subtract 1
      strIndex = currIndex - 1;
    } else if (expectedToken.type === "PatternIdentifier") {
      if (foundToken.type !== "IdentifierName") return null;
      if (doTable)
        table!.set(expectedToken.value, { start: strIndex, length: 1 });
    } else if (!tokensEqual(expectedToken, foundToken)) {
      return null;
    }
    patternIndex++;
    strIndex++;
    if (strIndex > inside.start + inside.length) return null;
  }
  if (doTable)
    return {
      newBindings: table!,
      startIndex,
      length: strIndex - startIndex,
    };
  else return true;
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
