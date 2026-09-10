/**
 * What the expression list currently defines that a field component may use.
 *
 * The GPU cannot call back into Desmos, so `latexToGLSL` compiles against an
 * environment handed to it rather than looking anything up itself. This is what
 * builds that environment: a scan of the expression list for the two shapes a
 * component can actually reference — a named value and a function of numbers.
 *
 * Only names are collected here, never values. A value is read through Desmos's
 * own evaluator when it is needed, so `a = b + 1` works without this having to
 * understand `b`, and a slider that moves does not make this scan stale.
 */
import { canonicalIdentifier, IDENTIFIER_SOURCE } from "./identifiers";
import type { FieldEnvironment, FunctionDefinition } from "./latexToGLSL";

// The grammar lives in identifiers.ts, so the scan and the compiler cannot
// disagree about where one name ends and the next begins.
const IDENTIFIER = IDENTIFIER_SOURCE;

/**
 * Names that already mean something, so `x = 3` is a vertical line rather than
 * a definition of x.
 *
 * `r` and `theta` are Desmos's polar coordinates and `e` is the constant. `t`
 * is left out of this list deliberately: it is the parameter of a parametric
 * curve, but a graph is also perfectly entitled to define it as a slider, and
 * refusing to see that would be guessing at which the user meant.
 */
const RESERVED = new Set(["x", "y", "r", "theta", "e"]);

/** One expression, as much of it as this needs. */
export interface ScannedItem {
  type?: string;
  id?: string;
  latex?: string;
}

const definitionPattern = new RegExp(
  // name, then either a parameter list or nothing, then a single `=`.
  String.raw`^(${IDENTIFIER})(?:\\left\(([^)]*)\\right\)|\(([^)]*)\))?=(.+)$`
);

const parameterListPattern = new RegExp(
  String.raw`^${IDENTIFIER}(?:,${IDENTIFIER})*$`
);

/**
 * Reads the definitions out of an expression list.
 *
 * `ownedPrefix` is the generated field's own namespace. Its helpers are
 * functions of x and y by construction, and letting a component reference one
 * would be circular — the component is what those helpers are built from.
 */
export function scanDefinitions(
  items: readonly ScannedItem[],
  ownedPrefix?: string
): FieldEnvironment {
  const functions = new Map<string, FunctionDefinition>();
  const scalars = new Set<string>();

  for (const item of items) {
    if (item.type !== undefined && item.type !== "expression") continue;
    if (item.latex === undefined) continue;
    if (
      ownedPrefix !== undefined &&
      item.id?.startsWith(ownedPrefix) === true
    ) {
      continue;
    }

    // Whitespace is not meaningful in LaTeX here, and MathQuill sprinkles it.
    const latex = item.latex.replace(/\s+/g, "");
    const match = definitionPattern.exec(latex);
    if (match === null) continue;

    const [, rawName, bracedParams, plainParams, body] = match;
    const name = canonicalIdentifier(rawName);
    if (RESERVED.has(name)) continue;
    if (body.length === 0) continue;

    const rawParams = bracedParams ?? plainParams;
    if (rawParams === undefined) {
      // A value. Anything already defined as a function keeps that meaning:
      // the two cannot both be true, and a graph with both is already broken.
      if (!functions.has(name)) scalars.add(name);
      continue;
    }

    if (!parameterListPattern.test(rawParams)) continue;
    const params = rawParams.split(",").map(canonicalIdentifier);
    // Repeated parameters would make the body's meaning ambiguous, and Desmos
    // does not accept them either.
    if (new Set(params).size !== params.length) continue;

    functions.set(name, { params, latex: body });
    scalars.delete(name);
  }

  return { functions, scalars };
}

/**
 * Whether two environments differ in a way that requires recompiling.
 *
 * A scan runs on every expression-list change, which includes every keystroke
 * in an unrelated expression. Recompiling on each of those would relink both
 * shader programs while somebody types, so the renderers are only told about a
 * scan that could change the compiled output. A value moving is not one of
 * those: values are uniforms.
 */
export function environmentsDiffer(
  a: FieldEnvironment,
  b: FieldEnvironment
): boolean {
  if (a.scalars.size !== b.scalars.size) return true;
  for (const name of a.scalars) if (!b.scalars.has(name)) return true;
  if (a.functions.size !== b.functions.size) return true;
  for (const [name, definition] of a.functions) {
    const other = b.functions.get(name);
    if (other === undefined) return true;
    if (other.latex !== definition.latex) return true;
    if (other.params.length !== definition.params.length) return true;
    for (let i = 0; i < definition.params.length; i++) {
      if (other.params[i] !== definition.params[i]) return true;
    }
  }
  return false;
}
