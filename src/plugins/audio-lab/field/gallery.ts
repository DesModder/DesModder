/**
 * The shared gallery, as fields the music can move.
 *
 * `src/field-rendering/gallery.ts` holds eight fields chosen because they are
 * worth looking at, and none of them mentions the sound — their maths is a
 * black hole's or a dipole's, and deliberately real. Two things are done to one
 * on its way in here, and both are visible in the panel rather than hidden in a
 * setting:
 *
 *  - **A gain term is written into both components.** Loudness scales the whole
 *    field, so the orbits speed up when the track does. It is written into the
 *    box, which means it can be retuned, pointed at a different variable, or
 *    deleted to get the untouched field back — none of which would be true of
 *    a checkbox somewhere else.
 *  - **The clock is rescaled in place.** A gallery preset carries a `timeSpeed`
 *    because Vector Tools has a clock control; Audio Lab does not, and adding a
 *    second clock would have broken the ripples, whose whole appearance is
 *    their age against `u_time`. So `t` is rewritten to `0.45t` in the LaTeX
 *    instead — the same visible, editable change, and one clock.
 *
 * Everything else — palette, backdrop, particle count, trail, glow — is the
 * preset's own and arrives unchanged.
 */
import {
  FIELD_GALLERY,
  GALLERY_DEFAULT_BACKDROP,
  type GalleryPreset,
} from "../../../field-rendering/gallery";
import { renameIdentifier } from "../../../field-rendering/identifiers";
import {
  AUDIO_FIELD_SCHEMA_VERSION,
  DEFAULT_LOOK,
  matchesPreset,
  type AudioFieldConfig,
  type RippleConfig,
} from "./model";

export { FIELD_GALLERY };
export type { GalleryPreset };

/**
 * The audio term written into a gallery field's components.
 *
 * One rule for all eight rather than a hand-tuned term each, because it has to
 * be recognisable: the point of writing it into the box is that someone can see
 * what was added and change it, and eight different additions would be eight
 * things to work out rather than one.
 *
 * `A_audio` runs 0 to 1, so the gain runs 0.55 to 2. A field that could reach
 * zero would stall every particle in it and the renderer would respawn the lot;
 * see "Still water" in `model.ts` for what that looks like.
 */
export const GALLERY_GAIN = String.raw`\left(0.55+1.45A_{audio}\right)`;

/**
 * Wraps a component in the gain.
 *
 * The component is parenthesised even when it looks like it does not need to
 * be, because `\sin x\cos y` multiplied by something is not the same as
 * `\sin x\cos y` with something in front of the first factor, and deciding
 * which components need brackets means parsing them — which is the compiler's
 * job, not this one's.
 */
function withGain(latex: string) {
  return `${GALLERY_GAIN}\\left(${latex}\\right)`;
}

/**
 * Bakes a preset's clock speed into its expression.
 *
 * `renameIdentifier` walks the LaTeX the way a lexer would rather than doing a
 * string replace, which is the whole reason it exists: `\tan` contains a `t`,
 * and so does a subscript belonging to another name entirely.
 *
 * The replacement is bracketed because `3\sin t` becoming `3\sin 0.45t` reads
 * as `3\sin(0.45)t` to some parsers and `3\sin(0.45t)` to others, and a
 * preset that means one of those should not be left depending on which.
 */
function atClockSpeed(latex: string, speed: number) {
  if (speed === 1) return latex;
  const renamed = renameIdentifier(latex, "t", `\\left(${speed}t\\right)`);
  // `3\sin t` becomes `3\sin \left(0.45t\right)`, keeping the space that used
  // to separate the command from its argument. It parses either way, and
  // Desmos would not have written it: a command is already terminated by the
  // backslash that starts `\left`. Tidied here rather than left in, because
  // these strings are put in a box and read.
  return renamed.replace(/(\\[a-zA-Z]+) +\\left/g, "$1\\left");
}

/**
 * Ripple settings scaled to the field's own size.
 *
 * A gallery preset says what half-width it is framed in, and that is the only
 * scale information there is: a ring 1.6 units across is most of a Magnetic
 * dipole and a detail in a Spiral galaxy. Everything here is a fraction of the
 * extent, so a ring is the same size *relative to the picture* in all eight.
 */
function ripplesFor(extent: number): RippleConfig {
  return {
    source: "onset",
    origin: "scatter",
    speed: extent * 0.42,
    wavelength: extent * 0.2,
    lifetime: 2.8,
    strength: extent * 0.3,
  };
}

/** One gallery entry, as a field Audio Lab can draw. */
export function configFromGalleryPreset(
  preset: GalleryPreset
): AudioFieldConfig {
  const extent = preset.extent ?? 8;
  const speed = preset.timeSpeed ?? 1;
  return {
    schemaVersion: AUDIO_FIELD_SCHEMA_VERSION,
    presetId: galleryConfigId(preset.id),
    p: withGain(atClockSpeed(preset.xLatex, speed)),
    q: withGain(atClockSpeed(preset.yLatex, speed)),
    ripples: ripplesFor(extent),
    pointer: {
      mode: "push",
      // Proportionate to the field for the same reason the ripples are.
      strength: extent * 0.35,
      radius: extent * 0.3,
      clickRipples: true,
    },
    look: {
      ...DEFAULT_LOOK,
      ...preset.flow,
      colorMode: "speed",
      palette: preset.palette,
      // The palettes these use run from near-black to near-white, so the fast
      // parts read as light. On Desmos's white graph paper the dark end of that
      // ramp is the most visible part of the picture, which is exactly
      // backwards — the backdrop is what makes them look like themselves, and
      // it is a real trade: the grid and every other expression go behind it.
      backdrop: preset.backdrop ?? GALLERY_DEFAULT_BACKDROP,
      backdropOpacity: 0.92,
    },
  };
}

/**
 * The id a gallery field carries once it is an Audio Lab configuration.
 *
 * Namespaced, so that a gallery entry and one of this plugin's own presets can
 * never collide on an id — and so that a stored configuration says which of the
 * two lists it came from.
 */
export function galleryConfigId(id: string) {
  return `gallery:${id}`;
}

export function galleryPresetFromConfigId(
  presetId: string
): GalleryPreset | undefined {
  if (!presetId.startsWith("gallery:")) return undefined;
  const id = presetId.slice("gallery:".length);
  return FIELD_GALLERY.find((preset) => preset.id === id);
}

/**
 * Which preset a configuration is still, across both lists, or "custom".
 *
 * One function because there is one answer: a configuration came from this
 * plugin's own presets, or from the gallery, or it is the user's, and a caller
 * that had to ask two questions and combine them would eventually ask only one.
 *
 * Only the components are compared, in both cases. Changing the palette or the
 * trail length does not stop a field from being the Black hole — it is the same
 * field, drawn differently — whereas changing a component makes it something
 * else, and the chooser should say so.
 */
export function identifyPreset(config: AudioFieldConfig): string {
  if (matchesPreset(config)) return config.presetId;
  const preset = galleryPresetFromConfigId(config.presetId);
  if (preset !== undefined) {
    const rebuilt = configFromGalleryPreset(preset);
    if (rebuilt.p === config.p && rebuilt.q === config.q)
      return config.presetId;
  }
  return "custom";
}

/** Every starting point, in the order the panel offers them. */
export function galleryChoices() {
  return FIELD_GALLERY.map(
    (preset) => [galleryConfigId(preset.id), preset.name] as const
  );
}
