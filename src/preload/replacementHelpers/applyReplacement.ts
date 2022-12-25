import { ReplacementError, tryWithErrorContext } from "./errors";
import { Block, Command, ModuleBlock } from "./parse";
import { PatternToken } from "./tokenize";
import jsTokens, { Token } from "js-tokens";

export function tryApplyReplacement(
  r: ModuleBlock,
  def: string,
  allBlocks: Block[],
  moduleName: string
): string {
  try {
    return tryWithErrorContext(
      () => applyReplacement(r, def, allBlocks),
      { message: `replacement "${r.heading}"`, filename: r.filename },
      { message: `module replacement`, filename: `${moduleName}` }
    );
  } catch (e) {
    // Trick: get the pretty console output as if this was uncaught, but do
    // not stop execution
    setTimeout(() => {
      throw e;
    }, 0);
    return def;
  }
}

export function applyReplacement(
  replacement: ModuleBlock,
  fn: string,
  allBlocks: Block[]
): string {
  return applyStringReplacement(
    replacement,
    Array.from(jsTokens(fn.toString())),
    allBlocks
  )
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

  /** Replace range `from` with tokens `to`, removing all symbols for ranges
   * contained inside `from` and shifting all symbols after `from`.
   * Modifies `this.str`. */
  replaceRange(from: Range, to: Token[]) {
    this.str = structuredClone(this.str);
    this.str.splice(from.start, from.length, ...to);
    // invalidate overlapping names
    for (const [name, range] of this.map.entries()) {
      if (range.start >= from.start + from.length) {
        // the range is after the `from` range; offset it
        this.uncheckedSet(name, {
          start: range.start + to.length - from.length,
          length: range.length,
        });
      } else if (range.start + range.length < from.start) {
        // the range is before the `from` range; change nothing
      } else {
        // the range overlaps somehow with the `from` range.
        this.map.delete(name);
        this.invalidated.add(name);
      }
    }
  }
}

function getSymbols(
  commands: Command[],
  args: SymbolTable,
  allBlocks: Block[]
): SymbolTable {
  const table = new SymbolTable(args.str);
  table.merge(args);
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
      case "replace":
        throw new ReplacementError(
          "Programming Error: *replace* where it shouldn't be"
        );
      default: {
        // user-defined command (not builtin)
        const block = allBlocks.find(
          (x) => x.tag === "DefineBlock" && x.commandName === command.command
        );
        if (block === undefined)
          throw new ReplacementError(`Command not defined: ${command.command}`);
        const argTable = new SymbolTable(table.str);
        for (let i = 0; i < command.args.length; i++) {
          argTable.set(`arg${i + 1}`, table.getRequired(command.args[i]));
        }
        const symb = tryWithErrorContext(
          () => getSymbols(block.commands, argTable, allBlocks),
          { message: `command *${command.command}*`, filename: block.filename }
        );
        const returned = symb.get("return");
        if (returned === undefined)
          throw new ReplacementError(
            `Command *${command.command}* doesn't return anything, so it is useless`
          );
        if (command.returns === undefined)
          throw new ReplacementError(
            `Usage of command *${command.command}* doesn't use return value, so it is useless`
          );
        table.set(command.returns, returned);
      }
    }
  }
  return table;
}

/** Apply replacement to `str`, and returned the changed value */
function applyStringReplacement(
  replacement: ModuleBlock,
  str: Token[],
  allBlocks: Block[]
): Token[] {
  const table = getSymbols(
    replacement.commands,
    new SymbolTable(str),
    allBlocks
  );
  for (const command of replacement.replaceCommands) {
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
    table.replaceRange(
      table.getRequired(command.args[0]),
      command.patternArg.flatMap((token) => {
        if (
          token.type === "PatternBalanced" ||
          token.type === "PatternIdentifier"
        ) {
          return table.getSlice(token.value);
        } else return token;
      })
    );
  }
  return table.str;
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
      if (found !== null) throw new ReplacementError("Duplicate pattern match");
      found = match;
      i += match.length;
    } else {
      i++;
    }
  }
  if (found === null)
    throw new ReplacementError(
      `Pattern not found: ${pattern.map((v) => v.value).join("")}`
    );
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
