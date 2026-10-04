/**
 * Compiles the subset of Desmos LaTeX that a vector-field component can
 * realistically use into a GLSL ES 3.00 expression over `vec2 p`.
 *
 * This exists because the flow visualizer evaluates the field on the GPU, tens
 * of thousands of times per frame; it cannot call back into Desmos's evaluator.
 * Anything outside the subset is reported by name so the panel can explain
 * exactly which piece it could not translate, rather than silently drawing a
 * field that is not the one in the expression list.
 */

import { canonicalIdentifier, IDENTIFIER_SOURCE } from "./identifiers";

/** A single-expression definition read out of the expression list. */
export interface FunctionDefinition {
  /** Canonical parameter names, in order. */
  params: readonly string[];
  /** The right-hand side, as LaTeX. */
  latex: string;
}

/**
 * What a field component may reference beyond `x`, `y` and `e`.
 *
 * The shader cannot call back into Desmos, so anything the expression list
 * defines has to be carried across the boundary before compiling: a function
 * arrives as the LaTeX of its body and is compiled into a GLSL function
 * alongside the field, and a named value arrives as a name alone and becomes a
 * uniform. The value itself deliberately does not appear here — see
 * `CompileResult.params`.
 */
export interface FieldEnvironment {
  functions: ReadonlyMap<string, FunctionDefinition>;
  scalars: ReadonlySet<string>;
  /**
   * What to tell someone who used a name this environment does not have.
   *
   * The default answer names the expression list, because that is where Vector
   * Tools' and Physics Lab's fields get their values from. Audio Lab's do not —
   * its environment is a fixed list of measurements and it deliberately never
   * reads the graph — so pointing someone at the expression list would send
   * them to define a variable that could not possibly be found.
   */
  unknownNameHint?: string;
}

export const EMPTY_ENVIRONMENT: FieldEnvironment = {
  functions: new Map(),
  scalars: new Set(),
};

/** A GLSL function compiled from an expression-list definition. */
export interface CompiledHelper {
  /** The Desmos name, so two components can merge helpers without duplicates. */
  name: string;
  glsl: string;
}

export type CompileResult =
  | {
      ok: true;
      glsl: string;
      /** Dependencies first, so the shader can emit them in this order. */
      helpers: readonly CompiledHelper[];
      /**
       * The named values the expression read, as Desmos names.
       *
       * These become uniforms rather than baked-in literals so that dragging a
       * slider uploads a float instead of recompiling and relinking the two
       * shader programs — the same reason `setField` compares fields before
       * rebuilding.
       */
      params: readonly string[];
      /**
       * Whether the expression read the clock, and so whether anything drawing
       * it has to keep drawing rather than settle into a still picture.
       */
      usesTime: boolean;
    }
  | { ok: false; error: string };

/**
 * How deep a chain of definitions may go before this gives up.
 *
 * A chain that long is far more likely to be a mistake than an intent, and the
 * limit is what stops a pathological graph from expanding into a shader no
 * driver will compile.
 */
const MAX_DEFINITION_DEPTH = 12;

const glslIdentifier = (name: string) => name.replace(/[^A-Za-z0-9]/g, "_");

/** One grammar for what a name is, shared with the scanner and the generator. */
const IDENTIFIER_AT_START = new RegExp(`^${IDENTIFIER_SOURCE}`);

export { canonicalIdentifier } from "./identifiers";

/**
 * The letter that means the animation clock, and the uniform behind it.
 *
 * `t` only because that is what a person writes. It is not reserved: a graph
 * that defines `t` as a slider keeps that meaning, and the compiler falls
 * through to the ordinary lookup — see `variableToGLSL`.
 */
export const TIME_NAME = "t";
const GLSL_TIME = "u_time";

/** A referenced value, as a uniform. Desmos names cannot collide once flattened. */
export const glslParamName = (name: string) => `u_vp_${glslIdentifier(name)}`;
const glslFunctionName = (name: string) => `vtu_${glslIdentifier(name)}`;
const glslLocalName = (name: string) => `vl_${glslIdentifier(name)}`;

/** Emitted once per shader; every compiled expression may reference these. */
export const GLSL_PRELUDE = `
float vtPow(float base, float power) {
  if (base > 0.0) return exp(power * log(base));
  if (base == 0.0) return power == 0.0 ? 1.0 : 0.0;
  // Negative bases are only real for integral powers.
  float rounded = floor(power + 0.5);
  if (abs(power - rounded) > 1e-6) return 0.0;
  float magnitude = exp(power * log(-base));
  return mod(abs(rounded), 2.0) < 0.5 ? magnitude : -magnitude;
}
float vtDiv(float a, float b) { return a / (abs(b) < 1e-12 ? (b < 0.0 ? -1e-12 : 1e-12) : b); }
float vtCot(float a) { return cos(a) / (abs(sin(a)) < 1e-12 ? 1e-12 : sin(a)); }
float vtSec(float a) { return 1.0 / (abs(cos(a)) < 1e-12 ? 1e-12 : cos(a)); }
float vtCsc(float a) { return 1.0 / (abs(sin(a)) < 1e-12 ? 1e-12 : sin(a)); }
float vtLog10(float a) { return log(a) / log(10.0); }
float vtMod(float a, float b) { return b == 0.0 ? 0.0 : mod(a, b); }
// What a piecewise with no branch that holds is: undefined. The field reads
// a non-finite component as no arrow at all, which is what Desmos draws.
float vtUndefined() { return uintBitsToFloat(0x7fc00000u); }
float vtCoth(float a) { float t = tanh(a); return 1.0 / (abs(t) < 1e-12 ? 1e-12 : t); }
float vtCsch(float a) { float s = sinh(a); return 1.0 / (abs(s) < 1e-12 ? 1e-12 : s); }
`;

const PI = "3.1415926535897932";

interface FunctionSpec {
  /** Accepted argument counts. */
  arity: readonly number[];
  emit: (args: string[]) => string;
}

const FUNCTIONS: Record<string, FunctionSpec> = {
  sin: { arity: [1], emit: ([a]) => `sin(${a})` },
  cos: { arity: [1], emit: ([a]) => `cos(${a})` },
  tan: { arity: [1], emit: ([a]) => `tan(${a})` },
  cot: { arity: [1], emit: ([a]) => `vtCot(${a})` },
  sec: { arity: [1], emit: ([a]) => `vtSec(${a})` },
  csc: { arity: [1], emit: ([a]) => `vtCsc(${a})` },
  arcsin: { arity: [1], emit: ([a]) => `asin(clamp(${a}, -1.0, 1.0))` },
  arccos: { arity: [1], emit: ([a]) => `acos(clamp(${a}, -1.0, 1.0))` },
  // Desmos's two-argument arctan is arctan(y, x), matching GLSL's atan(y, x).
  arctan: {
    arity: [1, 2],
    emit: (args) =>
      args.length === 1 ? `atan(${args[0]})` : `atan(${args[0]}, ${args[1]})`,
  },
  // Desmos's arccot is π/2 − arctan, continuous through 0, not arctan(1/x).
  arccot: {
    arity: [1],
    emit: ([a]) => `(${PI} / 2.0 - atan(${a}))`,
  },
  arcsec: {
    arity: [1],
    emit: ([a]) => `acos(clamp(vtDiv(1.0, ${a}), -1.0, 1.0))`,
  },
  arccsc: {
    arity: [1],
    emit: ([a]) => `asin(clamp(vtDiv(1.0, ${a}), -1.0, 1.0))`,
  },
  sinh: { arity: [1], emit: ([a]) => `sinh(${a})` },
  cosh: { arity: [1], emit: ([a]) => `cosh(${a})` },
  tanh: { arity: [1], emit: ([a]) => `tanh(${a})` },
  coth: { arity: [1], emit: ([a]) => `vtCoth(${a})` },
  sech: { arity: [1], emit: ([a]) => `(1.0 / cosh(${a}))` },
  csch: { arity: [1], emit: ([a]) => `vtCsch(${a})` },
  arcsinh: { arity: [1], emit: ([a]) => `asinh(${a})` },
  arccosh: { arity: [1], emit: ([a]) => `acosh(max(${a}, 1.0))` },
  arctanh: {
    arity: [1],
    emit: ([a]) => `atanh(clamp(${a}, -0.999999, 0.999999))`,
  },
  exp: { arity: [1], emit: ([a]) => `exp(${a})` },
  ln: { arity: [1], emit: ([a]) => `log(max(${a}, 1e-12))` },
  log: { arity: [1], emit: ([a]) => `vtLog10(max(${a}, 1e-12))` },
  sqrt: { arity: [1], emit: ([a]) => `sqrt(max(${a}, 0.0))` },
  abs: { arity: [1], emit: ([a]) => `abs(${a})` },
  sign: { arity: [1], emit: ([a]) => `sign(${a})` },
  floor: { arity: [1], emit: ([a]) => `floor(${a})` },
  ceil: { arity: [1], emit: ([a]) => `ceil(${a})` },
  round: { arity: [1], emit: ([a]) => `floor(${a} + 0.5)` },
  mod: { arity: [2], emit: ([a, b]) => `vtMod(${a}, ${b})` },
  min: { arity: [1, 2, 3, 4], emit: naryEmit("min") },
  max: { arity: [1, 2, 3, 4], emit: naryEmit("max") },
};

function naryEmit(name: string) {
  return (args: string[]) =>
    args.length === 1 ? args[0] : args.reduce((a, b) => `${name}(${a}, ${b})`);
}

export function compileFieldComponentToGLSL(
  latex: string,
  env: FieldEnvironment = EMPTY_ENVIRONMENT
): CompileResult {
  try {
    const context = new CompileContext(env);
    const parser = new Parser(tokenize(latex), context, new Map());
    const glsl = parser.parseExpression();
    parser.expectEnd();
    return {
      ok: true,
      glsl,
      helpers: context.helpers,
      params: [...context.params],
      usesTime: context.usesTime,
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
 * Exported for the strict geometry compiler (`sim/strictParse.ts`), which reads
 * the same LaTeX through the same tokenizer so that the two can never disagree
 * about what was typed, only about what it means.
 */
export class CompileError extends Error {}

/**
 * What one compilation accumulates: the helper functions it had to build, and
 * the named values it read.
 *
 * A referenced function becomes a real GLSL function rather than being inlined
 * at the call site, because a body that uses its argument more than once would
 * otherwise duplicate the whole argument expression each time, and a chain of
 * such calls multiplies. Compiling it once also means the shader reads the way
 * the graph does.
 */
class CompileContext {
  readonly params = new Set<string>();
  /** Set by `variableToGLSL` when anything, at any depth, read the clock. */
  usesTime = false;
  readonly helpers: CompiledHelper[] = [];
  private readonly compiled = new Map<string, string>();
  private readonly expanding: string[] = [];

  constructor(readonly env: FieldEnvironment) {}

  /** The GLSL function for a definition, compiling it the first time it is used. */
  declare(name: string, definition: FunctionDefinition): string {
    const already = this.compiled.get(name);
    if (already !== undefined) return already;
    if (this.expanding.includes(name)) {
      throw new CompileError(
        `"${name}" is defined in terms of itself, and a shader cannot evaluate a recursive definition.`
      );
    }
    if (this.expanding.length >= MAX_DEFINITION_DEPTH) {
      throw new CompileError(
        `Definitions starting at "${name}" nest more than ${MAX_DEFINITION_DEPTH} deep.`
      );
    }
    this.expanding.push(name);
    const scope = new Map(
      definition.params.map((param) => [param, glslLocalName(param)] as const)
    );
    const parser = new Parser(tokenize(definition.latex), this, scope);
    const body = parser.parseExpression();
    parser.expectEnd();
    this.expanding.pop();

    // `p` is passed to every helper whether it reads a coordinate or not, so a
    // definition is free to mention x and y without the caller knowing whether
    // it does. Registered only now, after its own body compiled, so anything it
    // called is already ahead of it and the shader can emit them in order.
    const glslName = glslFunctionName(name);
    const signature = [
      "vec2 p",
      ...definition.params.map((param) => `float ${glslLocalName(param)}`),
    ].join(", ");
    this.helpers.push({
      name,
      glsl: `float ${glslName}(${signature}) { return ${body}; }`,
    });
    this.compiled.set(name, glslName);
    return glslName;
  }
}

export type Token =
  | { kind: "number"; value: string }
  | { kind: "variable"; value: string }
  | { kind: "function"; value: string }
  | { kind: "op"; value: "+" | "-" | "*" | "/" | "^" }
  | {
      kind:
        | "open"
        | "close"
        | "openBrace"
        | "closeBrace"
        | "openBracket"
        | "closeBracket";
    }
  | { kind: "bar" }
  | { kind: "comma" }
  | { kind: "frac" | "sqrt" }
  /** `\left\{` and `\right\}`: a piecewise or a restriction. */
  | { kind: "pieceOpen" | "pieceClose" | "colon" }
  | { kind: "cmp"; value: "<" | ">" | "<=" | ">=" | "=" };

/** The comparison commands Desmos writes, as GLSL operators. */
const COMPARISONS: Record<string, "<=" | ">="> = {
  le: "<=",
  leq: "<=",
  ge: ">=",
  geq: ">=",
};

const COMMAND_ALIASES: Record<string, string> = {
  cdot: "*",
  times: "*",
  div: "/",
};

/**
 * Where a function's argument written without brackets ends, as live Desmos
 * reads it, or undefined where Desmos refuses it ("Use parentheses around the
 * argument of 'sin'"). `start` is the token after the function's name. Both
 * this file's compiler and the strict one (`sim/strictParse.ts`) use it.
 *
 * Measured in live Desmos on 2026-10-03:
 * - **The argument is the whole product that follows.** `\sin 2x` is sin(2x),
 *   `\sin xy` is sin(xy), `\sin 2x/3` is sin(2x/3), `\sin x\cdot3` is sin(3x),
 *   `\sin x^{2}x` is sin(x³), `\sin 2(x+1)` is sin(2(x+1)), and
 *   `\sin x^{2}(2)` is sin(2x²).
 * - **It ends** at `+` or `−`, a comparison, a comma or a closing bracket:
 *   `\sin 2x-1` is sin(2x) − 1.
 * - **Desmos refuses** another function, a root, `|x|`, a piecewise, a leading
 *   minus, and a bracket straight after a letter (`\sin x(2)`, which reads
 *   like a call) anywhere in such an argument. So does this, rather than
 *   guess at a reading Desmos never draws.
 */
export function bareArgumentEnd(
  tokens: readonly Token[],
  start: number,
  insideBars: boolean
): number | undefined {
  /** The index after a balanced group opening at `at`, if it is one. */
  const skipGroup = (
    at: number,
    open: Token["kind"],
    close: Token["kind"]
  ): number | undefined => {
    if (tokens[at]?.kind !== open) return undefined;
    let depth = 0;
    for (let i = at; i < tokens.length; i++) {
      if (tokens[i].kind === open) depth++;
      else if (tokens[i].kind === close && --depth === 0) return i + 1;
    }
    return undefined;
  };
  /** An exponent after `^`: a braced group, or a signed number or letter. */
  const skipExponent = (at: number): number | undefined => {
    const token = tokens[at];
    if (token?.kind === "openBrace")
      return skipGroup(at, "openBrace", "closeBrace");
    if (token?.kind === "op" && token.value === "-")
      return skipExponent(at + 1);
    if (token?.kind === "number" || token?.kind === "variable") return at + 1;
    return undefined;
  };

  let i: number | undefined = start;
  let afterLetter = false;
  for (;;) {
    // A factor.
    const token: Token | undefined = tokens[i];
    switch (token?.kind) {
      case "number":
        i++;
        afterLetter = false;
        break;
      case "variable":
        i++;
        afterLetter = true;
        break;
      case "frac":
        i = skipGroup(i + 1, "openBrace", "closeBrace");
        if (i === undefined) return undefined;
        i = skipGroup(i, "openBrace", "closeBrace");
        afterLetter = false;
        break;
      case "open":
        if (afterLetter) return undefined;
        i = skipGroup(i, "open", "close");
        afterLetter = false;
        break;
      default:
        return undefined;
    }
    if (i === undefined) return undefined;
    const power = tokens[i];
    if (power?.kind === "op" && power.value === "^") {
      i = skipExponent(i + 1);
      if (i === undefined) return undefined;
      afterLetter = false;
    }
    // What joins it to the next factor, if anything does.
    const next = tokens[i];
    switch (next?.kind) {
      case "op":
        if (next.value === "*" || next.value === "/") {
          i++;
          afterLetter = false;
          continue;
        }
        return i;
      case "number":
      case "variable":
      case "frac":
      case "open":
        continue;
      case "bar":
        // Inside |…| a bar closes it; anywhere else it would open another.
        return insideBars ? i : undefined;
      case "function":
      case "sqrt":
      case "pieceOpen":
        return undefined;
      default:
        return i;
    }
  }
}

export function tokenize(latex: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const pushBar = () => tokens.push({ kind: "bar" });

  while (i < latex.length) {
    const char = latex[i];
    if (/\s/.test(char)) {
      i++;
      continue;
    }
    if (/[\d.]/.test(char)) {
      const match = /^\d*\.?\d+|^\d+\./.exec(latex.slice(i));
      if (match === null)
        throw new CompileError(
          `Could not read the number near "${latex.slice(i, i + 8)}".`
        );
      tokens.push({ kind: "number", value: match[0] });
      i += match[0].length;
      continue;
    }
    if (char === "\\") {
      const nameMatch = /^\\([A-Za-z]+)/.exec(latex.slice(i));
      if (nameMatch === null) {
        // `\ ` is MathQuill's escaped space, and `\{`/`\}` are literal braces.
        if (latex[i + 1] === " ") {
          i += 2;
          continue;
        }
        throw new CompileError(`"${latex.slice(i, i + 2)}" is not supported.`);
      }
      const [command, name] = nameMatch;
      i += command.length;
      if (name === "left" || name === "right") {
        const delimiter = latex[i];
        i++;
        if (delimiter === "(")
          tokens.push({ kind: name === "left" ? "open" : "close" });
        else if (delimiter === ")")
          tokens.push({ kind: name === "left" ? "open" : "close" });
        else if (delimiter === "|") pushBar();
        else if (delimiter === "\\" && latex[i] === "{") {
          i++;
          tokens.push({ kind: name === "left" ? "pieceOpen" : "pieceClose" });
        } else if (delimiter === "\\" && latex[i] === "}") {
          i++;
          tokens.push({ kind: name === "left" ? "pieceOpen" : "pieceClose" });
        } else
          throw new CompileError(
            `The "${delimiter}" bracket is not supported.`
          );
        continue;
      }
      if (name === "operatorname") {
        const opMatch = /^\{([A-Za-z]+)\}/.exec(latex.slice(i));
        if (opMatch === null)
          throw new CompileError("Could not read an operator name.");
        i += opMatch[0].length;
        tokens.push({ kind: "function", value: opMatch[1] });
        continue;
      }
      if (name === "frac" || name === "dfrac" || name === "tfrac") {
        tokens.push({ kind: "frac" });
        continue;
      }
      if (name === "sqrt") {
        tokens.push({ kind: "sqrt" });
        continue;
      }
      if (name === "pi") {
        tokens.push({ kind: "number", value: PI });
        continue;
      }
      if (name === "tau") {
        tokens.push({ kind: "number", value: `(2.0*${PI})` });
        continue;
      }
      if (name in COMMAND_ALIASES) {
        tokens.push({ kind: "op", value: COMMAND_ALIASES[name] as "*" | "/" });
        continue;
      }
      if (name in FUNCTIONS) {
        tokens.push({ kind: "function", value: name });
        continue;
      }
      if (name in COMPARISONS) {
        tokens.push({ kind: "cmp", value: COMPARISONS[name] });
        continue;
      }
      throw new CompileError(
        `\\${name} is not supported by the flow visualizer.`
      );
    }
    if (/[A-Za-z]/.test(char)) {
      // A Desmos identifier is one letter and an optional subscript, and both
      // forms MathQuill can produce are accepted. These used to be refused
      // outright as unreachable; they are now looked up in the environment the
      // caller read out of the expression list.
      const [identifier] = IDENTIFIER_AT_START.exec(latex.slice(i))!;
      tokens.push({ kind: "variable", value: canonicalIdentifier(identifier) });
      i += identifier.length;
      continue;
    }
    i++;
    switch (char) {
      case "(":
        tokens.push({ kind: "open" });
        continue;
      case ")":
        tokens.push({ kind: "close" });
        continue;
      case "{":
        tokens.push({ kind: "openBrace" });
        continue;
      case "}":
        tokens.push({ kind: "closeBrace" });
        continue;
      case "[":
        tokens.push({ kind: "openBracket" });
        continue;
      case "]":
        tokens.push({ kind: "closeBracket" });
        continue;
      case "|":
        pushBar();
        continue;
      case ",":
        tokens.push({ kind: "comma" });
        continue;
      case "+":
      case "-":
      case "*":
      case "/":
      case "^":
        tokens.push({ kind: "op", value: char });
        continue;
      case "=":
      case "<":
      case ">":
        // An `=` outside a condition is an equation, and the parser says so.
        tokens.push({ kind: "cmp", value: char });
        continue;
      case ":":
        tokens.push({ kind: "colon" });
        continue;
      default:
        throw new CompileError(`"${char}" is not supported.`);
    }
  }
  return tokens;
}

class Parser {
  private index = 0;
  /**
   * `|` opens and closes absolute value with the same character, so an inner
   * bar must be read as "close" rather than as the start of another factor.
   */
  private barDepth = 0;

  constructor(
    private readonly tokens: readonly Token[],
    private readonly context: CompileContext,
    /** Parameter names bound by the definition being compiled, if any. */
    private readonly scope: ReadonlyMap<string, string>
  ) {}

  expectEnd() {
    const next = this.peek();
    if (next?.kind === "cmp" && next.value === "=")
      throw new CompileError(
        "A field component must be an expression, not an equation."
      );
    if (this.index < this.tokens.length) {
      throw new CompileError("There is leftover input after the expression.");
    }
  }

  parseExpression(): string {
    let left = this.parseTerm();
    for (;;) {
      const token = this.peek();
      if (token?.kind !== "op" || (token.value !== "+" && token.value !== "-"))
        break;
      this.index++;
      const right = this.parseTerm();
      left = `(${left} ${token.value} ${right})`;
    }
    return left;
  }

  private parseTerm(): string {
    let left = this.parseUnary();
    for (;;) {
      const token = this.peek();
      if (
        token?.kind === "op" &&
        (token.value === "*" || token.value === "/")
      ) {
        this.index++;
        const right = this.parseUnary();
        left =
          token.value === "*"
            ? `(${left} * ${right})`
            : `vtDiv(${left}, ${right})`;
        continue;
      }
      if (this.startsPrimary(token)) {
        const right = this.parseUnary();
        left = `(${left} * ${right})`;
        continue;
      }
      break;
    }
    return left;
  }

  private parseUnary(): string {
    const token = this.peek();
    if (token?.kind === "op" && token.value === "-") {
      this.index++;
      return `(-${this.parseUnary()})`;
    }
    if (token?.kind === "op" && token.value === "+") {
      this.index++;
      return this.parseUnary();
    }
    return this.parsePower();
  }

  private parsePower(): string {
    const base = this.parsePrimary();
    const token = this.peek();
    if (token?.kind === "op" && token.value === "^") {
      this.index++;
      // Exponents bind right-to-left, and a unary minus is allowed: x^{-2}.
      const exponent = this.parseGroupOrAtom();
      return powerGLSL(base, exponent);
    }
    return base;
  }

  /** A braced group `{...}`, or a single atom for shorthand like `x^2`. */
  private parseGroupOrAtom(): string {
    const token = this.peek();
    if (token?.kind === "openBrace") {
      this.index++;
      const inner = this.parseExpression();
      this.expect("closeBrace", "a closing }");
      return inner;
    }
    if (token?.kind === "op" && token.value === "-") {
      this.index++;
      return `(-${this.parseGroupOrAtom()})`;
    }
    return this.parsePrimary();
  }

  private parsePrimary(): string {
    const token = this.peek();
    if (token === undefined)
      throw new CompileError("The expression ends too early.");

    switch (token.kind) {
      case "number":
        this.index++;
        return glslFloat(token.value);
      case "variable": {
        this.index++;
        // `f(...)` is a call when f is a definition and a multiplication when
        // it is a value, which is exactly how Desmos reads it too.
        const definition = this.context.env.functions.get(token.value);
        if (definition !== undefined && this.peek()?.kind === "open") {
          return this.parseDefinedCall(token.value, definition);
        }
        return this.variableToGLSL(token.value);
      }
      case "open": {
        this.index++;
        const inner = this.parseExpression();
        this.expect("close", "a closing parenthesis");
        return `(${inner})`;
      }
      case "openBrace": {
        this.index++;
        const inner = this.parseExpression();
        this.expect("closeBrace", "a closing }");
        return `(${inner})`;
      }
      case "bar": {
        this.index++;
        this.barDepth++;
        const inner = this.parseExpression();
        this.barDepth--;
        this.expect("bar", "a closing |");
        return `abs(${inner})`;
      }
      case "frac": {
        this.index++;
        const numerator = this.parseBracedGroup();
        const denominator = this.parseBracedGroup();
        return `vtDiv(${numerator}, ${denominator})`;
      }
      case "sqrt": {
        this.index++;
        if (this.peek()?.kind === "openBracket") {
          this.index++;
          const degree = this.parseExpression();
          this.expect("closeBracket", "a closing ]");
          const radicand = this.parseBracedGroup();
          return `vtPow(${radicand}, vtDiv(1.0, ${degree}))`;
        }
        return `sqrt(max(${this.parseBracedGroup()}, 0.0))`;
      }
      case "function": {
        this.index++;
        return this.parseFunctionCall(token.value);
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

  /**
   * A name the caller resolved out of the expression list: a coordinate, the
   * constant e, a parameter of the definition being compiled, or a value the
   * graph binds — which becomes a uniform rather than a literal.
   */
  private variableToGLSL(name: string): string {
    const bound = this.scope.get(name);
    if (bound !== undefined) return bound;
    switch (name) {
      case "x":
        return "p.x";
      case "y":
        return "p.y";
      case "e":
        return "2.7182818284590452";
      default:
        break;
    }
    // `t` means the animation clock, but only where the graph has not said
    // otherwise. A definition the user wrote down is an explicit statement of
    // what the letter means and beats an implicit one — the ordinary scoping
    // rule, and the one that leaves `t` usable as a plain slider. Falling
    // through to the lookup below is what implements that.
    if (name === TIME_NAME && !this.context.env.scalars.has(TIME_NAME)) {
      this.context.usesTime = true;
      return GLSL_TIME;
    }
    if (this.context.env.scalars.has(name)) {
      this.context.params.add(name);
      return glslParamName(name);
    }
    throw new CompileError(
      `"${name}" is not defined. ${
        this.context.env.unknownNameHint ??
        "The flow visualizer knows x and y, and anything the expression list defines as a number or a function of numbers."
      }`
    );
  }

  private parseDefinedCall(name: string, definition: FunctionDefinition) {
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
    const glslName = this.context.declare(name, definition);
    return `${glslName}(p${args.map((arg) => `, ${arg}`).join("")})`;
  }

  private parseFunctionCall(name: string): string {
    const spec = FUNCTIONS[name];
    if (spec === undefined) {
      throw new CompileError(
        `The function "${name}" is not supported by the flow visualizer.`
      );
    }
    let args: string[];
    if (this.peek()?.kind === "open") {
      this.index++;
      args = [this.parseExpression()];
      while (this.peek()?.kind === "comma") {
        this.index++;
        args.push(this.parseExpression());
      }
      this.expect("close", "a closing parenthesis");
    } else {
      args = [this.parseBareArgument(name)];
    }
    if (!spec.arity.includes(args.length)) {
      throw new CompileError(
        `"${name}" cannot take ${args.length} argument${args.length === 1 ? "" : "s"}.`
      );
    }
    return spec.emit(args);
  }

  /**
   * A function's argument written without brackets, as in `\sin 2x`, read
   * the way live Desmos reads it (measured 2026-10-03; see
   * `bareArgumentEnd`): the whole product that follows, so `\sin 2x` is
   * sin(2x), not sin(2)·x.
   */
  private parseBareArgument(name: string): string {
    const start = this.index;
    const end = bareArgumentEnd(this.tokens, start, this.barDepth > 0);
    if (end === undefined) {
      throw new CompileError(
        `Use parentheses around the argument of "${name}".`
      );
    }
    const argument = new Parser(
      this.tokens.slice(start, end),
      this.context,
      this.scope
    ).parseExpression();
    this.index = end;
    return argument;
  }

  /**
   * `{c₁: v₁, c₂: v₂, …, otherwise}`, as Desmos reads it: the first branch
   * whose condition holds, the last bare value if none does, and undefined if
   * there is no such value. A branch with no value is 1 where it holds, so a
   * restriction `{x > 0}` multiplies by 1 there and is undefined elsewhere.
   */
  private parsePiecewise(): string {
    const branches: { condition: string; value: string }[] = [];
    let otherwise = "vtUndefined()";
    if (this.peek()?.kind === "pieceClose") {
      this.index++;
      return "1.0";
    }
    for (;;) {
      const first = this.parseExpression();
      if (this.peek()?.kind === "cmp") {
        const condition = this.parseConditionFrom(first);
        let value = "1.0";
        if (this.peek()?.kind === "colon") {
          this.index++;
          value = this.parseExpression();
        }
        branches.push({ condition, value });
      } else {
        // A bare value is the otherwise branch, and has to be the last one.
        otherwise = first;
        if (this.peek()?.kind !== "pieceClose")
          throw new CompileError(
            "Only the last branch of a piecewise can have no condition."
          );
      }
      const next = this.peek();
      if (next?.kind === "comma") {
        this.index++;
        continue;
      }
      this.expect("pieceClose", "a closing \\}");
      break;
    }
    return branches.reduceRight(
      (rest, { condition, value }) => `((${condition}) ? (${value}) : ${rest})`,
      otherwise
    );
  }

  /** `a < b ≤ c`, a chain, as each link joined by `&&`. */
  private parseConditionFrom(first: string): string {
    const links: string[] = [];
    let left = first;
    while (this.peek()?.kind === "cmp") {
      const token = this.peek() as { kind: "cmp"; value: string };
      this.index++;
      const right = this.parseExpression();
      const op = token.value === "=" ? "==" : token.value;
      links.push(`(${left} ${op} ${right})`);
      left = right;
    }
    return links.join(" && ");
  }

  private parseBracedGroup(): string {
    if (this.peek()?.kind !== "openBrace") {
      throw new CompileError("Expected a braced group.");
    }
    this.index++;
    const inner = this.parseExpression();
    this.expect("closeBrace", "a closing }");
    return `(${inner})`;
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

/**
 * `x^2 + y^2` is by far the most common thing a field component does, and
 * `vtPow` costs an exp/log pair. Small integer powers become plain products.
 */
function powerGLSL(base: string, exponent: string) {
  const literal = /^\(?-?\d+\.\d+\)?$/.test(exponent)
    ? Number(exponent.replace(/[()]/g, ""))
    : NaN;
  if (literal === 0) return "1.0";
  // Only inline short bases; repeating a long subexpression would cost more
  // than the exp/log pair it saves.
  if (
    Number.isInteger(literal) &&
    literal >= -4 &&
    literal <= 4 &&
    base.length <= 24
  ) {
    const positive = Math.abs(literal);
    const product =
      positive === 1
        ? base
        : `(${Array.from({ length: positive }, () => base).join(" * ")})`;
    return literal > 0 ? product : `vtDiv(1.0, ${product})`;
  }
  return `vtPow(${base}, ${exponent})`;
}

function glslFloat(value: string) {
  if (value.startsWith("(")) return value;
  return value.includes(".") ? value : `${value}.0`;
}
