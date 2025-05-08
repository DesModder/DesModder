import { ReplacementError } from "./errors";
import { Command, Block } from "./parse";
import { PatternToken, patternTokens } from "./tokenize";
import jsTokens, { Token } from "js-tokens";

interface ReplacementResult {
  successful: Set<Block>;
  /** Map from `Block` to `string` error message. */
  failed: Map<Block, string>;
  value: string;
}

export interface FullReplacementResult {
  newCode: string;
  blockFailures: [block: Block, errorMsg: string][];
  otherErrors: string[];
}

export function fullReplacement(
  calcDesktop: string,
  enabledReplacements: Block[]
): FullReplacementResult {
  const tokens = Array.from(jsTokens(calcDesktop));
  const sharedModuleTokens = tokens.filter(
    (x) =>
      x.type === "StringLiteral" &&
      x.value.length > 200000 &&
      // JS is sure to have &&. Protects against translations getting longer
      // than the length cutoff, which is intentionally low in case of huge
      // improvements in minification.
      x.value.includes("&&")
  );
  let workerResult: ReplacementResult;
  const otherErrors = [];
  if (sharedModuleTokens.length !== 1) {
    otherErrors.push(
      "More than one large JS string found, which is the shared module?"
    );
    // no-op
    workerResult = {
      successful: new Set(),
      failed: new Map(
        enabledReplacements.map(
          (b) =>
            [b, `Not reached: ${b.heading}. Maybe no worker builder?`] as const
        )
      ),
      value: calcDesktop,
    };
  } else {
    const [sharedModuleToken] = sharedModuleTokens;
    workerResult = applyReplacements(
      enabledReplacements.filter((x) => x.workerOnly),
      // JSON.parse doesn't work because this is a single-quoted string.
      // js-tokens tokenized this as a string anyway, so it should be
      // safely eval'able to a string.
      // eslint-disable-next-line no-eval
      (0, eval)(sharedModuleToken.value) as string
    );
    sharedModuleToken.value = JSON.stringify(workerResult.value);
  }
  const wbTokenHead = tokens.find(
    (x) =>
      x.type === "NoSubstitutionTemplate" &&
      x.value.includes("const __dcg_worker_module__ =")
  );
  const wbTokenTail = tokens.find(
    (x) =>
      x.type === "TemplateTail" &&
      x.value.includes(
        "__dcg_worker_module__(__dcg_worker_shared_module_exports__);"
      )
  );
  if (wbTokenTail === undefined || wbTokenHead === undefined) {
    otherErrors.push("Failed to find valid worker builder.");
  } else {
    wbTokenHead.value =
      // eslint-disable-next-line no-template-curly-in-string
      "`function loadDesModderWorker(){${window.dsm_workerAppend}}" +
      wbTokenHead.value.slice(1);
    wbTokenTail.value =
      wbTokenTail.value.slice(0, -1) + "\n loadDesModderWorker();`";
  }
  const srcWithWorkerAppend = tokens.map((x) => x.value).join("");
  const mainResult = applyReplacements(
    enabledReplacements.filter((x) => !x.workerOnly),
    srcWithWorkerAppend
  );
  const blockFailures = [...workerResult.failed].concat([...mainResult.failed]);

  return {
    newCode: mainResult.value,
    blockFailures,
    otherErrors,
  };
}

/** Apply a list of replacements to a source file. The main return is the .value,
 * We keep track of .failed and .successful */
function applyReplacements(repls: Block[], file: string): ReplacementResult {
  const replaced = applyStringReplacements(repls, Array.from(jsTokens(file)));
  return { ...replaced, value: replaced.value.map((t) => t.value).join("") };
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

  constructor(public str: Token[]) {}

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
    return this;
  }

  /** Mutate this in place by grabbing all of other's entries */
  merge(other: SymbolTable) {
    for (const [key, value] of other.map.entries()) this.set(key, value);
  }

  /** get but throws an error if not found */
  getRequired(key: string) {
    const got = this.get(key);
    if (got === undefined)
      throw new ReplacementError(`Binding not found: ${key}`);
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
        const found = findPattern(command.patternArg, table.str, inside, {
          allowDuplicates: false,
          table,
        });
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
          patternTokens("template() {__return__}", ""),
          table.str,
          { start: ts, length: table.str.length - ts - 1 },
          { allowDuplicates: true, table: new SymbolTable(str) }
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
function applyStringReplacements(
  repls: Block[],
  str: Token[]
): {
  successful: Set<Block>;
  failed: Map<Block, string>;
  value: Token[];
} {
  const idTable = new Map<Block, string>();
  function getPrefix(r: Block): string {
    if (!idTable.has(r))
      idTable.set(r, r.heading + "_" + Math.random().toString() + "_");
    return idTable.get(r)!;
  }

  const blockSucceededSymbols = new Set<Block>();
  const blockFailedSymbols = new Map<Block, string>();
  const failBlock = (b: Block, e: any) => {
    const msg = e instanceof Error ? e.message : JSON.stringify(e);
    blockFailedSymbols.set(b, msg);
  };

  const table = new SymbolTable(str);
  function applySymbolsForTable(r: Block) {
    try {
      const prefix = getPrefix(r);
      table.merge(getSymbols(r.commands, str).prefix(prefix));
      blockSucceededSymbols.add(r);
    } catch (e) {
      if (r.alternative !== undefined) applySymbolsForTable(r.alternative);
      else failBlock(r, e);
    }
  }

  for (const r of repls) {
    applySymbolsForTable(r);
  }

  function getReplacement(r: Block): Replacement[] {
    if (!blockSucceededSymbols.has(r)) {
      if (r.alternative) return getReplacement(r.alternative);
      else return [];
    }
    try {
      return blockReplacements(r, getPrefix, table);
    } catch (e) {
      if (r.alternative !== undefined) return getReplacement(r.alternative);
      else failBlock(r, e);
      return [];
    }
  }
  const finalRepls = repls.flatMap(getReplacement);

  return {
    successful: blockSucceededSymbols,
    failed: blockFailedSymbols,
    value: Array.from(withReplacements(table.str, finalRepls)),
  };
}

function blockReplacements(
  r: Block,
  getPrefix: (r: Block) => string,
  table: SymbolTable
): Replacement[] {
  const prefix = getPrefix(r);
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
    // skipFirst = this is just an append
    const skipFirst =
      (command.patternArg[0].type === "PatternBalanced" ||
        command.patternArg[0].type === "PatternIdentifier" ||
        command.patternArg[0].type === "PatternIdentifierDot") &&
      symbolName(command.patternArg[0].value) === symbolName(command.args[0]);
    const from = table.getRequired(prefix + command.args[0]);
    const res: Replacement = {
      heading: r.heading,
      from: skipFirst ? { start: from.start + from.length, length: 0 } : from,
      to: command.patternArg.slice(skipFirst ? 1 : 0).flatMap((token) => {
        if (
          token.type === "PatternBalanced" ||
          token.type === "PatternIdentifier" ||
          token.type === "PatternIdentifierDot"
        ) {
          return table.getSlice(prefix + token.value);
        } else return token;
      }),
    };
    return res;
  });
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
      })
    )
      return i - 1;
  }
  throw new ReplacementError(`Template not found before index ${before}`);
}

function findPattern(
  pattern: PatternToken[],
  str: Token[],
  inside: Range,
  { allowDuplicates, table }: { allowDuplicates: boolean; table: SymbolTable }
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
      patternMatch(pattern, str, i, inside, table, false) !== null
        ? patternMatch(pattern, str, i, inside, table, true)
        : null;
    if (match !== null) {
      if (allowDuplicates) return match;
      if (found !== null)
        throw new ReplacementError(
          `Duplicate pattern match at ${match.startIndex} with length ${match.length}: \n` +
            str
              .slice(match.startIndex, match.startIndex + match.length)
              .map((v) => v.value)
              .join("")
        );
      found = match;
      i += match.length;
    } else {
      i++;
    }
  }
  if (found === null) {
    const s = inside.start;
    const len = inside.length;
    throw new Error(
      `Pattern not found: ${fullPattern.map((v) => v.value).join("")} ` +
        `in {start: ${s}, length: ${len}}\n` +
        str
          .slice(s, s + 20)
          .concat({ value: " … " } as any)
          .concat(str.slice(s + len - 20, s + len))
          .filter((v) => v.type !== "MultiLineComment")
          .map((v) => (v.value.length < 100 ? v.value : "[long token]"))
          .join("")
          .replace(/\n{2,}/g, "\n")
    );
  }
  return found;
}

const DOT: Token = { type: "Punctuator", value: "." };

class PatternQueue {
  /** We yield from index 0 onwards in the pattern, indexed by patternIndex. */
  private readonly pattern: PatternToken[];
  /** patternIndex points to the next entry yielded. */
  private patternIndex: number = 0;
  /** We pop from the end of the stack and should never add to it when nonempty. */
  private bonusStack: Token[] = [];

  constructor(pattern: PatternToken[]) {
    this.pattern = pattern;
  }

  next(): PatternToken | undefined {
    if (this.bonusStack.length) return this.bonusStack.pop();
    const ret = this.pattern[this.patternIndex];
    this.patternIndex++;
    return ret;
  }

  queueTokens(tokens: Token[]) {
    if (this.bonusStack.length) {
      // This will never be reached because the bonus stack doesn't have any
      // patterns on it, so it cannot do any backreference table lookups.
      throw new Error("Cannot queue more tokens when some are already queued.");
    }
    this.bonusStack = [...tokens].reverse();
  }

  isAtStart() {
    return this.patternIndex === 0;
  }
}

function patternMatch(
  pattern: PatternToken[],
  str: Token[],
  startIndex: number,
  inside: Range,
  outerTable: SymbolTable,
  doTable: true
): MatchResult | null;
function patternMatch(
  pattern: PatternToken[],
  str: Token[],
  startIndex: number,
  inside: Range,
  outerTable: SymbolTable,
  doTable: false
): true | null;
function patternMatch(
  pattern: PatternToken[],
  str: Token[],
  startIndex: number,
  inside: Range,
  outerTable: SymbolTable,
  /**
   * doTable is a performance optimization added in
   * https://github.com/DesModder/DesModder/pull/482/commits/9e3cd674a1911f15cd5fe4cacabe978accc0d43a.
   * It saves about 500ms on a 3000ms fullReplacementCached run, by not
   * touching the SymbolTable at all unless the pattern matches when treating
   * the PatternIdentifiers as globs. We run once with doTable=false
   * then only run doTable=true if that passes. I'm somewhat surprised it's that
   * significant of a gain though.
   */
  doTable: boolean
): MatchResult | true | null {
  let table: SymbolTable | null = null;
  if (doTable) table = new SymbolTable(str);
  let strIndex = startIndex;
  const patternQueue = new PatternQueue(pattern);
  let expectedToken = patternQueue.next();
  while (expectedToken !== undefined) {
    if (
      (expectedToken.type === "PatternIdentifier" ||
        expectedToken.type === "PatternIdentifierDot") &&
      outerTable.has(expectedToken.value)
    ) {
      // A previous *Find* block matched this pattern identifier, so use that instead.
      const currValue = outerTable.getSlice(expectedToken.value);
      patternQueue.queueTokens(currValue);
      expectedToken = patternQueue.next();
      continue;
    }
    if (
      doTable &&
      (expectedToken.type === "PatternIdentifierDot" ||
        expectedToken.type === "PatternIdentifier") &&
      table!.has(expectedToken.value)
    ) {
      // A pattern identifier appears twice, then use the old value
      // e.g. `{ class: $$const("dcg-popover-interior"), role: $$const("region") }`
      const currValue = table!.getSlice(expectedToken.value);
      patternQueue.queueTokens(currValue);
      expectedToken = patternQueue.next();
      continue;
    }
    const foundToken = str[strIndex];
    if (foundToken === undefined) return null;
    // whitespace is already filtered out of pattern
    // ignore whitespace in str, except at the start of a match
    if (isIgnoredWhitespace(foundToken) && !patternQueue.isAtStart()) {
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
    } else if (expectedToken.type === "PatternIdentifierDot") {
      if (foundToken.type !== "IdentifierName") return null;
      const startStrIndex = strIndex;
      // Enter loop with strIndex pointing to an identifier.
      while (
        str[strIndex + 1] &&
        tokensEqual(str[strIndex + 1], DOT) &&
        str[strIndex + 2]
      ) {
        strIndex += 2;
        if (foundToken.type !== "IdentifierName") return null;
      }
      if (doTable)
        table!.set(expectedToken.value, {
          start: startStrIndex,
          length: strIndex - startStrIndex + 1,
        });
    } else if (!tokensEqual(expectedToken, foundToken)) {
      return null;
    }
    expectedToken = patternQueue.next();
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
