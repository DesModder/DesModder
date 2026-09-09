/**
 * The four fields Audio Field can draw, and the GLSL each one contributes.
 *
 * A preset is a single function `vec2 field(vec2 p)` spliced into a shared
 * shader. Everything else — integration, respawning, colouring, the uniform
 * block — is common, so a preset cannot get the lifecycle subtly wrong and the
 * only thing that varies between them is the thing that should.
 *
 * Every preset must stay bounded and finite for every normalised input. The
 * shared code clamps the result as a backstop, but a preset that relies on the
 * clamp is a preset whose particles all pile onto the same streamline.
 */

export type PresetId = "pulse" | "vortex" | "flow" | "storm";

export interface Preset {
  readonly id: PresetId;
  readonly name: string;
  /** What a listener should expect to see it react to. */
  readonly description: string;
  /** The body of `vec2 field(vec2 p)`, ending in a return. */
  readonly glsl: string;
}

/**
 * Uniforms every preset may read.
 *
 * Declared once here so the list in the shader, the list the renderer uploads,
 * and the list the specification names cannot drift apart.
 */
export const FIELD_UNIFORMS = [
  "uTime",
  "uRms",
  "uBass",
  "uMid",
  "uTreble",
  "uDominant",
  "uCentroid",
  "uOnset",
  "uBeatPhase",
] as const;

export type FieldUniform = (typeof FIELD_UNIFORMS)[number];

export const PRESETS: readonly Preset[] = [
  {
    id: "pulse",
    name: "Pulse",
    description:
      "Rings travel outward. Bass sets their strength, onsets emit them.",
    glsl: `
      float r = length(p) + 1e-4;
      vec2 outward = p / r;
      // A ring pattern in r, travelling out on the clock rather than on the
      // frame counter, so the speed is the same on any monitor.
      float rings = sin(r * 2.2 - uTime * 3.0 + uBeatPhase * 6.2831);
      float push = rings * (0.35 + 2.4 * uBass) + uOnset * 3.5;
      // A little tangential drift, or every particle runs dead straight out
      // and the field reads as a starfield rather than a wave.
      vec2 swirl = vec2(-outward.y, outward.x) * uMid * 0.8;
      return outward * push + swirl;
    `,
  },
  {
    id: "vortex",
    name: "Vortex",
    description:
      "Rotation with a slow inward drift. Pitch sets the direction, loudness the speed.",
    glsl: `
      float r = length(p) + 1e-4;
      vec2 around = vec2(-p.y, p.x) / r;
      // Below the middle of its range the dominant frequency turns the field
      // the other way, so a bass line and a melody are visibly different.
      float direction = uDominant < 0.5 ? -1.0 : 1.0;
      float spin = direction * (0.6 + 2.0 * uRms) * (0.5 + uDominant);
      // Inward drift balanced against the respawn radius, so the centre neither
      // empties out nor collects every particle in the field.
      float drift = -0.35 * (1.0 - uBass) + uOnset * 1.5;
      return around * spin * r * 0.6 + (p / r) * drift;
    `,
  },
  {
    id: "flow",
    name: "Flow",
    description: "A horizontal stream. Mid energy bends it, bass drives it.",
    glsl: `
      float speed = 0.8 + 2.5 * uBass + 1.2 * uRms;
      // Shear that varies along the stream and in time, which is what makes it
      // read as flowing rather than as a moving grid.
      float shear = sin(p.x * 0.55 + uTime * 0.9) * cos(p.y * 0.7 - uTime * 0.4);
      float lift = shear * (0.4 + 3.0 * uMid) + uOnset * 1.2;
      return vec2(speed, lift);
    `,
  },
  {
    id: "storm",
    name: "Spectrum Storm",
    description:
      "Curl at several scales. Treble adds the fine structure, brightness the colour.",
    glsl: `
      // Three octaves of a cheap divergence-free field. Summed rather than
      // multiplied so a silent band removes its scale instead of flattening
      // the whole field to zero.
      vec2 coarse = vec2(
        sin(p.y * 0.6 + uTime * 0.5),
        cos(p.x * 0.6 - uTime * 0.4)
      ) * (0.6 + 2.0 * uBass);
      vec2 medium = vec2(
        sin(p.y * 1.7 - uTime * 0.9),
        cos(p.x * 1.7 + uTime * 1.1)
      ) * (0.3 + 1.6 * uMid);
      vec2 fine = vec2(
        sin(p.y * 4.3 + uTime * 2.1),
        cos(p.x * 4.3 - uTime * 1.9)
      ) * (0.1 + 1.4 * uTreble);
      return coarse + medium + fine + vec2(uOnset) * 1.5;
    `,
  },
];

export function presetById(id: string): Preset {
  return PRESETS.find((preset) => preset.id === id) ?? PRESETS[0];
}

/**
 * The quality ladder, richest first.
 *
 * `renderScale` is a multiplier on the device pixel ratio: dropping resolution
 * costs less visually than dropping particles, so the ladder spends that first
 * and only then thins the field out.
 */
export interface QualityLevel {
  readonly particles: number;
  readonly renderScale: number;
}

export const QUALITY_LADDER: readonly QualityLevel[] = [
  { particles: 8000, renderScale: 1 },
  { particles: 8000, renderScale: 0.75 },
  { particles: 4000, renderScale: 0.75 },
  { particles: 4000, renderScale: 0.5 },
  { particles: 2000, renderScale: 0.5 },
];

/** 60 FPS target, 30 FPS floor, as the performance budget requires. */
const TARGET_MS = 1000 / 60;
const FLOOR_MS = 1000 / 30;

/**
 * Chooses the next rung after a frame took `frameMs`.
 *
 * Drops immediately when a frame misses the floor, because a stutter is
 * visible at once. Climbs back only from a comfortable margin and only one rung
 * at a time, so a field sitting near a boundary does not oscillate between two
 * levels every second.
 */
export function nextQualityLevel(current: number, frameMs: number) {
  if (!Number.isFinite(frameMs)) return current;
  if (frameMs > FLOOR_MS)
    return Math.min(current + 1, QUALITY_LADDER.length - 1);
  if (frameMs < TARGET_MS * 0.7) return Math.max(current - 1, 0);
  return current;
}
