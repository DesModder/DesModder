/**
 * Runs a compiled field component on the CPU, for the mock-up's measurements.
 *
 * The arrows themselves are evaluated on the GPU, which cannot report back what
 * it computed without a readback pass per frame. The numbers the panel shows —
 * how many arrows run into the end of the colour ramp, how far our redrawn
 * surface strays from the true one — only need the same expression evaluated a
 * few thousand times on a change, so the GLSL the real compiler produced is
 * rewritten into JavaScript here. It is the same string the shader runs, so
 * the two cannot disagree about what was typed.
 */
import type { CompileResult } from "../../../src/field-rendering/latexToGLSL";

const MATH: Record<string, (...args: number[]) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: (a, b) => (b === undefined ? Math.atan(a) : Math.atan2(a, b)),
  sinh: Math.sinh,
  cosh: Math.cosh,
  tanh: Math.tanh,
  asinh: Math.asinh,
  acosh: Math.acosh,
  atanh: Math.atanh,
  exp: Math.exp,
  log: Math.log,
  sqrt: Math.sqrt,
  abs: Math.abs,
  sign: Math.sign,
  floor: Math.floor,
  ceil: Math.ceil,
  min: Math.min,
  max: Math.max,
  mod: (a, b) => a - b * Math.floor(a / b),
  clamp: (v, lo, hi) => Math.min(hi, Math.max(lo, v)),
  vtPow: (base, power) => {
    if (base > 0) return Math.exp(power * Math.log(base));
    if (base === 0) return power === 0 ? 1 : 0;
    const rounded = Math.floor(power + 0.5);
    if (Math.abs(power - rounded) > 1e-6) return 0;
    const magnitude = Math.exp(power * Math.log(-base));
    return Math.abs(rounded) % 2 < 0.5 ? magnitude : -magnitude;
  },
  vtDiv: (a, b) => a / (Math.abs(b) < 1e-12 ? (b < 0 ? -1e-12 : 1e-12) : b),
  vtCot: (a) =>
    Math.cos(a) / (Math.abs(Math.sin(a)) < 1e-12 ? 1e-12 : Math.sin(a)),
  vtSec: (a) => 1 / (Math.abs(Math.cos(a)) < 1e-12 ? 1e-12 : Math.cos(a)),
  vtCsc: (a) => 1 / (Math.abs(Math.sin(a)) < 1e-12 ? 1e-12 : Math.sin(a)),
  vtLog10: Math.log10,
  vtMod: (a, b) => (b === 0 ? 0 : a - b * Math.floor(a / b)),
  vtUndefined: () => NaN,
  vtCoth: (a) => 1 / (Math.abs(Math.tanh(a)) < 1e-12 ? 1e-12 : Math.tanh(a)),
  vtCsch: (a) => 1 / (Math.abs(Math.sinh(a)) < 1e-12 ? 1e-12 : Math.sinh(a)),
};

function expressionToJs(glsl: string) {
  return glsl
    .replace(/\bp\.x\b/g, "p[0]")
    .replace(/\bp\.y\b/g, "p[1]")
    .replace(/\bp\.z\b/g, "p[2]");
}

function helperToJs(glsl: string) {
  // float vtu_f(vec3 p, float vl_u) { return BODY; }
  const match = /^float (\w+)\(([^)]*)\) \{ return ([\s\S]*); \}$/.exec(glsl);
  if (match === null) throw new Error(`Cannot run helper: ${glsl}`);
  const params = match[2]
    .split(",")
    .map((param) => param.trim().split(/\s+/)[1]);
  return `function ${match[1]}(${params.join(", ")}) { return ${expressionToJs(match[3])}; }`;
}

/** A compiled component as a function of a point, or undefined if it failed. */
export function runnable(
  result: CompileResult
): ((p: readonly number[]) => number) | undefined {
  if (!result.ok) return undefined;
  const names = Object.keys(MATH);
  const body = [
    ...result.helpers.map((helper) => helperToJs(helper.glsl)),
    `return (${expressionToJs(result.glsl)});`,
  ].join("\n");
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const make = new Function(...names, `return function (p) {\n${body}\n};`);
  return make(...names.map((name) => MATH[name])) as (
    p: readonly number[]
  ) => number;
}
