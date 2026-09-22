/**
 * How a gallery field becomes a Vector Tools configuration.
 *
 * The fields themselves moved to `src/field-rendering/gallery.ts` when Audio
 * Lab started offering them too — a list of pictures is not specific to this
 * plugin, and two copies of it would be two lists to keep in step. What stays
 * here is the part that is specific: turning one into a `VectorFieldConfig`,
 * which is this plugin's format and no one else's.
 *
 * Both entry points are re-exported below, so nothing that imported them from
 * here had to change.
 */
import {
  FIELD_GALLERY,
  GALLERY_DEFAULT_BACKDROP,
  galleryPreset,
  type GalleryPreset,
} from "../../field-rendering/gallery";
import {
  cloneDefaultConfig,
  FLOW_LOOK_PRESETS,
  type SamplingAxisConfig,
  type VectorFieldConfig,
} from "./model";

export { FIELD_GALLERY, galleryPreset };
export type { GalleryPreset };

/**
 * The field a gallery entry describes, ready to be saved.
 *
 * Built on the defaults so that everything a preset does not mention keeps its
 * usual value — a preset is a set of changes from the ordinary field, not a
 * second place where every setting has to be maintained.
 */
/**
 * The colours a gallery entry brings, and nothing else.
 *
 * The light-touch load, and the default one. A preset's framing, its particle
 * counts and whether it draws arrows are settings the user has probably
 * already spent time on, and replacing them because they clicked a new field
 * is how a gallery becomes something you stop clicking.
 *
 * The palette and the backdrop go together: a near-black ramp without the dark
 * behind it is the navy scribble this was built to avoid, so "the colours"
 * means both of them.
 */
export function colorsFromGallery(
  preset: GalleryPreset,
  base: VectorFieldConfig
): VectorFieldConfig {
  return {
    ...base,
    name: preset.name,
    source: "components",
    components: { xLatex: preset.xLatex, yLatex: preset.yLatex },
    color: { ...base.color, palette: preset.palette },
    time: { ...base.time, speed: preset.timeSpeed ?? base.time.speed },
    flow: {
      ...base.flow,
      palette: preset.palette,
      backdropEnabled: true,
      backdropColor: preset.backdrop ?? GALLERY_DEFAULT_BACKDROP,
    },
  };
}

export function configFromGallery(
  preset: GalleryPreset,
  base: VectorFieldConfig = cloneDefaultConfig()
): VectorFieldConfig {
  const extent = preset.extent ?? 8;
  const axis = (from: SamplingAxisConfig): SamplingAxisConfig => ({
    ...from,
    min: -extent,
    max: extent,
    mode: "count",
    count: 25,
  });
  return {
    ...base,
    name: preset.name,
    source: "components",
    components: { xLatex: preset.xLatex, yLatex: preset.yLatex },
    domain: { x: axis(base.domain.x), y: axis(base.domain.y) },
    // These are flow pictures. An arrow grid samples a field at fixed points,
    // which is how you read one rather than how you watch one.
    arrowMode: "off",
    color: { ...base.color, palette: preset.palette },
    time: { ...base.time, playing: true, speed: preset.timeSpeed ?? 1 },
    flow: {
      ...base.flow,
      ...FLOW_LOOK_PRESETS.streamlines,
      look: "streamlines",
      colorMode: "speed",
      palette: preset.palette,
      // The backdrop is the difference between these and navy scribble. Their
      // palettes run from near-black to near-white so the fast parts read as
      // light, and on white graph paper the dark end of that is the most
      // visible part of the picture.
      backdropEnabled: true,
      backdropColor: preset.backdrop ?? GALLERY_DEFAULT_BACKDROP,
      ...preset.flow,
    },
  };
}
