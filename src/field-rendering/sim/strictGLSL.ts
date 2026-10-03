/**
 * Emits GLSL ES 3.00 for a strict syntax tree, carrying a validity flag beside
 * every value so that undefined can never become solid.
 *
 * Each node becomes a pair of locals, `float vN` and `bool kN`, where `kN` false
 * means Desmos would call the value undefined (NaN). The flag is tracked
 * explicitly rather than trusted to NaN arithmetic, because GLSL ES does not
 * promise NaN at all: a driver may fold `isnan` to false, and division by zero
 * and `log(0)` are undefined in the specification. Every hazardous operation is
 * guarded with control flow, and the one test that does look at a result's
 * bits, after arithmetic that could have produced Inf − Inf, reads the bits
 * themselves, which no optimiser can assume away.
 *
 * Infinity stays a value, as it is in Desmos: `1/0 > 5` holds. It is built from
 * its bit pattern instead of by dividing by zero.
 *
 * Float32 is not double, and two differences are inherent. Values beyond about
 * 3.4·10³⁸ overflow to infinity where Desmos still has a finite number, and a
 * slider exponent is matched to a rational within float32 rounding rather than
 * exactly (see `vsPow`). Both are listed in `docs/FLUID_STRICT_GEOMETRY.md`.
 */

import type { BuiltinName, Chain, Expr, StrictProgram } from "./strictParse";
import type { StrictOptions } from "./strictEvaluate";
import { MAX_RATIONAL_DENOMINATOR } from "./strictEvaluate";
import { glslParamName } from "../latexToGLSL";

/** Emitted once per shader that contains strict geometry. */
export const STRICT_GLSL_PRELUDE = `
float vsInf() { return uintBitsToFloat(0x7f800000u); }
bool vsIsNaN(float v) { return (floatBitsToUint(v) & 0x7fffffffu) > 0x7f800000u; }
bool vsIsInf(float v) { return (floatBitsToUint(v) & 0x7fffffffu) == 0x7f800000u; }
float vsDiv(float a, float b, inout bool ok) {
  if (b != 0.0) return a / b;
  if (a == 0.0) { ok = false; return 0.0; }
  return a > 0.0 ? vsInf() : -vsInf();
}
float vsRecip(float b, inout bool ok) { return vsDiv(1.0, b, ok); }
float vsLn(float a, inout bool ok) {
  if (a > 0.0) return vsIsInf(a) ? vsInf() : log(a);
  if (a == 0.0) return -vsInf();
  ok = false;
  return 0.0;
}
float vsSqrt(float a, inout bool ok) {
  if (a >= 0.0) return vsIsInf(a) ? vsInf() : sqrt(a);
  ok = false;
  return 0.0;
}
float vsAsin(float a, inout bool ok) {
  if (abs(a) <= 1.0) return asin(a);
  ok = false;
  return 0.0;
}
float vsAcos(float a, inout bool ok) {
  if (abs(a) <= 1.0) return acos(a);
  ok = false;
  return 0.0;
}
float vsAcosh(float a, inout bool ok) {
  if (a >= 1.0) return vsIsInf(a) ? vsInf() : log(a + sqrt(a * a - 1.0));
  ok = false;
  return 0.0;
}
float vsAtanh(float a, inout bool ok) {
  if (abs(a) < 1.0) return 0.5 * log((1.0 + a) / (1.0 - a));
  if (abs(a) == 1.0) return a > 0.0 ? vsInf() : -vsInf();
  ok = false;
  return 0.0;
}
// |b|^r, for b != 0, without GLSL's pow, which is undefined for b < 0 and for
// b = 0 with r <= 0.
float vsMagnitudePow(float b, float r) { return exp2(r * log2(abs(b))); }
float vsPow(float b, float r, inout bool ok) {
  if (!ok) return 0.0;
  if (vsIsNaN(b) || vsIsNaN(r)) { ok = false; return 0.0; }
  if (b == 0.0) return r > 0.0 ? 0.0 : (r == 0.0 ? 1.0 : vsInf());
  if (r == 0.0) return 1.0;
  if (b > 0.0) return vsMagnitudePow(b, r);
  if (r == floor(r)) {
    float m = vsMagnitudePow(b, r);
    return mod(abs(r), 2.0) == 1.0 ? -m : m;
  }
  // Desmos takes a negative base to a power p/q in lowest terms, q odd and at
  // most ${MAX_RATIONAL_DENOMINATOR}, and refuses anything else. Float32 cannot
  // hold most such p/q exactly, so a match here is within a few roundings.
  for (int q = 2; q <= ${MAX_RATIONAL_DENOMINATOR}; q++) {
    float fq = float(q);
    float p = floor(r * fq + 0.5);
    if (abs(r * fq - p) <= 4.0 * 1.1920929e-7 * max(1.0, abs(r * fq))) {
      if ((q / 2) * 2 == q) { ok = false; return 0.0; }
      float m = vsMagnitudePow(b, r);
      return mod(abs(p), 2.0) == 1.0 ? -m : m;
    }
  }
  ok = false;
  return 0.0;
}
// GLSL leaves atan(0, 0) undefined; Desmos says 0.
float vsAtan2(float y, float x) { return (x == 0.0 && y == 0.0) ? 0.0 : atan(y, x); }
float vsMod(float a, float b, inout bool ok) {
  if (b == 0.0) { ok = false; return 0.0; }
  return a - b * floor(a / b);
}
float vsLogBase(float base, float a, inout bool ok) {
  if (!(base > 0.0)) { ok = false; return 0.0; }
  float num = vsLn(a, ok);
  float den = vsLn(base, ok);
  return vsDiv(num, den, ok);
}
`;

export interface EmittedRelation {
  /** GLSL functions the relation needs, dependencies first. */
  helpers: string[];
  /** `bool name(vec2 p)`: whether the point is inside the region. */
  solidFunction: string;
  /**
   * `float name(vec2 p, out bool ok)`: a function that is negative inside the
   * region and positive outside, for wall placement. `ok` false means it is
   * undefined at p.
   */
  signedFunction: string;
}

/**
 * Emits the two entry points for one relation, named with `id` so several
 * obstacles can share a shader.
 */
export function emitRelationGLSL(
  program: StrictProgram,
  options: StrictOptions,
  id: string
): EmittedRelation {
  const helpers: string[] = [];
  const declared = new Set<string>();
  const declareUser = (name: string): string => {
    const glslName = `vsu_${glslIdentifier(name)}`;
    if (declared.has(name)) return glslName;
    declared.add(name);
    const definition = program.functions.get(name)!;
    const body = new Body(options, declareUser);
    const result = body.expr(definition.body);
    const signature = [
      "vec2 p",
      ...definition.params.flatMap((param) => [
        `float vl_${glslIdentifier(param)}`,
        `bool kl_${glslIdentifier(param)}`,
      ]),
      "out bool ok",
    ].join(", ");
    helpers.push(
      `float ${glslName}(${signature}) {\n${body.lines.join("\n")}\n  ok = ${result.k};\n  return ${result.v};\n}`
    );
    return glslName;
  };

  const { chain, restrictions } = program.relation;

  const solidBody = new Body(options, declareUser);
  const truths = [
    solidBody.chain(chain),
    ...restrictions.map((any) => solidBody.anyOf(any)),
  ];
  const solidFunction = `bool vsSolid_${id}(vec2 p) {\n${solidBody.lines.join("\n")}\n  return ${truths.join(" && ")};\n}`;

  const signedBody = new Body(options, declareUser);
  const signed = signedBody.signedRelation(chain, restrictions);
  const signedFunction = `float vsSigned_${id}(vec2 p, out bool ok) {\n${signedBody.lines.join("\n")}\n  ok = ${signed.k};\n  return ${signed.v};\n}`;

  return { helpers, solidFunction, signedFunction };
}

/**
 * `float name(vec2 p, out bool ok)` for a plain expression. Obstacles do not
 * need it; the GPU semantics test does, to hold each operation to Desmos.
 */
export function emitExpressionGLSL(
  expr: Expr,
  program: StrictProgram,
  options: StrictOptions,
  name: string
): string {
  if (program.functions.size > 0) {
    throw new Error("Programming error: definitions are not supported here.");
  }
  const body = new Body(options, () => {
    throw new Error("Programming error: definitions are not supported here.");
  });
  const value = body.expr(expr);
  return `float ${name}(vec2 p, out bool ok) {\n${body.lines.join("\n")}\n  ok = ${value.k};\n  return ${value.v};\n}`;
}

const glslIdentifier = (name: string) => name.replace(/[^A-Za-z0-9]/g, "_");

interface Value {
  v: string;
  k: string;
}

const PI = "3.14159265358979";

class Body {
  readonly lines: string[] = [];
  private next = 0;

  constructor(
    private readonly options: StrictOptions,
    private readonly declareUser: (name: string) => string
  ) {}

  private fresh(): string {
    return String(this.next++);
  }

  /**
   * A value whose validity is its inputs' and its own: defined inputs can
   * still give NaN, as Inf − Inf, 0 · Inf and sin(Inf) do in Desmos too.
   */
  private value(inputs: Value[], compute: () => string): Value {
    const n = this.fresh();
    const k =
      inputs.length === 0 ? "true" : inputs.map((i) => i.k).join(" && ");
    this.lines.push(`  bool k${n} = ${k};`);
    this.lines.push(`  float v${n} = k${n} ? ${compute()} : 0.0;`);
    this.lines.push(`  k${n} = k${n} && !vsIsNaN(v${n});`);
    return { v: `v${n}`, k: `k${n}` };
  }

  private arithmetic(inputs: Value[], expression: string): Value {
    return this.value(inputs, () => expression);
  }

  /** A guarded helper that clears `ok` itself: `vsDiv(a, b, ok)`. */
  private guarded(inputs: Value[], call: (ok: string) => string): Value {
    const n = this.fresh();
    const k =
      inputs.length === 0 ? "true" : inputs.map((i) => i.k).join(" && ");
    this.lines.push(`  bool k${n} = ${k};`);
    this.lines.push(`  float v${n} = 0.0;`);
    this.lines.push(`  if (k${n}) v${n} = ${call(`k${n}`)};`);
    this.lines.push(`  k${n} = k${n} && !vsIsNaN(v${n});`);
    return { v: `v${n}`, k: `k${n}` };
  }

  expr(node: Expr): Value {
    switch (node.kind) {
      case "num":
        return { v: glslNumber(node.value), k: "true" };
      case "var":
        switch (node.role) {
          case "x":
            return { v: "p.x", k: "true" };
          case "y":
            return { v: "p.y", k: "true" };
          case "time":
            return { v: "u_time", k: "true" };
          case "param": {
            const uniform = glslParamName(node.name);
            return { v: uniform, k: `!vsIsNaN(${uniform})` };
          }
          case "local":
            return {
              v: `vl_${glslIdentifier(node.name)}`,
              k: `kl_${glslIdentifier(node.name)}`,
            };
        }
        throw new Error("Programming error: unknown variable role.");
      case "neg": {
        const a = this.expr(node.arg);
        return this.value([a], () => `-${a.v}`);
      }
      case "bin": {
        const a = this.expr(node.a);
        const b = this.expr(node.b);
        if (node.op === "/") {
          return this.guarded([a, b], (ok) => `vsDiv(${a.v}, ${b.v}, ${ok})`);
        }
        return this.arithmetic([a, b], `${a.v} ${node.op} ${b.v}`);
      }
      case "pow": {
        const base = this.expr(node.base);
        const exponent = this.expr(node.exponent);
        return this.guarded(
          [base, exponent],
          (ok) => `vsPow(${base.v}, ${exponent.v}, ${ok})`
        );
      }
      case "call":
        return this.builtin(
          node.fn,
          node.args.map((arg) => this.expr(arg))
        );
      case "user": {
        const args = node.args.map((arg) => this.expr(arg));
        const name = this.declareUser(node.name);
        const n = this.fresh();
        this.lines.push(`  bool k${n};`);
        const passed = args.flatMap((arg) => [arg.v, arg.k]).join(", ");
        this.lines.push(`  float v${n} = ${name}(p, ${passed}, k${n});`);
        return { v: `v${n}`, k: `k${n}` };
      }
      case "piecewise": {
        // Every branch is computed, but only the chosen one's value and
        // validity are kept, so an undefined branch that is not chosen cannot
        // leak, which is Desmos's rule: {1<0: √−1, 1} is 1.
        const n = this.fresh();
        this.lines.push(`  float v${n} = 0.0;`);
        this.lines.push(`  bool k${n} = false;`);
        const done = `d${n}`;
        this.lines.push(`  bool ${done} = false;`);
        for (const branch of node.branches) {
          const condition = this.chain(branch.condition);
          const value = this.expr(branch.value);
          this.lines.push(
            `  if (!${done} && ${condition}) { v${n} = ${value.v}; k${n} = ${value.k}; ${done} = true; }`
          );
        }
        if (node.otherwise !== undefined) {
          const otherwise = this.expr(node.otherwise);
          this.lines.push(
            `  if (!${done}) { v${n} = ${otherwise.v}; k${n} = ${otherwise.k}; }`
          );
        }
        return { v: `v${n}`, k: `k${n}` };
      }
    }
  }

  /**
   * A chain's truth as a GLSL boolean. A link holds only when both sides are
   * defined, because Desmos's comparisons with NaN are false.
   */
  chain(chain: Chain): string {
    const terms = chain.terms.map((term) => this.expr(term));
    const n = this.fresh();
    const links = chain.ops.map((op, i) => {
      const a = terms[i];
      const b = terms[i + 1];
      const glslOp = op === "=" ? "==" : op;
      return `(${a.k} && ${b.k} && ${a.v} ${glslOp} ${b.v})`;
    });
    this.lines.push(`  bool c${n} = ${links.join(" && ")};`);
    return `c${n}`;
  }

  anyOf(chains: Chain[]): string {
    const truths = chains.map((chain) => this.chain(chain));
    return `(${truths.join(" || ")})`;
  }

  /**
   * Negative inside, positive outside: the larger of each link's and each
   * restriction's own signed function. See `signedRelation` in `obstacles.ts`
   * for the convention; the two must agree, and a unit test checks they do.
   */
  signedRelation(chain: Chain, restrictions: Chain[][]): Value {
    const parts = [
      this.signedChain(chain),
      ...restrictions.map((any) => this.signedAny(any)),
    ];
    return parts.reduce((a, b) =>
      this.value([a, b], () => `max(${a.v}, ${b.v})`)
    );
  }

  private signedChain(chain: Chain): Value {
    const terms = chain.terms.map((term) => this.expr(term));
    const links = chain.ops.map((op, i) => {
      const a = terms[i];
      const b = terms[i + 1];
      // a < b is solid where a − b < 0; a > b where b − a < 0. Equality has no
      // inside, and a restriction such as {x = 1} measures only its distance.
      const [lo, hi] = op === ">" || op === ">=" ? [b, a] : [a, b];
      const difference = this.arithmetic([lo, hi], `${lo.v} - ${hi.v}`);
      return op === "="
        ? this.value([difference], () => `abs(${difference.v})`)
        : difference;
    });
    return links.reduce((a, b) =>
      this.value([a, b], () => `max(${a.v}, ${b.v})`)
    );
  }

  private signedAny(chains: Chain[]): Value {
    // The region where any chain holds: the smallest of their functions,
    // among those defined. Undefined only if all of them are.
    const parts = chains.map((chain) => this.signedChain(chain));
    if (parts.length === 1) return parts[0];
    const n = this.fresh();
    this.lines.push(`  float v${n} = vsInf();`);
    this.lines.push(`  bool k${n} = false;`);
    for (const part of parts) {
      this.lines.push(
        `  if (${part.k}) { v${n} = min(v${n}, ${part.v}); k${n} = true; }`
      );
    }
    return { v: `v${n}`, k: `k${n}` };
  }

  private builtin(fn: BuiltinName, args: Value[]): Value {
    const [a, b] = args;
    const degrees = this.options.degreeMode;
    const into = (v: string) => (degrees ? `(${v} * ${PI} / 180.0)` : v);
    const out = (v: string) => (degrees ? `(${v} * 180.0 / ${PI})` : v);
    switch (fn) {
      case "sin":
        return this.value([a], () => `sin(${into(a.v)})`);
      case "cos":
        return this.value([a], () => `cos(${into(a.v)})`);
      case "tan":
        return this.value([a], () => `tan(${into(a.v)})`);
      case "cot":
        return this.guarded(
          [a],
          (ok) => `vsDiv(1.0, tan(${into(a.v)}), ${ok})`
        );
      case "sec":
        return this.guarded(
          [a],
          (ok) => `vsDiv(1.0, cos(${into(a.v)}), ${ok})`
        );
      case "csc":
        return this.guarded(
          [a],
          (ok) => `vsDiv(1.0, sin(${into(a.v)}), ${ok})`
        );
      case "arcsin":
        return this.guarded([a], (ok) => out(`vsAsin(${a.v}, ${ok})`));
      case "arccos":
        return this.guarded([a], (ok) => out(`vsAcos(${a.v}, ${ok})`));
      case "arctan":
        return args.length === 2
          ? this.value([a, b], () => out(`vsAtan2(${a.v}, ${b.v})`))
          : this.value([a], () => out(`atan(${a.v})`));
      case "arccot":
        return this.value([a], () => out(`(${PI} / 2.0 - atan(${a.v}))`));
      // Two statements rather than one nested call: passing the same `inout`
      // flag to a call and to its argument leaves the order of the writes to
      // the compiler.
      case "arcsec": {
        const inverse = this.guarded([a], (ok) => `vsDiv(1.0, ${a.v}, ${ok})`);
        return this.guarded([inverse], (ok) =>
          out(`vsAcos(${inverse.v}, ${ok})`)
        );
      }
      case "arccsc": {
        const inverse = this.guarded([a], (ok) => `vsDiv(1.0, ${a.v}, ${ok})`);
        return this.guarded([inverse], (ok) =>
          out(`vsAsin(${inverse.v}, ${ok})`)
        );
      }
      case "sinh":
        return this.value([a], () => `sinh(${a.v})`);
      case "cosh":
        return this.value([a], () => `cosh(${a.v})`);
      case "tanh":
        return this.value([a], () => `tanh(${a.v})`);
      case "coth":
        return this.guarded([a], (ok) => `vsDiv(1.0, tanh(${a.v}), ${ok})`);
      case "sech":
        return this.guarded([a], (ok) => `vsDiv(1.0, cosh(${a.v}), ${ok})`);
      case "csch":
        return this.guarded([a], (ok) => `vsDiv(1.0, sinh(${a.v}), ${ok})`);
      case "arcsinh":
        return this.value([a], () => `asinh(${a.v})`);
      case "arccosh":
        return this.guarded([a], (ok) => `vsAcosh(${a.v}, ${ok})`);
      case "arctanh":
        return this.guarded([a], (ok) => `vsAtanh(${a.v}, ${ok})`);
      case "exp":
        return this.value([a], () => `exp(${a.v})`);
      case "ln":
        return this.guarded([a], (ok) => `vsLn(${a.v}, ${ok})`);
      case "log":
        return this.guarded(
          [a],
          (ok) => `(vsLn(${a.v}, ${ok}) * 0.43429448190325182)`
        );
      case "logbase":
        return this.guarded([a, b], (ok) => `vsLogBase(${a.v}, ${b.v}, ${ok})`);
      case "sqrt":
        return this.guarded([a], (ok) => `vsSqrt(${a.v}, ${ok})`);
      case "nthroot": {
        const inverse = this.guarded([a], (ok) => `vsDiv(1.0, ${a.v}, ${ok})`);
        return this.guarded(
          [b, inverse],
          (ok) => `vsPow(${b.v}, ${inverse.v}, ${ok})`
        );
      }
      case "abs":
        return this.value([a], () => `abs(${a.v})`);
      case "sign":
        return this.value([a], () => `sign(${a.v})`);
      case "floor":
        return this.value([a], () => `floor(${a.v})`);
      case "ceil":
        return this.value([a], () => `ceil(${a.v})`);
      case "round":
        return this.value([a], () => `floor(${a.v} + 0.5)`);
      case "mod":
        return this.guarded([a, b], (ok) => `vsMod(${a.v}, ${b.v}, ${ok})`);
      case "min":
        return args.reduce((x, y) =>
          this.value([x, y], () => `min(${x.v}, ${y.v})`)
        );
      case "max":
        return args.reduce((x, y) =>
          this.value([x, y], () => `max(${x.v}, ${y.v})`)
        );
    }
  }
}

/** A literal GLSL can read, with infinity built from its bits. */
function glslNumber(value: number): string {
  if (Number.isNaN(value)) return "uintBitsToFloat(0x7fc00000u)";
  if (value === Infinity) return "vsInf()";
  if (value === -Infinity) return "(-vsInf())";
  const text = String(value);
  if (/e/i.test(text)) return value.toExponential();
  return text.includes(".") ? text : `${text}.0`;
}
