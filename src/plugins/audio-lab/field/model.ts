/**
 * What the audio field is, as data.
 *
 * The whole configuration is plain JSON with a schema version, because it is
 * persisted through the plugin-settings mechanism and has to survive being read
 * back by a later build. Nothing here is GLSL: the two components are Desmos
 * LaTeX, compiled on the way to the GPU, which is what makes a preset something
 * a person can read and edit rather than a string baked into the bundle.
 */
import { PALETTE_IDS, type PaletteID } from "../../../field-rendering/palettes";
import type { FlowColorMode } from "../../../field-rendering/types";

export const AUDIO_FIELD_SCHEMA_VERSION = 2;

/**
 * How many ripples may be in the air at once.
 *
 * Fixed rather than configurable, and that is deliberate: the slot count is a
 * uniform array length, so it is part of the shader and changing it relinks two
 * programs. A constant means no arrangement of the panel's controls can ever
 * cost a relink, and twenty-four rings is already more than reads as rings.
 */
export const RIPPLE_SLOTS = 24;

/** Where a ripple starts. */
export type RippleOrigin = "centre" | "scatter" | "pointer" | "spectrum";

/** What makes one. */
export type RippleSource = "onset" | "beat" | "off";

export interface RippleConfig {
  source: RippleSource;
  origin: RippleOrigin;
  /** Graph units per second the crest travels outward. */
  speed: number;
  /** Graph units between crests. */
  wavelength: number;
  /** Seconds a ripple takes to fade out. */
  lifetime: number;
  /** How hard the crest pushes. Negative pulls instead. */
  strength: number;
}

/** What the cursor does to the field while it is over the graph. */
export type PointerMode = "off" | "push" | "pull" | "swirl";

export interface PointerConfig {
  mode: PointerMode;
  strength: number;
  /** Graph units the influence reaches. */
  radius: number;
  /** Whether clicking the graph drops a ripple by hand. */
  clickRipples: boolean;
}

/** Everything about how the field is drawn rather than what it is. */
export interface FieldLook {
  particleCount: number;
  /** How much of the previous frame survives. This is the stream's length. */
  trailPersistence: number;
  speed: number;
  dropRate: number;
  pointSize: number;
  glow: number;
  opacity: number;
  colorMode: FlowColorMode;
  palette: PaletteID;
  fixedColor: string;
  normalizeSpeed: boolean;
  renderScale: number;
  backdrop: string;
  backdropOpacity: number;
}

export interface AudioFieldConfig {
  schemaVersion: number;
  /** Which preset this came from, or "custom" once it stops matching one. */
  presetId: string;
  /** The x component, as Desmos LaTeX over x and y. */
  p: string;
  /** The y component. */
  q: string;
  ripples: RippleConfig;
  pointer: PointerConfig;
  look: FieldLook;
}

/**
 * A named starting point.
 *
 * Every one of these is a full configuration rather than a field expression
 * with defaults around it, because what makes Pulse look like Pulse is as much
 * the trail length and the ripple speed as the two components. A preset that
 * only set the expression would look like whichever preset you happened to be
 * on before.
 */
export interface AudioFieldPreset {
  readonly id: string;
  readonly name: string;
  /** What a listener should expect to see it react to. */
  readonly description: string;
  readonly config: Omit<AudioFieldConfig, "schemaVersion" | "presetId">;
}

const BASE_LOOK: FieldLook = {
  particleCount: 12_000,
  trailPersistence: 0.94,
  speed: 1,
  dropRate: 0.012,
  pointSize: 2,
  glow: 0.45,
  opacity: 0.42,
  colorMode: "speed",
  palette: "spectral",
  fixedColor: "#2d70b3",
  normalizeSpeed: true,
  renderScale: 1,
  backdrop: "",
  backdropOpacity: 0.9,
};

const BASE_POINTER: PointerConfig = {
  mode: "push",
  strength: 3,
  radius: 2.5,
  clickRipples: true,
};

/**
 * The default stream, and the reason the whole feature reads the way it does.
 *
 * A constant `P` with a sheared `Q` is the smallest thing that looks like
 * flowing water rather than a moving grid: every particle travels the same way,
 * and the cross-current that varies along the stream and in time is what gives
 * the trails their braid. Bass drives it forward and mid energy bends it, so a
 * track with a groove pushes and a track with a melody meanders.
 */
export const AUDIO_FIELD_PRESETS: readonly AudioFieldPreset[] = [
  {
    id: "stream",
    name: "Stream",
    description:
      "A current flowing left to right. Bass drives it, mids bend it, and every hit drops a ring into it.",
    config: {
      p: "1.4+2.6B_{audio}",
      q: "0.8\\sin(0.55x-1.1t)\\cos(0.7y+0.4t)(0.35+3M_{audio})",
      ripples: {
        source: "onset",
        origin: "scatter",
        speed: 3.2,
        wavelength: 1.6,
        lifetime: 2.4,
        strength: 2.6,
      },
      pointer: { ...BASE_POINTER },
      look: { ...BASE_LOOK, trailPersistence: 0.95 },
    },
  },
  {
    id: "pulse",
    name: "Pulse",
    description:
      "Everything travels outward from the middle. Bass sets the push, onsets emit the rings.",
    config: {
      // Normalised radially, with an epsilon under the root so the origin is a
      // finite point rather than a division by zero.
      p: "\\frac{x}{\\sqrt{x^{2}+y^{2}+0.05}}(0.4+3.2B_{audio})-0.7y\\cdot M_{audio}",
      q: "\\frac{y}{\\sqrt{x^{2}+y^{2}+0.05}}(0.4+3.2B_{audio})+0.7x\\cdot M_{audio}",
      ripples: {
        source: "onset",
        origin: "centre",
        speed: 4.5,
        wavelength: 1.2,
        lifetime: 2.2,
        strength: 3.4,
      },
      pointer: { ...BASE_POINTER, mode: "pull", strength: 2.5 },
      look: { ...BASE_LOOK, trailPersistence: 0.92, palette: "ember" },
    },
  },
  {
    id: "vortex",
    name: "Vortex",
    description:
      "Rotation with a drift inward. Loudness sets the speed, brightness the direction of the drift.",
    config: {
      p: "-y(0.5+2A_{audio})-0.45x(1-S_{audio})",
      q: "x(0.5+2A_{audio})-0.45y(1-S_{audio})",
      ripples: {
        source: "beat",
        origin: "centre",
        speed: 3,
        wavelength: 2.2,
        lifetime: 3,
        strength: 2,
      },
      pointer: { ...BASE_POINTER, mode: "swirl", strength: 4 },
      look: { ...BASE_LOOK, trailPersistence: 0.96, palette: "ocean" },
    },
  },
  {
    id: "storm",
    name: "Spectrum storm",
    description:
      "Curl at three scales, one per band. A silent band removes its scale rather than flattening the field.",
    config: {
      // Summed rather than multiplied, so a band going quiet takes its own
      // octave out and leaves the others turning.
      p: "\\sin(0.6y+0.5t)(0.6+2B_{audio})+\\sin(1.7y-0.9t)(0.3+1.6M_{audio})+\\sin(4.3y+2.1t)(0.1+1.4T_{audio})",
      q: "\\cos(0.6x-0.4t)(0.6+2B_{audio})+\\cos(1.7x+1.1t)(0.3+1.6M_{audio})+\\cos(4.3x-1.9t)(0.1+1.4T_{audio})",
      ripples: {
        source: "onset",
        origin: "spectrum",
        speed: 5,
        wavelength: 0.9,
        lifetime: 1.6,
        strength: 2.2,
      },
      pointer: { ...BASE_POINTER, strength: 4 },
      look: { ...BASE_LOOK, trailPersistence: 0.9, palette: "turbo" },
    },
  },
  {
    id: "still",
    name: "Still water",
    description:
      "Almost no current. Nearly everything the particles do is the ripples, which is the clearest way to see what one is.",
    config: {
      // Almost, and not quite, nothing — and the "almost" is load-bearing.
      //
      // `P = Q = 0` draws nothing at all. The renderer respawns any particle
      // whose step rounds to zero, because a field with a genuine fixed point
      // in it would otherwise collect particles there forever, and a particle
      // fades in over its first several frames. With no current, every particle
      // outside a ripple is respawned on every frame and none of them ever
      // lives long enough to become visible: a blank canvas that reports no
      // error, which is the worst way for this to fail.
      //
      // A very slow wander is enough to keep them alive, and slow enough that
      // what you see is still the rings.
      p: "0.09\\sin(0.35y+0.15t)+0.04",
      q: "0.09\\cos(0.35x-0.15t)+0.04",
      ripples: {
        source: "onset",
        origin: "scatter",
        speed: 3,
        wavelength: 1.4,
        lifetime: 3.5,
        strength: 4,
      },
      pointer: { ...BASE_POINTER, strength: 2 },
      look: {
        ...BASE_LOOK,
        trailPersistence: 0.9,
        // The current carries almost nothing away, so the respawn rate is what
        // keeps the field from settling into a fixed pattern of dots.
        dropRate: 0.03,
        // Drawn at the field's own magnitude rather than at a constant speed,
        // which is the whole point here: a particle a ring has just passed
        // through should visibly move further than one it has not reached.
        normalizeSpeed: false,
        speed: 1.4,
      },
    },
  },
];

/**
 * A deep copy, through JSON.
 *
 * The configuration is plain JSON by definition — it has to be, because it is
 * persisted as a string — so this is not a compromise on a structural clone but
 * the same thing, and it works in every environment the tests run in.
 */
export function cloneAudioFieldConfig(
  config: AudioFieldConfig
): AudioFieldConfig {
  return JSON.parse(JSON.stringify(config)) as AudioFieldConfig;
}

export function presetById(id: string) {
  return (
    AUDIO_FIELD_PRESETS.find((preset) => preset.id === id) ??
    AUDIO_FIELD_PRESETS[0]
  );
}

export function configFromPreset(id: string): AudioFieldConfig {
  const preset = presetById(id);
  return {
    schemaVersion: AUDIO_FIELD_SCHEMA_VERSION,
    presetId: preset.id,
    p: preset.config.p,
    q: preset.config.q,
    ripples: { ...preset.config.ripples },
    pointer: { ...preset.config.pointer },
    look: { ...preset.config.look },
  };
}

export const DEFAULT_AUDIO_FIELD_CONFIG = () => configFromPreset("stream");

const clamp = (value: unknown, low: number, high: number, fallback: number) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(Math.max(number, low), high);
};

const oneOf = <T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T
): T => (allowed.includes(value as T) ? (value as T) : fallback);

const text = (value: unknown, fallback: string) =>
  typeof value === "string" && value.trim() !== "" ? value : fallback;

const HEX = /^#[0-9a-fA-F]{6}$/;
const colour = (value: unknown, fallback: string) =>
  typeof value === "string" && (value === "" || HEX.test(value))
    ? value
    : fallback;

/**
 * Brings anything that was stored into the shape this build expects.
 *
 * Every field is checked rather than spread, because what comes back out of
 * settings is whatever a previous build wrote plus whatever a person editing
 * their stored settings by hand put there. A configuration that half-validates
 * is a shader that fails to compile in front of the user, with nothing in the
 * message to say which control caused it.
 *
 * It must round-trip: `normalize(normalize(x))` has to equal `normalize(x)`,
 * because the plugin compares the serialised configuration against what is
 * stored on every start, and one that does not settle writes a setting on every
 * page load.
 */
export function normalizeAudioFieldConfig(raw: unknown): AudioFieldConfig {
  const base = DEFAULT_AUDIO_FIELD_CONFIG();
  if (raw === null || typeof raw !== "object") return base;
  const input = raw as Record<string, unknown>;
  const ripples = (input.ripples ?? {}) as Record<string, unknown>;
  const pointer = (input.pointer ?? {}) as Record<string, unknown>;
  const look = (input.look ?? {}) as Record<string, unknown>;
  return {
    schemaVersion: AUDIO_FIELD_SCHEMA_VERSION,
    presetId: text(input.presetId, base.presetId),
    p: text(input.p, base.p),
    q: text(input.q, base.q),
    ripples: {
      source: oneOf(
        ripples.source,
        ["onset", "beat", "off"] as const,
        base.ripples.source
      ),
      origin: oneOf(
        ripples.origin,
        ["centre", "scatter", "pointer", "spectrum"] as const,
        base.ripples.origin
      ),
      speed: clamp(ripples.speed, 0, 40, base.ripples.speed),
      wavelength: clamp(ripples.wavelength, 0.05, 20, base.ripples.wavelength),
      lifetime: clamp(ripples.lifetime, 0.1, 15, base.ripples.lifetime),
      strength: clamp(ripples.strength, -20, 20, base.ripples.strength),
    },
    pointer: {
      mode: oneOf(
        pointer.mode,
        ["off", "push", "pull", "swirl"] as const,
        base.pointer.mode
      ),
      strength: clamp(pointer.strength, 0, 20, base.pointer.strength),
      radius: clamp(pointer.radius, 0.1, 40, base.pointer.radius),
      clickRipples: pointer.clickRipples !== false,
    },
    look: {
      particleCount: Math.round(
        clamp(look.particleCount, 500, 60_000, base.look.particleCount)
      ),
      trailPersistence: clamp(
        look.trailPersistence,
        0,
        0.995,
        base.look.trailPersistence
      ),
      speed: clamp(look.speed, 0.05, 6, base.look.speed),
      dropRate: clamp(look.dropRate, 0, 0.5, base.look.dropRate),
      pointSize: clamp(look.pointSize, 0.5, 10, base.look.pointSize),
      glow: clamp(look.glow, 0, 1, base.look.glow),
      opacity: clamp(look.opacity, 0.02, 1, base.look.opacity),
      colorMode: oneOf(
        look.colorMode,
        ["speed", "direction", "fixed"] as const,
        base.look.colorMode
      ),
      // Against the renderer's own list rather than a copy of it, so adding a
      // ramp there cannot leave a stored configuration rejecting it here.
      palette: oneOf(look.palette, PALETTE_IDS, base.look.palette),
      fixedColor: colour(look.fixedColor, base.look.fixedColor),
      normalizeSpeed: look.normalizeSpeed !== false,
      renderScale: clamp(look.renderScale, 0.25, 1, base.look.renderScale),
      backdrop: colour(look.backdrop, base.look.backdrop),
      backdropOpacity: clamp(
        look.backdropOpacity,
        0,
        1,
        base.look.backdropOpacity
      ),
    },
  };
}

/** Whether a configuration still matches the preset it names. */
export function matchesPreset(config: AudioFieldConfig) {
  const preset = AUDIO_FIELD_PRESETS.find(
    (item) => item.id === config.presetId
  );
  if (preset === undefined) return false;
  return config.p === preset.config.p && config.q === preset.config.q;
}
