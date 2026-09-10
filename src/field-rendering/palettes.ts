/**
 * The color ramps, defined once and emitted for both places that draw a field.
 *
 * The generated arrows are colored by a Desmos expression and the flow
 * visualizer by a shader, so a ramp written twice is a ramp that drifts. Both
 * are built here from the same stops, by the same formula.
 *
 * ## Why stops rather than a formula per palette
 *
 * The ramps this replaces were straight lines in RGB — `sequential-a` ran
 * `rgb(35+210t, 75+130t, 155-95t)`, a single segment from dark blue to yellow.
 * A straight line between two hues in RGB passes through the desaturated middle
 * of the cube, so every one of those ramps went through mud at t=0.5 and the
 * arrows read as flat olive. Interpolating through chosen waypoints is what
 * keeps a ramp saturated the whole way along, and it is how the palettes people
 * actually use — viridis and its family — are defined.
 */

/** A color the ramp passes through, at a position along it. */
export interface PaletteStop {
  /** Position in 0..1. Stops are in ascending order and span the full range. */
  at: number;
  /** 0..255, the range both Desmos's `rgb` and a hex color are written in. */
  rgb: readonly [number, number, number];
}

export type PaletteID =
  | "spectral"
  | "sequential-a"
  | "sequential-b"
  | "turbo"
  | "plasma"
  | "magma"
  | "cividis"
  | "jet"
  | "blue-red"
  | "coolwarm"
  | "grayscale"
  | "sunset"
  | "ocean"
  | "ember"
  | "neon"
  | "direction-hue"
  | "twilight"
  | "phase";

/**
 * Which shelf a palette belongs on in the picker.
 *
 * There are enough ramps now that one flat row of chips is a wall to read
 * rather than a choice to make, and the four groups are the question the user
 * is actually answering: do I want the conventional one, one that separates a
 * sign, one that wraps, or one that simply looks the way I want.
 */
export type PaletteGroup = "sequential" | "diverging" | "cyclic" | "expressive";

export const PALETTE_GROUPS: readonly {
  id: PaletteGroup;
  label: string;
}[] = [
  { id: "sequential", label: "Sequential" },
  { id: "diverging", label: "Diverging" },
  { id: "cyclic", label: "Cyclic" },
  { id: "expressive", label: "Expressive" },
];

export interface Palette {
  name: string;
  group: PaletteGroup;
  /** Undefined for a palette that is not a ramp at all; see `direction-hue`. */
  stops?: readonly PaletteStop[];
  /**
   * True when the ramp's two ends are the same colour, so it can be walked
   * round without a seam.
   *
   * This is what makes a palette honest for `direction`, where the value being
   * coloured is an angle: 359° and 1° are neighbours, and a ramp whose ends do
   * not meet draws a hard edge across the field along whichever ray happens to
   * be zero.
   */
  cyclic?: boolean;
}

export const PALETTES: Record<PaletteID, Palette> = {
  /**
   * Blue to teal to yellow to red, the ramp a vector field is usually drawn
   * with. Already what the flow visualizer used for speed, now shared.
   */
  spectral: {
    name: "Spectral",
    group: "sequential",
    stops: [
      { at: 0, rgb: [38, 77, 173] },
      { at: 0.35, rgb: [41, 173, 158] },
      { at: 0.7, rgb: [242, 179, 51] },
      { at: 1, rgb: [217, 61, 56] },
    ],
  },
  /** Viridis, which is perceptually even and readable to color-blind eyes. */
  "sequential-a": {
    name: "Viridis",
    group: "sequential",
    stops: [
      { at: 0, rgb: [68, 1, 84] },
      { at: 0.25, rgb: [59, 82, 139] },
      { at: 0.5, rgb: [33, 145, 140] },
      { at: 0.75, rgb: [94, 201, 98] },
      { at: 1, rgb: [253, 231, 37] },
    ],
  },
  /** A single-hue ramp, for a field that should not shout. */
  "sequential-b": {
    name: "Blue",
    group: "sequential",
    stops: [
      { at: 0, rgb: [8, 29, 88] },
      { at: 0.5, rgb: [34, 94, 168] },
      { at: 1, rgb: [127, 205, 255] },
    ],
  },
  /**
   * Turbo, Google's replacement for jet: the same rainbow sweep people read
   * fluently, without the bands of false detail jet invents at cyan and yellow.
   * The most stops of any ramp here, and so the one that sets the shader's
   * array size.
   */
  turbo: {
    name: "Turbo",
    group: "sequential",
    stops: [
      { at: 0, rgb: [48, 18, 59] },
      { at: 0.14, rgb: [66, 120, 240] },
      { at: 0.29, rgb: [39, 181, 225] },
      { at: 0.43, rgb: [49, 231, 153] },
      { at: 0.57, rgb: [149, 255, 64] },
      { at: 0.71, rgb: [231, 222, 38] },
      { at: 0.86, rgb: [253, 141, 39] },
      { at: 1, rgb: [122, 4, 3] },
    ],
  },
  plasma: {
    name: "Plasma",
    group: "sequential",
    stops: [
      { at: 0, rgb: [13, 8, 135] },
      { at: 0.25, rgb: [126, 3, 168] },
      { at: 0.5, rgb: [204, 71, 120] },
      { at: 0.75, rgb: [248, 149, 64] },
      { at: 1, rgb: [240, 249, 33] },
    ],
  },
  /** Near-black at the bottom, so a quiet region of the field stays quiet. */
  magma: {
    name: "Magma",
    group: "sequential",
    stops: [
      { at: 0, rgb: [0, 0, 4] },
      { at: 0.25, rgb: [81, 18, 124] },
      { at: 0.5, rgb: [183, 55, 121] },
      { at: 0.75, rgb: [252, 137, 97] },
      { at: 1, rgb: [252, 253, 191] },
    ],
  },
  /** Built to survive both common forms of red-green colour blindness. */
  cividis: {
    name: "Cividis",
    group: "sequential",
    stops: [
      { at: 0, rgb: [0, 32, 76] },
      { at: 0.25, rgb: [28, 71, 117] },
      { at: 0.5, rgb: [96, 109, 116] },
      { at: 0.75, rgb: [158, 150, 109] },
      { at: 1, rgb: [253, 231, 55] },
    ],
  },
  /**
   * The classic. It is perceptually poor — it invents edges where the field is
   * smooth — but it is what decades of fluid-dynamics figures used, and a plot
   * meant to sit beside one of those should be able to match it.
   */
  jet: {
    name: "Jet (classic)",
    group: "sequential",
    stops: [
      { at: 0, rgb: [0, 0, 131] },
      { at: 0.125, rgb: [0, 60, 170] },
      { at: 0.375, rgb: [5, 255, 255] },
      { at: 0.625, rgb: [255, 255, 0] },
      { at: 0.875, rgb: [250, 0, 0] },
      { at: 1, rgb: [128, 0, 0] },
    ],
  },
  /**
   * Diverging, and therefore light in the middle rather than dark: the neutral
   * value is the one that should recede.
   */
  "blue-red": {
    name: "Blue to red",
    group: "diverging",
    stops: [
      { at: 0, rgb: [33, 102, 172] },
      { at: 0.5, rgb: [247, 247, 247] },
      { at: 1, rgb: [178, 24, 43] },
    ],
  },
  /**
   * Moreland's cool-warm, the diverging ramp that keeps an even lightness on
   * both arms. That evenness is what a signed quantity needs — divergence and
   * curl are the ones coming — because it stops one sign looking stronger than
   * the other purely by being darker.
   */
  coolwarm: {
    name: "Cool to warm",
    group: "diverging",
    stops: [
      { at: 0, rgb: [59, 76, 192] },
      { at: 0.5, rgb: [221, 221, 221] },
      { at: 1, rgb: [180, 4, 38] },
    ],
  },
  grayscale: {
    name: "Grayscale",
    group: "sequential",
    stops: [
      { at: 0, rgb: [30, 30, 30] },
      { at: 1, rgb: [240, 240, 240] },
    ],
  },
  sunset: {
    name: "Sunset",
    group: "expressive",
    stops: [
      { at: 0, rgb: [35, 17, 72] },
      { at: 0.3, rgb: [129, 41, 110] },
      { at: 0.6, rgb: [226, 90, 86] },
      { at: 0.85, rgb: [249, 163, 80] },
      { at: 1, rgb: [255, 232, 150] },
    ],
  },
  ocean: {
    name: "Ocean",
    group: "expressive",
    stops: [
      { at: 0, rgb: [2, 18, 54] },
      { at: 0.35, rgb: [3, 80, 120] },
      { at: 0.7, rgb: [38, 160, 167] },
      { at: 1, rgb: [160, 231, 206] },
    ],
  },
  ember: {
    name: "Ember",
    group: "expressive",
    stops: [
      { at: 0, rgb: [10, 4, 8] },
      { at: 0.3, rgb: [120, 20, 20] },
      { at: 0.6, rgb: [230, 90, 15] },
      { at: 0.85, rgb: [250, 190, 60] },
      { at: 1, rgb: [255, 247, 214] },
    ],
  },
  neon: {
    name: "Neon",
    group: "expressive",
    stops: [
      { at: 0, rgb: [15, 2, 40] },
      { at: 0.3, rgb: [120, 10, 180] },
      { at: 0.6, rgb: [240, 30, 140] },
      { at: 0.8, rgb: [60, 240, 220] },
      { at: 1, rgb: [230, 255, 120] },
    ],
  },
  /**
   * The hue wheel, which is a cycle rather than a ramp — it has no ends to
   * interpolate between, so it is emitted as `hsv` instead of from stops.
   */
  "direction-hue": { name: "Hue wheel", group: "cyclic", cyclic: true },
  /**
   * Twilight: dark through both halves and pale where they meet, so a direction
   * and its opposite are told apart by hue rather than by brightness.
   */
  twilight: {
    name: "Twilight",
    group: "cyclic",
    cyclic: true,
    stops: [
      { at: 0, rgb: [226, 217, 226] },
      { at: 0.15, rgb: [140, 160, 215] },
      { at: 0.3, rgb: [70, 95, 175] },
      { at: 0.45, rgb: [48, 45, 100] },
      { at: 0.6, rgb: [95, 38, 78] },
      { at: 0.75, rgb: [175, 75, 88] },
      { at: 0.9, rgb: [216, 152, 152] },
      { at: 1, rgb: [226, 217, 226] },
    ],
  },
  /**
   * A saturated wheel through six hues, louder than `direction-hue` and easier
   * to read a rotation off at a glance.
   */
  phase: {
    name: "Phase",
    group: "cyclic",
    cyclic: true,
    stops: [
      { at: 0, rgb: [255, 64, 64] },
      { at: 0.17, rgb: [255, 214, 51] },
      { at: 0.33, rgb: [77, 219, 84] },
      { at: 0.5, rgb: [58, 217, 217] },
      { at: 0.67, rgb: [72, 94, 240] },
      { at: 0.83, rgb: [219, 71, 219] },
      { at: 1, rgb: [255, 64, 64] },
    ],
  },
};

export const PALETTE_IDS = Object.keys(PALETTES) as PaletteID[];

/** The most stops any palette has, which is what the shader has room for. */
export const MAX_PALETTE_STOPS = 8;

export function paletteStops(id: PaletteID): readonly PaletteStop[] {
  return PALETTES[id].stops ?? PALETTES.spectral.stops!;
}

/** The hue wheel evaluated on the CPU, matching `vtHueRamp` in the shader. */
function hueRamp(hue: number): [number, number, number] {
  const channel = (offset: number) => {
    const k = (((hue * 6 + offset) % 6) + 6) % 6;
    return Math.round(255 * Math.min(Math.max(Math.min(k, 4 - k), 0), 1));
  };
  return [channel(0), channel(4), channel(2)];
}

/**
 * The same ramp again, as a CSS `linear-gradient`, so the picker can show what
 * a palette looks like instead of naming it.
 *
 * This is the third place a ramp is emitted, and it is built from the same
 * stops as the other two for the reason stated at the top of this file: a ramp
 * written out by hand a second time is a ramp that drifts, and a swatch that
 * disagrees with the field is worse than no swatch at all. The hue wheel has no
 * stops to walk, so it is sampled from the same formula the shader uses.
 */
export function paletteCSSGradient(id: PaletteID): string {
  const rgb = (color: readonly [number, number, number], at: number) =>
    `rgb(${color[0]},${color[1]},${color[2]}) ${Math.round(at * 100)}%`;
  const stops =
    PALETTES[id].stops === undefined
      ? Array.from({ length: 13 }, (_, i) => {
          const at = i / 12;
          return rgb(hueRamp(at), at);
        })
      : paletteStops(id).map((stop) => rgb(stop.rgb, stop.at));
  return `linear-gradient(to right, ${stops.join(", ")})`;
}

/**
 * One channel of a ramp, as a starting value plus one clamped segment per stop.
 *
 * Each segment contributes nothing before its stop and its full difference
 * after, so the sum is the piecewise-linear interpolation — written without a
 * conditional, which neither Desmos nor a shader wants inside a hot expression.
 */
function channelTerms(
  stops: readonly PaletteStop[],
  channel: 0 | 1 | 2,
  ramp: (from: number, to: number) => string
): { base: number; terms: { delta: number; ramp: string }[] } {
  const base = stops[0].rgb[channel];
  const terms = [];
  for (let i = 1; i < stops.length; i++) {
    const delta = stops[i].rgb[channel] - stops[i - 1].rgb[channel];
    if (delta === 0) continue;
    terms.push({ delta, ramp: ramp(stops[i - 1].at, stops[i].at) });
  }
  return { base, terms };
}

/**
 * The palette as a Desmos `rgb(...)` expression over `t`, which the caller has
 * already clamped to 0..1.
 *
 * `number` formats a value the way the rest of the generated folder does, so
 * the color list still reads like something a person wrote.
 */
export function paletteLatex(
  id: PaletteID,
  t: string,
  number: (value: number) => string
): string {
  if (id === "direction-hue") {
    return `\\operatorname{hsv}\\left(360\\left(${t}\\right),0.82,0.9\\right)`;
  }
  const stops = paletteStops(id);
  const ramp = (from: number, to: number) =>
    `\\min\\left(1,\\max\\left(0,\\left(${t}-${number(from)}\\right)/${number(
      to - from
    )}\\right)\\right)`;
  const channel = (index: 0 | 1 | 2) => {
    const { base, terms } = channelTerms(stops, index, ramp);
    return terms.reduce(
      (out, term) =>
        `${out}${term.delta < 0 ? "-" : "+"}${number(
          Math.abs(term.delta)
        )}\\left(${term.ramp}\\right)`,
      number(base)
    );
  };
  return `\\operatorname{rgb}\\left(${channel(0)},${channel(1)},${channel(
    2
  )}\\right)`;
}

/**
 * Built once per palette and kept.
 *
 * Both renderers call `paletteUniforms` from inside their frame paths, so this
 * was allocating two typed arrays per frame per renderer for a result that only
 * changes when somebody clicks a different swatch. The arrays are shared, so a
 * caller must upload them rather than write into them — which is all either
 * renderer does with them.
 */
const uniformCache = new Map<PaletteID, ReturnType<typeof buildUniforms>>();

/** The stops as shader uniforms, padded to the fixed array the shader declares. */
export function paletteUniforms(id: PaletteID) {
  const cached = uniformCache.get(id);
  if (cached !== undefined) return cached;
  const built = buildUniforms(id);
  uniformCache.set(id, built);
  return built;
}

function buildUniforms(id: PaletteID) {
  const stops = paletteStops(id);
  const positions = new Float32Array(MAX_PALETTE_STOPS);
  const colors = new Float32Array(MAX_PALETTE_STOPS * 3);
  for (let i = 0; i < MAX_PALETTE_STOPS; i++) {
    const stop = stops[Math.min(i, stops.length - 1)];
    positions[i] = stop.at;
    colors[i * 3] = stop.rgb[0] / 255;
    colors[i * 3 + 1] = stop.rgb[1] / 255;
    colors[i * 3 + 2] = stop.rgb[2] / 255;
  }
  return { positions, colors, count: stops.length };
}

/**
 * The same interpolation as `paletteLatex`, in GLSL, reading the stops from
 * uniforms.
 *
 * Uniforms rather than baked-in constants so that changing the palette is a
 * uniform upload; compiling it into the shader would mean relinking two
 * programs on every click of a color chip.
 */
export const PALETTE_GLSL = `
uniform float u_paletteAt[${MAX_PALETTE_STOPS}];
uniform vec3 u_paletteRGB[${MAX_PALETTE_STOPS}];
uniform int u_paletteCount;
uniform int u_paletteIsHue;

vec3 vtHueRamp(float hue) {
  vec3 k = mod(hue * 6.0 + vec3(0.0, 4.0, 2.0), 6.0);
  return clamp(min(k, 4.0 - k), 0.0, 1.0);
}

vec3 vtPalette(float t) {
  if (u_paletteIsHue == 1) return vtHueRamp(fract(t));
  vec3 rgb = u_paletteRGB[0];
  for (int i = 1; i < ${MAX_PALETTE_STOPS}; i++) {
    if (i >= u_paletteCount) break;
    float from = u_paletteAt[i - 1];
    float to = u_paletteAt[i];
    rgb += (u_paletteRGB[i] - u_paletteRGB[i - 1]) *
           clamp((t - from) / max(to - from, 1e-6), 0.0, 1.0);
  }
  return rgb;
}
`;
