/**
 * The surfaces a user has graphed in Desmos 3D, found and compiled so the
 * field can be hidden behind them.
 *
 * Desmos's depth lives in its own WebGL context and cannot be read
 * (`DESMOS_3D_CAMERA.md`), so "Hidden" works by redrawing each surface
 * ourselves, depth only, before the field. That needs to know which items are
 * surfaces and what they are, and Desmos says: each item's
 * `formula.expression_type` (verified 2026-10-06, see the build plan §1):
 *
 * - `SURFACE`: `z=f(x,y)`, a bare `f(x,y)`, and a definition `f(x,y)=…`,
 *   which Desmos 3D graphs as a surface too. Redrawn over a grid in x, y.
 * - `SURFACE_AMBIGUOUS`: `x=g(y,z)` or `y=h(x,z)`. Redrawn over the other two.
 * - `SURFACE_xyz_uv`: `(X(u,v), Y(u,v), Z(u,v))`, over the u, v ranges Desmos
 *   reports in `formula.domains`.
 * - `IMPLICIT_SURFACE`: not redrawn yet. It needs a mesher; until then the
 *   field shows through it, and the panel names it.
 *
 * Everything else — curves, points, sliders — hides nothing and is skipped.
 */
import {
  compileFieldComponentToGLSL,
  type CompiledHelper,
  type CompileResult,
  type FieldEnvironment,
} from "./latexToGLSL";

/** The part of a Desmos item model this reads. */
export interface SurfaceItem {
  type: string;
  id: string;
  latex?: string;
  hidden?: boolean;
  formula?: {
    expression_type?: string;
    assignment?: string;
    defined_name?: string;
    domains?: readonly {
      variable: string;
      minNumber?: number;
      maxNumber?: number;
      minValid?: boolean;
      maxValid?: boolean;
    }[];
  };
}

interface Compiled {
  helpers: readonly CompiledHelper[];
  /** Names read from the graph, each a uniform. */
  params: readonly string[];
  usesTime: boolean;
}

/** A surface solved for one coordinate over the other two. */
export interface GraphSurface3D extends Compiled {
  id: string;
  kind: "graph";
  /** The coordinate the expression gives: 0 x, 1 y, 2 z. */
  axis: 0 | 1 | 2;
  body: string;
}

/** A parametric surface over u and v. */
export interface ParametricSurface3D extends Compiled {
  id: string;
  kind: "uv";
  xyz: readonly [string, string, string];
  u: readonly [number, number];
  v: readonly [number, number];
}

export type Surface3D = GraphSurface3D | ParametricSurface3D;

export interface SurfaceScan {
  surfaces: Surface3D[];
  /** Surfaces drawn by Desmos that cannot hide the field, and why. */
  skipped: { id: string; latex: string; reason: string }[];
}

/** What u and v are in a parametric surface; Desmos's default is 0 to 1. */
const PARAMETERS = ["u", "v"] as const;

/** Desmos's names for the three coordinates, in order. */
const AXES = ["x", "y", "z"] as const;

export function scanSurfaces3D(
  items: readonly SurfaceItem[],
  environment: FieldEnvironment
): SurfaceScan {
  const surfaces: Surface3D[] = [];
  const skipped: SurfaceScan["skipped"] = [];
  const space: FieldEnvironment = { ...environment, dimensions: 3 };
  for (const item of items) {
    if (item.type !== "expression" || item.hidden === true) continue;
    const latex = item.latex ?? "";
    const kind = item.formula?.expression_type;
    if (kind === "IMPLICIT_SURFACE") {
      skipped.push({
        id: item.id,
        latex,
        reason: "an implicit surface, which cannot hide the field yet",
      });
      continue;
    }
    if (kind === "SURFACE" || kind === "SURFACE_AMBIGUOUS") {
      const surface = graphSurface(item, latex, space);
      if (typeof surface === "string")
        skipped.push({ id: item.id, latex, reason: surface });
      else surfaces.push(surface);
      continue;
    }
    if (kind === "SURFACE_xyz_uv") {
      const surface = parametricSurface(item, latex, space);
      if (typeof surface === "string")
        skipped.push({ id: item.id, latex, reason: surface });
      else surfaces.push(surface);
    }
  }
  return { surfaces, skipped };
}

function graphSurface(
  item: SurfaceItem,
  latex: string,
  space: FieldEnvironment
): GraphSurface3D | string {
  const sides = splitTopLevel(latex, "=");
  let axis: 0 | 1 | 2 = 2;
  let body = latex;
  if (sides.length === 2) {
    const [left, right] = sides;
    const solved = AXES.indexOf(left.trim() as (typeof AXES)[number]);
    // `z=…`, `x=…`, `y=…`: solved for that coordinate. A definition
    // `f(x,y)=…` is graphed as z = its body.
    axis = solved >= 0 ? (solved as 0 | 1 | 2) : 2;
    body = right;
    if (solved < 0 && item.formula?.defined_name === undefined) {
      return "an equation that is not solved for x, y or z";
    }
  } else if (sides.length > 2) {
    return "more than one equals sign";
  }
  const compiled = compileFieldComponentToGLSL(body, space);
  if (!compiled.ok) return compiled.error;
  return {
    id: item.id,
    kind: "graph",
    axis,
    body: compiled.glsl,
    ...rest(compiled),
  };
}

function parametricSurface(
  item: SurfaceItem,
  latex: string,
  space: FieldEnvironment
): ParametricSurface3D | string {
  const inner = stripTuple(latex);
  const parts = inner === undefined ? [] : splitTopLevel(inner, ",");
  if (parts.length !== 3) return "a parametric surface that is not (X, Y, Z)";
  // u and v become names the compiler knows, bound to locals in the shader.
  const withParameters: FieldEnvironment = {
    ...space,
    scalars: new Set([...space.scalars, ...PARAMETERS]),
  };
  const compiled: CompileResult[] = parts.map((part) =>
    compileFieldComponentToGLSL(part, withParameters)
  );
  const failed = compiled.find((c) => !c.ok);
  if (failed !== undefined && !failed.ok) return failed.error;
  const ok = compiled as Extract<CompileResult, { ok: true }>[];
  const helpers: CompiledHelper[] = [];
  for (const c of ok)
    for (const h of c.helpers)
      if (!helpers.some((existing) => existing.name === h.name))
        helpers.push(h);
  const params = new Set<string>();
  for (const c of ok) for (const p of c.params) params.add(p);
  // u and v are the surface's own parameters, not values the graph binds,
  // unless the graph really does define them, which Desmos 3D does not allow.
  for (const p of PARAMETERS) if (!space.scalars.has(p)) params.delete(p);
  const range = (variable: string): [number, number] => {
    const d = item.formula?.domains?.find((x) => x.variable === variable);
    const min =
      d?.minValid !== false && Number.isFinite(d?.minNumber)
        ? d!.minNumber!
        : 0;
    const max =
      d?.maxValid !== false && Number.isFinite(d?.maxNumber)
        ? d!.maxNumber!
        : 1;
    return [min, max];
  };
  return {
    id: item.id,
    kind: "uv",
    xyz: [ok[0].glsl, ok[1].glsl, ok[2].glsl],
    u: range("u"),
    v: range("v"),
    helpers,
    params: [...params],
    usesTime: ok.some((c) => c.usesTime),
  };
}

function rest(c: Extract<CompileResult, { ok: true }>): Compiled {
  return { helpers: c.helpers, params: c.params, usesTime: c.usesTime };
}

/**
 * Splits at `separator` where no bracket is open. LaTeX's `\left(` and
 * `\right)` contain the brackets themselves, and a restriction's braces are
 * balanced, so counting the characters is enough.
 */
export function splitTopLevel(latex: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < latex.length; i++) {
    const c = latex[i];
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") depth--;
    else if (c === separator && depth === 0) {
      parts.push(latex.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(latex.slice(start));
  return parts;
}

/** The inside of `\left(…\right)` or `(…)`, if that is the whole thing. */
function stripTuple(latex: string): string | undefined {
  const t = latex.trim();
  const open = t.startsWith("\\left(") ? 6 : t.startsWith("(") ? 1 : -1;
  const close = t.endsWith("\\right)") ? 7 : t.endsWith(")") ? 1 : -1;
  if (open < 0 || close < 0) return undefined;
  const inner = t.slice(open, t.length - close);
  // The outer brackets have to be one pair, not `(a)(b)`.
  return splitTopLevel(inner, "\u0000").length === 1 && balanced(inner)
    ? inner
    : undefined;
}

function balanced(s: string) {
  let depth = 0;
  for (const c of s) {
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") depth--;
    if (depth < 0) return false;
  }
  return depth === 0;
}

/** Whether two scans would draw the same depth. */
export function sameSurfaces(a: SurfaceScan, b: SurfaceScan) {
  return JSON.stringify(a) === JSON.stringify(b);
}
