/**
 * Turns a configuration into the field the renderer draws.
 *
 * The two components arrive as Desmos LaTeX and leave as GLSL, compiled by the
 * shared `latexToGLSL` against an environment that contains exactly the audio
 * variables and nothing else. That restriction is the point: a field expression
 * is evaluated in a vertex and a fragment shader, tens of thousands of times a
 * frame, and cannot call back into Desmos — so anything it references has to be
 * a number this plugin can put in a uniform. A name outside the list is
 * reported by name rather than quietly compiled to zero.
 */
import { RIPPLE_SLOTS, type AudioFieldConfig } from "./model";
import { AUDIO_VARIABLE_NAMES } from "./variables";
import {
  compileFieldComponentToGLSL,
  type FieldEnvironment,
} from "../../../field-rendering/latexToGLSL";
import type {
  FieldDisturbances,
  FlowField,
  FlowOptions,
} from "../../../field-rendering/FlowRenderer";

/**
 * What a field component is allowed to mention.
 *
 * Functions are empty on purpose. Vector Tools compiles against the user's own
 * expression list so a field can reference a function they defined; Audio Lab
 * deliberately does not, because its field is configuration that persists
 * across graphs and a field that silently depends on `g(x)` would stop
 * compiling the moment it was carried to a graph without one.
 */
const AUDIO_ENVIRONMENT: FieldEnvironment = {
  functions: new Map(),
  scalars: AUDIO_VARIABLE_NAMES,
  unknownNameHint:
    "A field here knows x, y, t and the audio variables listed under the boxes, and nothing from the expression list.",
};

export type CompiledAudioField =
  | { ok: true; field: FlowField }
  | { ok: false; error: string; which: "P" | "Q" };

export function compileAudioField(
  config: AudioFieldConfig
): CompiledAudioField {
  const p = compileFieldComponentToGLSL(config.p, AUDIO_ENVIRONMENT);
  if (!p.ok) return { ok: false, error: p.error, which: "P" };
  const q = compileFieldComponentToGLSL(config.q, AUDIO_ENVIRONMENT);
  if (!q.ok) return { ok: false, error: q.error, which: "Q" };

  const disturbances: FieldDisturbances = {
    // Always the same number of slots, whatever the source, so changing what
    // emits a ripple never relinks a program. An emitter that fires nothing
    // leaves every slot at zero strength and the loop skips them all.
    ripples: config.ripples.source === "off" ? 0 : RIPPLE_SLOTS,
    pointer: config.pointer.mode !== "off",
  };

  return {
    ok: true,
    field: {
      kind: "components",
      p: p.glsl,
      q: q.glsl,
      // Merged by name, dependencies first in each. The two components are
      // compiled independently, so a helper used by both arrives twice and
      // would be declared twice in one shader.
      helpers: mergeHelpers(p.helpers, q.helpers),
      params: [...new Set([...p.params, ...q.params])],
      usesTime: p.usesTime || q.usesTime,
      disturbances,
    },
  };
}

function mergeHelpers(
  ...groups: ReadonlyArray<readonly { name: string; glsl: string }[]>
) {
  const seen = new Set<string>();
  const merged: Array<{ name: string; glsl: string }> = [];
  for (const group of groups)
    for (const helper of group) {
      if (seen.has(helper.name)) continue;
      seen.add(helper.name);
      merged.push(helper);
    }
  return merged;
}

/** The drawing settings, as the shared renderer wants them. */
export function flowOptionsFor(config: AudioFieldConfig): FlowOptions {
  const { look } = config;
  return {
    particleCount: look.particleCount,
    speed: look.speed,
    trailPersistence: look.trailPersistence,
    dropRate: look.dropRate,
    pointSize: look.pointSize,
    glow: look.glow,
    backdrop: look.backdrop,
    backdropOpacity: look.backdropOpacity,
    opacity: look.opacity,
    colorMode: look.colorMode,
    palette: look.palette,
    fixedColor: look.fixedColor,
    normalizeSpeed: look.normalizeSpeed,
    renderScale: look.renderScale,
  };
}
