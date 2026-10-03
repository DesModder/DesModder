/**
 * Reads a Desmos inequality into a syntax tree, for the strict geometry
 * compiler.
 *
 * The flow visualizer's compiler (`latexToGLSL.ts`) goes straight from LaTeX to
 * GLSL, and that suits a picture: it guards every awkward operation so the
 * shader always has a number to draw, so `sqrt(max(a, 0))`, `log(max(a, 1e-12))`
 * and a division that never quite reaches zero. Those guards are wrong for a
 * solid. Where Desmos says a value is undefined, the visual compiler says 0, and
 * `y < sqrt(x)` would grow a wall along the whole negative x-axis that Desmos
 * never shades. A fluid has to see exactly the region Desmos draws, so obstacles
 * go through a tree that two back ends read: a CPU evaluator with Desmos's own
 * rules (`strictEvaluate.ts`) and a GLSL emitter that carries a validity flag
 * beside every value (`strictGLSL.ts`).
 *
 * The tokenizer is shared with the visual compiler, so the two can disagree
 * about what an expression means but never about what was typed.
 */

import {
  CompileError,
  tokenize,
  type FieldEnvironment,
  type FunctionDefinition,
  type Token,
} from "../latexToGLSL";

export type CompareOp = "<" | "<=" | ">" | ">=" | "=";

export type Expr =
  | { kind: "num"; value: number }
  /** A coordinate, the clock, a slider, or a parameter of a definition. */
  | { kind: "var"; name: string; role: VarRole }
  | { kind: "neg"; arg: Expr }
  | { kind: "bin"; op: "+" | "-" | "*" | "/"; a: Expr; b: Expr }
  | { kind: "pow"; base: Expr; exponent: Expr }
  | { kind: "call"; fn: BuiltinName; args: Expr[] }
  | { kind: "user"; name: string; args: Expr[] }
  | { kind: "piecewise"; branches: PiecewiseBranch[]; otherwise?: Expr };

export type VarRole = "x" | "y" | "time" | "param" | "local";

export interface PiecewiseBranch {
  condition: Chain;
  value: Expr;
}

/** `a < b ≤ c`: every link must hold. */
export interface Chain {
  terms: Expr[];
  ops: CompareOp[];
}

/** A top-level inequality: its chain, and the restrictions attached to it. */
export interface Relation {
  chain: Chain;
  /** Each restriction holds where any of its chains holds; all must hold. */
  restrictions: Chain[][];
}

export interface StrictProgram {
  relation: Relation;
  /** Definitions the relation calls, by name, already parsed. */
  functions: ReadonlyMap<string, ParsedFunction>;
  params: readonly string[];
  usesTime: boolean;
}

export interface ParsedFunction {
  params: readonly string[];
  body: Expr;
}

export type BuiltinName =
  | "sin"
  | "cos"
  | "tan"
  | "cot"
  | "sec"
  | "csc"
  | "arcsin"
  | "arccos"
  | "arctan"
  | "arccot"
  | "arcsec"
  | "arccsc"
  | "sinh"
  | "cosh"
  | "tanh"
  | "coth"
  | "sech"
  | "csch"
  | "arcsinh"
  | "arccosh"
  | "arctanh"
  | "exp"
  | "ln"
  | "log"
  /** `\log_{b}(a)`, with the base first. */
  | "logbase"
  | "sqrt"
  /** `\sqrt[n]{a}`, with the index first. */
  | "nthroot"
  | "abs"
  | "sign"
  | "floor"
  | "ceil"
  | "round"
  | "mod"
  | "min"
  | "max";

const BUILTIN_ARITY: Record<BuiltinName, readonly number[]> = {
  sin: [1],
  cos: [1],
  tan: [1],
  cot: [1],
  sec: [1],
  csc: [1],
  arcsin: [1],
  arccos: [1],
  arctan: [1, 2],
  arccot: [1],
  arcsec: [1],
  arccsc: [1],
  sinh: [1],
  cosh: [1],
  tanh: [1],
  coth: [1],
  sech: [1],
  csch: [1],
  arcsinh: [1],
  arccosh: [1],
  arctanh: [1],
  exp: [1],
  ln: [1],
  log: [1],
  logbase: [2],
  sqrt: [1],
  nthroot: [2],
  abs: [1],
  sign: [1],
  floor: [1],
  ceil: [1],
  round: [1],
  mod: [2],
  min: [1, 2, 3, 4, 5, 6, 7, 8],
  max: [1, 2, 3, 4, 5, 6, 7, 8],
};

const isBuiltin = (name: string): name is BuiltinName => name in BUILTIN_ARITY;

const MAX_DEFINITION_DEPTH = 12;

export type StrictParseResult =
  | { ok: true; program: StrictProgram }
  | { ok: false; error: string };

/** Parses one expression-list row as a region, or says why it is not one. */
export function parseStrictRelation(
  latex: string,
  env: FieldEnvironment
): StrictParseResult {
  try {
    const context = new Context(env);
    const { body, groups } = splitRestrictions(
      tokenize(rewriteLogBases(latex))
    );
    const relation = new Parser(body, context, new Set()).parseRelation();
    for (const group of groups) {
      relation.restrictions.push(
        new Parser(group, context, new Set()).parseRestrictionBody()
      );
    }
    return {
      ok: true,
      program: {
        relation,
        functions: context.functions,
        params: [...context.params],
        usesTime: context.usesTime,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof CompileError
          ? error.message
          : "Could not read this expression.",
    };
  }
}

export type StrictExpressionResult =
  | { ok: true; expr: Expr; program: StrictProgram }
  | { ok: false; error: string };

/**
 * Parses a plain expression, with no inequality. Obstacles never need this;
 * the semantics tests do, to evaluate `\sqrt{-1}` the way Desmos's own
 * evaluator would.
 */
export function parseStrictExpression(
  latex: string,
  env: FieldEnvironment
): StrictExpressionResult {
  try {
    const context = new Context(env);
    const parser = new Parser(
      tokenize(rewriteLogBases(latex)),
      context,
      new Set()
    );
    const expr = parser.parseExpression();
    parser.expectEnd();
    const empty: Relation = {
      chain: { terms: [expr], ops: [] },
      restrictions: [],
    };
    return {
      ok: true,
      expr,
      program: {
        relation: empty,
        functions: context.functions,
        params: [...context.params],
        usesTime: context.usesTime,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof CompileError
          ? error.message
          : "Could not read this expression.",
    };
  }
}

/**
 * Separates the restrictions at the end of an inequality from the inequality.
 *
 * Read as ordinary syntax, `x² + y² ≤ 4 {x > 0}` is `4 · {x > 0}`, an implicit
 * product with a piecewise that is 1 where x > 0 and undefined elsewhere. It
 * shades the same region, but it loses the wall: the left half becomes
 * undefined rather than fluid, and nothing marks x = 0 as the boundary. So a
 * trailing brace group is taken as a restriction when it follows a complete
 * term and holds nothing but conditions. Anything else, such as a group with a
 * value after a colon, stays the piecewise that the ordinary reading makes it.
 */
function splitRestrictions(tokens: readonly Token[]): {
  body: readonly Token[];
  groups: Token[][];
} {
  let end = tokens.length;
  const groups: Token[][] = [];
  while (end > 0 && tokens[end - 1].kind === "pieceClose") {
    let depth = 0;
    let start = -1;
    for (let i = end - 1; i >= 0; i--) {
      const { kind } = tokens[i];
      if (kind === "pieceClose") depth++;
      else if (kind === "pieceOpen" && --depth === 0) {
        start = i;
        break;
      }
    }
    if (start <= 0 || !endsTerm(tokens[start - 1])) break;
    const inner = tokens.slice(start + 1, end - 1);
    if (!isConditionList(inner)) break;
    groups.unshift(inner);
    end = start;
  }
  return { body: tokens.slice(0, end), groups };
}

function endsTerm(token: Token): boolean {
  return (
    token.kind === "number" ||
    token.kind === "variable" ||
    token.kind === "close" ||
    token.kind === "closeBrace" ||
    token.kind === "bar" ||
    token.kind === "pieceClose"
  );
}

/** Comma-separated parts, each with a comparison and no colon at its level. */
function isConditionList(tokens: readonly Token[]): boolean {
  if (tokens.length === 0) return false;
  let depth = 0;
  let hasComparison = false;
  for (const token of tokens) {
    switch (token.kind) {
      case "open":
      case "openBrace":
      case "openBracket":
      case "pieceOpen":
        depth++;
        break;
      case "close":
      case "closeBrace":
      case "closeBracket":
      case "pieceClose":
        depth--;
        break;
      case "cmp":
        if (depth === 0) hasComparison = true;
        break;
      case "colon":
        if (depth === 0) return false;
        break;
      case "comma":
        if (depth === 0) {
          if (!hasComparison) return false;
          hasComparison = false;
        }
        break;
      default:
        break;
    }
  }
  return hasComparison;
}

/**
 * `\log_{b}` as a two-argument call the shared tokenizer already reads.
 *
 * The tokenizer refuses `_` after a command, and teaching it subscripts would
 * change what the visual compiler accepts. Spelling the base as the first
 * braced group of an operator name keeps that tokenizer as it is.
 */
export function rewriteLogBases(latex: string): string {
  let out = "";
  let i = 0;
  for (;;) {
    const at = latex.indexOf("\\log_", i);
    if (at < 0) return out + latex.slice(i);
    out += latex.slice(i, at);
    let j = at + "\\log_".length;
    let base: string;
    if (latex[j] === "{") {
      let depth = 0;
      const start = j;
      for (; j < latex.length; j++) {
        if (latex[j] === "{") depth++;
        else if (latex[j] === "}" && --depth === 0) break;
      }
      if (depth !== 0) throw new CompileError("A log base is missing its }.");
      base = latex.slice(start + 1, j);
    } else {
      base = latex[j] ?? "";
    }
    out += `\\operatorname{logbase}{${base}}`;
    i = j + 1;
  }
}

class Context {
  readonly params = new Set<string>();
  usesTime = false;
  readonly functions = new Map<string, ParsedFunction>();
  private readonly expanding: string[] = [];

  constructor(readonly env: FieldEnvironment) {}

  declare(name: string, definition: FunctionDefinition) {
    if (this.functions.has(name)) return;
    if (this.expanding.includes(name)) {
      throw new CompileError(
        `"${name}" is defined in terms of itself, which has no value to draw.`
      );
    }
    if (this.expanding.length >= MAX_DEFINITION_DEPTH) {
      throw new CompileError(
        `Definitions starting at "${name}" nest more than ${MAX_DEFINITION_DEPTH} deep.`
      );
    }
    this.expanding.push(name);
    const parser = new Parser(
      tokenize(rewriteLogBases(definition.latex)),
      this,
      new Set(definition.params)
    );
    const body = parser.parseExpression();
    parser.expectEnd();
    this.expanding.pop();
    this.functions.set(name, { params: definition.params, body });
  }
}

class Parser {
  private index = 0;
  private barDepth = 0;

  constructor(
    private readonly tokens: readonly Token[],
    private readonly context: Context,
    private readonly locals: ReadonlySet<string>
  ) {}

  parseRelation(): Relation {
    if (!this.tokens.some((token) => token.kind === "cmp")) {
      throw new CompileError(
        "This is an expression, not a region. A solid needs an inequality, such as x^2+y^2 ≤ 1."
      );
    }
    const first = this.parseExpression();
    if (this.peek()?.kind !== "cmp") {
      throw new CompileError(
        "A restriction needs an inequality in front of it to restrict."
      );
    }
    const chain = this.parseChainFrom(first);
    if (chain.ops.includes("=")) {
      throw new CompileError(
        "An equation draws a curve, and a curve has no inside to be solid. Use < or ≤ to make a region."
      );
    }
    this.expectEnd();
    return { chain, restrictions: [] };
  }

  expectEnd() {
    if (this.index < this.tokens.length) {
      throw new CompileError("There is leftover input after the expression.");
    }
  }

  /**
   * The inside of `{c₁, c₂}` after an inequality, which `splitRestrictions`
   * has already checked holds only conditions.
   */
  parseRestrictionBody(): Chain[] {
    const chains: Chain[] = [];
    for (;;) {
      chains.push(this.parseChainFrom(this.parseExpression()));
      if (this.peek()?.kind !== "comma") break;
      this.index++;
    }
    this.expectEnd();
    return chains;
  }

  private parseChainFrom(first: Expr): Chain {
    const terms = [first];
    const ops: CompareOp[] = [];
    while (this.peek()?.kind === "cmp") {
      const token = this.peek() as { kind: "cmp"; value: CompareOp };
      this.index++;
      ops.push(token.value);
      terms.push(this.parseExpression());
    }
    return { terms, ops };
  }

  parseExpression(): Expr {
    let left = this.parseTerm();
    for (;;) {
      const token = this.peek();
      if (token?.kind !== "op" || (token.value !== "+" && token.value !== "-"))
        break;
      this.index++;
      left = { kind: "bin", op: token.value, a: left, b: this.parseTerm() };
    }
    return left;
  }

  private parseTerm(): Expr {
    let left = this.parseUnary();
    for (;;) {
      const token = this.peek();
      if (
        token?.kind === "op" &&
        (token.value === "*" || token.value === "/")
      ) {
        this.index++;
        left = { kind: "bin", op: token.value, a: left, b: this.parseUnary() };
        continue;
      }
      if (this.startsPrimary(token)) {
        left = { kind: "bin", op: "*", a: left, b: this.parseUnary() };
        continue;
      }
      return left;
    }
  }

  private parseUnary(): Expr {
    const token = this.peek();
    if (token?.kind === "op" && token.value === "-") {
      this.index++;
      return { kind: "neg", arg: this.parseUnary() };
    }
    if (token?.kind === "op" && token.value === "+") {
      this.index++;
      return this.parseUnary();
    }
    return this.parsePower();
  }

  private parsePower(): Expr {
    const base = this.parsePrimary();
    const token = this.peek();
    if (token?.kind === "op" && token.value === "^") {
      this.index++;
      return { kind: "pow", base, exponent: this.parseGroupOrAtom() };
    }
    return base;
  }

  private parseGroupOrAtom(): Expr {
    const token = this.peek();
    if (token?.kind === "openBrace") {
      this.index++;
      const inner = this.parseExpression();
      this.expect("closeBrace", "a closing }");
      return inner;
    }
    if (token?.kind === "op" && token.value === "-") {
      this.index++;
      return { kind: "neg", arg: this.parseGroupOrAtom() };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): Expr {
    const token = this.peek();
    if (token === undefined)
      throw new CompileError("The expression ends too early.");
    switch (token.kind) {
      case "number": {
        this.index++;
        return { kind: "num", value: numberValue(token.value) };
      }
      case "variable": {
        this.index++;
        const definition = this.context.env.functions.get(token.value);
        if (
          definition !== undefined &&
          !this.locals.has(token.value) &&
          this.peek()?.kind === "open"
        ) {
          return this.parseUserCall(token.value, definition);
        }
        return this.variable(token.value);
      }
      case "open": {
        this.index++;
        const inner = this.parseExpression();
        this.expect("close", "a closing parenthesis");
        return inner;
      }
      case "openBrace": {
        this.index++;
        const inner = this.parseExpression();
        this.expect("closeBrace", "a closing }");
        return inner;
      }
      case "bar": {
        this.index++;
        this.barDepth++;
        const inner = this.parseExpression();
        this.barDepth--;
        this.expect("bar", "a closing |");
        return { kind: "call", fn: "abs", args: [inner] };
      }
      case "frac": {
        this.index++;
        const a = this.parseBracedGroup();
        const b = this.parseBracedGroup();
        return { kind: "bin", op: "/", a, b };
      }
      case "sqrt": {
        this.index++;
        if (this.peek()?.kind === "openBracket") {
          this.index++;
          const index = this.parseExpression();
          this.expect("closeBracket", "a closing ]");
          const radicand = this.parseBracedGroup();
          return { kind: "call", fn: "nthroot", args: [index, radicand] };
        }
        return { kind: "call", fn: "sqrt", args: [this.parseBracedGroup()] };
      }
      case "function": {
        this.index++;
        return this.parseBuiltinCall(token.value);
      }
      case "pieceOpen": {
        this.index++;
        return this.parsePiecewise();
      }
      default:
        throw new CompileError(
          "The expression has a bracket or symbol in an unexpected place."
        );
    }
  }

  private variable(name: string): Expr {
    if (this.locals.has(name)) return { kind: "var", name, role: "local" };
    if (name === "x" || name === "y") return { kind: "var", name, role: name };
    if (name === "e") return { kind: "num", value: Math.E };
    const { scalars } = this.context.env;
    // The same rule as the visual compiler: `t` is the clock unless the graph
    // defines it, and a definition the user wrote beats an implicit meaning.
    if (name === "t" && !scalars.has("t")) {
      this.context.usesTime = true;
      return { kind: "var", name, role: "time" };
    }
    if (scalars.has(name)) {
      this.context.params.add(name);
      return { kind: "var", name, role: "param" };
    }
    if (this.context.env.functions.has(name)) {
      throw new CompileError(`"${name}" is a function and needs an argument.`);
    }
    throw new CompileError(
      `"${name}" is not defined. A solid can use x, y, t, and anything the expression list defines as a number or a function of numbers.`
    );
  }

  private parseUserCall(name: string, definition: FunctionDefinition): Expr {
    this.index++;
    const args = [this.parseExpression()];
    while (this.peek()?.kind === "comma") {
      this.index++;
      args.push(this.parseExpression());
    }
    this.expect("close", "a closing parenthesis");
    if (args.length !== definition.params.length) {
      throw new CompileError(
        `"${name}" takes ${definition.params.length} argument${
          definition.params.length === 1 ? "" : "s"
        }, but was given ${args.length}.`
      );
    }
    this.context.declare(name, definition);
    return { kind: "user", name, args };
  }

  private parseBuiltinCall(name: string): Expr {
    if (!isBuiltin(name)) {
      throw new CompileError(
        `The function "${name}" is not supported in a solid.`
      );
    }
    if (name === "logbase") {
      const base = this.parseBracedGroup();
      const argument = this.parseCallArguments();
      if (argument.length !== 1)
        throw new CompileError("A log with a base takes one argument.");
      return { kind: "call", fn: name, args: [base, argument[0]] };
    }
    const args = this.parseCallArguments();
    if (!BUILTIN_ARITY[name].includes(args.length)) {
      throw new CompileError(
        `"${name}" cannot take ${args.length} argument${args.length === 1 ? "" : "s"}.`
      );
    }
    return { kind: "call", fn: name, args };
  }

  private parseCallArguments(): Expr[] {
    if (this.peek()?.kind !== "open") {
      // `\sin x`: the bare argument binds as tightly as a power, as in Desmos.
      return [this.parsePower()];
    }
    this.index++;
    const args = [this.parseExpression()];
    while (this.peek()?.kind === "comma") {
      this.index++;
      args.push(this.parseExpression());
    }
    this.expect("close", "a closing parenthesis");
    return args;
  }

  /**
   * `{c₁: v₁, c₂: v₂, …, otherwise}`. Desmos takes the first branch whose
   * condition holds, the bare value if none does, and undefined if there is
   * no bare value. A branch with no value means 1.
   */
  private parsePiecewise(): Expr {
    const branches: PiecewiseBranch[] = [];
    let otherwise: Expr | undefined;
    if (this.peek()?.kind === "pieceClose") {
      this.index++;
      return { kind: "num", value: 1 };
    }
    for (;;) {
      const first = this.parseExpression();
      if (this.peek()?.kind === "cmp") {
        const condition = this.parseChainFrom(first);
        let value: Expr = { kind: "num", value: 1 };
        if (this.peek()?.kind === "colon") {
          this.index++;
          value = this.parseExpression();
        }
        branches.push({ condition, value });
      } else {
        otherwise = first;
        if (this.peek()?.kind !== "pieceClose")
          throw new CompileError(
            "Only the last branch of a piecewise can have no condition."
          );
      }
      if (this.peek()?.kind === "comma") {
        this.index++;
        continue;
      }
      this.expect("pieceClose", "a closing \\}");
      return { kind: "piecewise", branches, otherwise };
    }
  }

  private parseBracedGroup(): Expr {
    if (this.peek()?.kind !== "openBrace") {
      throw new CompileError("Expected a braced group.");
    }
    this.index++;
    const inner = this.parseExpression();
    this.expect("closeBrace", "a closing }");
    return inner;
  }

  private startsPrimary(token: Token | undefined) {
    if (token === undefined) return false;
    if (token.kind === "bar") return this.barDepth === 0;
    return (
      token.kind === "number" ||
      token.kind === "variable" ||
      token.kind === "open" ||
      token.kind === "frac" ||
      token.kind === "sqrt" ||
      token.kind === "function" ||
      token.kind === "pieceOpen"
    );
  }

  private expect(kind: Token["kind"], description: string) {
    if (this.peek()?.kind !== kind) {
      throw new CompileError(`Expected ${description}.`);
    }
    this.index++;
  }

  private peek(): Token | undefined {
    return this.tokens[this.index];
  }
}

/** The shared tokenizer spells π and τ as GLSL text; read them back exactly. */
function numberValue(text: string): number {
  if (text.startsWith("(2.0*")) return 2 * Math.PI;
  return Number(text);
}
