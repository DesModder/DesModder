/**
 * Evaluates a strict syntax tree on the CPU, with the numerical rules Desmos
 * itself uses.
 *
 * Those rules were measured, not assumed: `strictSemantics.fixtures.ts` holds
 * what live Desmos returned for each edge case, and `strictSemantics.int.test.ts`
 * asks it again so a change on Desmos's side fails a test rather than moving a
 * wall. What the measurements showed is that Desmos computes in IEEE doubles
 * with almost no special cases:
 *
 * - A domain error is NaN (`sqrt(-1)`, `ln(-1)`, `arcsin(1.01)`, `mod(5, 0)`).
 * - Infinity is an ordinary value and compares as one: `1/0 > 5` holds, and
 *   `ln(0)`, `arctanh(1)` and `exp(1000)` are infinite, not undefined.
 * - Any comparison with NaN is false, so a piecewise whose condition is
 *   undefined falls through to its next branch, and an inequality is unshaded
 *   wherever either side is undefined. That last point is the one that matters
 *   for a fluid: undefined is never solid.
 * - A negative base to a non-integer power is real only when the exponent is
 *   exactly `p/q` in lowest terms with q odd and at most 100 (`1/99` is,
 *   `1/101` is not, and `1/3 + 10⁻¹⁵` is not), and then it is
 *   `(−1)^p · |b|^r`. This holds for a slider's value as well as a literal, so
 *   it is a run-time rule, not a parse-time one.
 *
 * JavaScript's own `Math` already behaves this way almost everywhere, which is
 * why most cases below are a single call. The exceptions are spelled out where
 * they occur.
 */

import type { BuiltinName, Chain, Expr, StrictProgram } from "./strictParse";

/** What a compiled tree reads at evaluation time. */
export interface EvaluationScope {
  readonly x: number;
  readonly y: number;
  readonly time: number;
  /** Slider values by Desmos name. A missing one reads as NaN. */
  readonly params: ReadonlyMap<string, number>;
}

export interface StrictOptions {
  /** Desmos's degree mode: circular trig takes and returns degrees. */
  readonly degreeMode: boolean;
}

type Compiled = (scope: EvaluationScope, locals: readonly number[]) => number;

const DEG = Math.PI / 180;

/**
 * The largest denominator Desmos accepts when it treats a negative base's
 * exponent as a rational. Measured: 99 is accepted and 101 is not; 100 is even
 * and so refused whichever side of the limit it sits.
 */
export const MAX_RATIONAL_DENOMINATOR = 100;

/**
 * `b^r`, as Desmos computes it.
 *
 * `Math.pow` already gives `0^0 = 1`, `0^(−1) = ∞` and exact integer powers of
 * negative numbers. What it does not do is `(−8)^(1/3)`, which it calls NaN and
 * Desmos calls −2.
 */
export function desmosPow(base: number, exponent: number): number {
  // Math.pow(NaN, 0) is 1; Desmos keeps an undefined base undefined.
  if (Number.isNaN(base)) return NaN;
  if (!(base < 0) || Number.isInteger(exponent)) {
    return Math.pow(base, exponent);
  }
  if (!Number.isFinite(exponent)) return Math.pow(base, exponent);
  for (let q = 2; q <= MAX_RATIONAL_DENOMINATOR; q++) {
    const p = Math.round(exponent * q);
    if (p / q !== exponent) continue;
    // The first q that matches is the reduced one. An even one means a root
    // of a negative number with no real value.
    if (q % 2 === 0) return NaN;
    const magnitude = Math.pow(-base, exponent);
    return p % 2 === 0 ? magnitude : -magnitude;
  }
  return NaN;
}

/** `mod(a, b)`: the sign of the divisor, and undefined for a zero divisor. */
export function desmosMod(a: number, b: number): number {
  if (b === 0) return NaN;
  return a - b * Math.floor(a / b);
}

export function compileExpression(
  expr: Expr,
  program: StrictProgram,
  options: StrictOptions,
  localNames: readonly string[] = []
): Compiled {
  const userFunctions = new Map<string, Compiled>();
  const compileUser = (name: string): Compiled => {
    const existing = userFunctions.get(name);
    if (existing !== undefined) return existing;
    const definition = program.functions.get(name);
    if (definition === undefined) {
      throw new Error(`Programming error: "${name}" was not parsed.`);
    }
    const body = build(definition.body, definition.params);
    userFunctions.set(name, body);
    return body;
  };

  function build(node: Expr, locals: readonly string[]): Compiled {
    switch (node.kind) {
      case "num": {
        const { value } = node;
        return () => value;
      }
      case "var": {
        switch (node.role) {
          case "x":
            return (s) => s.x;
          case "y":
            return (s) => s.y;
          case "time":
            return (s) => s.time;
          case "param": {
            const { name } = node;
            return (s) => s.params.get(name) ?? NaN;
          }
          case "local": {
            const slot = locals.indexOf(node.name);
            return (_, l) => l[slot];
          }
        }
        throw new Error("Programming error: unknown variable role.");
      }
      case "neg": {
        const a = build(node.arg, locals);
        return (s, l) => -a(s, l);
      }
      case "bin": {
        const a = build(node.a, locals);
        const b = build(node.b, locals);
        switch (node.op) {
          case "+":
            return (s, l) => a(s, l) + b(s, l);
          case "-":
            return (s, l) => a(s, l) - b(s, l);
          case "*":
            return (s, l) => a(s, l) * b(s, l);
          case "/":
            return (s, l) => a(s, l) / b(s, l);
        }
        throw new Error("Programming error: unknown operator.");
      }
      case "pow": {
        const base = build(node.base, locals);
        const exponent = build(node.exponent, locals);
        return (s, l) => desmosPow(base(s, l), exponent(s, l));
      }
      case "call":
        return builtin(
          node.fn,
          node.args.map((arg) => build(arg, locals)),
          options
        );
      case "user": {
        const args = node.args.map((arg) => build(arg, locals));
        const { name } = node;
        return (s, l) =>
          compileUser(name)(
            s,
            args.map((arg) => arg(s, l))
          );
      }
      case "piecewise": {
        const branches = node.branches.map((branch) => ({
          condition: buildChain(branch.condition, locals),
          value: build(branch.value, locals),
        }));
        const otherwise =
          node.otherwise === undefined
            ? undefined
            : build(node.otherwise, locals);
        return (s, l) => {
          for (const branch of branches) {
            if (branch.condition(s, l)) return branch.value(s, l);
          }
          return otherwise === undefined ? NaN : otherwise(s, l);
        };
      }
    }
  }

  function buildChain(chain: Chain, locals: readonly string[]) {
    return compileChainWith(chain, (e) => build(e, locals));
  }

  return build(expr, localNames);
}

/**
 * A chain's truth: every link holds. JavaScript's comparisons are already
 * false whenever either side is NaN, which is Desmos's rule.
 */
export function compileChainWith(
  chain: Chain,
  build: (expr: Expr) => Compiled
): (scope: EvaluationScope, locals: readonly number[]) => boolean {
  const terms = chain.terms.map(build);
  const { ops } = chain;
  return (s, l) => {
    let left = terms[0](s, l);
    for (let i = 0; i < ops.length; i++) {
      const right = terms[i + 1](s, l);
      if (!compare(left, ops[i], right)) return false;
      left = right;
    }
    return true;
  };
}

export function compare(a: number, op: Chain["ops"][number], b: number) {
  switch (op) {
    case "<":
      return a < b;
    case "<=":
      return a <= b;
    case ">":
      return a > b;
    case ">=":
      return a >= b;
    case "=":
      return a === b;
  }
}

function builtin(
  fn: BuiltinName,
  args: Compiled[],
  { degreeMode }: StrictOptions
): Compiled {
  const [a, b] = args;
  // Degree mode converts the input of forward circular trig and the output of
  // inverse circular trig. Measured: hyperbolics are untouched by it.
  const into = degreeMode ? DEG : 1;
  const out = degreeMode ? 1 / DEG : 1;
  switch (fn) {
    case "sin":
      return (s, l) => Math.sin(a(s, l) * into);
    case "cos":
      return (s, l) => Math.cos(a(s, l) * into);
    case "tan":
      return (s, l) => Math.tan(a(s, l) * into);
    case "cot":
      return (s, l) => 1 / Math.tan(a(s, l) * into);
    case "sec":
      return (s, l) => 1 / Math.cos(a(s, l) * into);
    case "csc":
      return (s, l) => 1 / Math.sin(a(s, l) * into);
    case "arcsin":
      return (s, l) => Math.asin(a(s, l)) * out;
    case "arccos":
      return (s, l) => Math.acos(a(s, l)) * out;
    case "arctan":
      // Desmos's two-argument arctan is arctan(y, x), as atan2 is.
      return args.length === 2
        ? (s, l) => Math.atan2(a(s, l), b(s, l)) * out
        : (s, l) => Math.atan(a(s, l)) * out;
    case "arccot":
      // π/2 − arctan, continuous through 0: measured arccot(−1) = 3π/4.
      return (s, l) => (Math.PI / 2 - Math.atan(a(s, l))) * out;
    case "arcsec":
      return (s, l) => Math.acos(1 / a(s, l)) * out;
    case "arccsc":
      return (s, l) => Math.asin(1 / a(s, l)) * out;
    case "sinh":
      return (s, l) => Math.sinh(a(s, l));
    case "cosh":
      return (s, l) => Math.cosh(a(s, l));
    case "tanh":
      return (s, l) => Math.tanh(a(s, l));
    case "coth":
      return (s, l) => 1 / Math.tanh(a(s, l));
    case "sech":
      return (s, l) => 1 / Math.cosh(a(s, l));
    case "csch":
      return (s, l) => 1 / Math.sinh(a(s, l));
    case "arcsinh":
      return (s, l) => Math.asinh(a(s, l));
    case "arccosh":
      return (s, l) => Math.acosh(a(s, l));
    case "arctanh":
      return (s, l) => Math.atanh(a(s, l));
    case "exp":
      return (s, l) => Math.exp(a(s, l));
    case "ln":
      return (s, l) => Math.log(a(s, l));
    case "log":
      return (s, l) => Math.log10(a(s, l));
    case "logbase":
      // Measured: a base of 0 or below is undefined (where ln a / ln 0 would
      // give −0), and a base of 1 is a division by ln 1 = 0, so infinite.
      return (s, l) => {
        const base = a(s, l);
        return base > 0 ? Math.log(b(s, l)) / Math.log(base) : NaN;
      };
    case "sqrt":
      return (s, l) => Math.sqrt(a(s, l));
    case "nthroot":
      // Measured: `\sqrt[n]{a}` is a^(1/n) under the same rational rule, so
      // ∛−8 = −2, the −3rd root of −8 is −1/2 and the 0th root of 8 is ∞.
      return (s, l) => desmosPow(b(s, l), 1 / a(s, l));
    case "abs":
      return (s, l) => Math.abs(a(s, l));
    case "sign":
      return (s, l) => Math.sign(a(s, l));
    case "floor":
      return (s, l) => Math.floor(a(s, l));
    case "ceil":
      return (s, l) => Math.ceil(a(s, l));
    case "round":
      // Half rounds up, as Math.round does: round(−2.5) = −2.
      return (s, l) => Math.round(a(s, l));
    case "mod":
      return (s, l) => desmosMod(a(s, l), b(s, l));
    case "min":
      return (s, l) => Math.min(...args.map((arg) => arg(s, l)));
    case "max":
      return (s, l) => Math.max(...args.map((arg) => arg(s, l)));
  }
}
