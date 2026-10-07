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
  type Space3DConfig,
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
  base: VectorFieldConfig,
  dimensions: 2 | 3 = 2
): VectorFieldConfig {
  return {
    ...base,
    name: preset.name,
    source: "components",
    components: componentsFor(preset, dimensions),
    color: { ...base.color, palette: preset.palette },
    time: { ...base.time, speed: preset.timeSpeed ?? base.time.speed },
    flow: {
      ...base.flow,
      palette: preset.palette,
      backdropEnabled: true,
      backdropColor: preset.backdrop ?? GALLERY_DEFAULT_BACKDROP,
      ...flowMatterFor(preset, base.flow),
    },
    space3d: dimensions === 3 ? matterFor(preset, base.space3d) : base.space3d,
  };
}

/**
 * In 2D, what a preset's field carries besides its formula, as in 3D: where
 * its matter is, a black hole if it has one, and the speed its colours span.
 */
function flowMatterFor(
  preset: GalleryPreset,
  base: VectorFieldConfig["flow"]
): Partial<VectorFieldConfig["flow"]> {
  return {
    seedLatex: preset.seedLatex ?? "",
    lens: preset.lensHorizon !== undefined,
    lensHorizon: preset.lensHorizon ?? base.lensHorizon,
    colorScaleAuto: preset.colorScale === undefined,
    colorScale: preset.colorScale ?? base.colorScale,
  };
}

/**
 * On Desmos 3D, what a preset's field carries besides its formula: where its
 * matter is and whether a black hole bends its light. Part of the field, not
 * of the look — a black hole's field with particles born all through the box
 * is a cube of fuzz — so even the colours-only load brings them.
 */
function matterFor(preset: GalleryPreset, base: Space3DConfig): Space3DConfig {
  return {
    ...base,
    seedLatex: preset.space.seedLatex ?? "",
    lens: preset.space.lensHorizon !== undefined,
    lensHorizon: preset.space.lensHorizon ?? base.lensHorizon,
  };
}

/** The 3D flow as the preset draws it, over the field's current settings. */
function spaceLookFor(
  preset: GalleryPreset,
  base: Space3DConfig
): Space3DConfig {
  const look = preset.space.look ?? {};
  const s = matterFor(preset, base);
  return {
    ...s,
    flowLook: "particles",
    particlesAuto: look.particles === undefined,
    particles: look.particles ?? s.particles,
    particleSpeed: look.speed ?? s.particleSpeed,
    particleTrail: look.trail ?? s.particleTrail,
    particleLifetime: look.lifetime ?? s.particleLifetime,
    particleOpacity: look.opacity ?? s.particleOpacity,
    particleGlow: look.glow ?? s.particleGlow,
    particleNormalize: look.normalizeSpeed ?? s.particleNormalize,
    particleAbsorb: look.absorb ?? s.particleAbsorb,
    backdrop: true,
    backdropColor: look.backdrop ?? s.backdropColor,
    backdropOpacity: look.backdropOpacity ?? s.backdropOpacity,
  };
}

export function configFromGallery(
  preset: GalleryPreset,
  base: VectorFieldConfig = cloneDefaultConfig(),
  dimensions: 2 | 3 = 2
): VectorFieldConfig {
  const extent =
    (dimensions === 3 ? preset.space.extent : undefined) ?? preset.extent ?? 8;
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
    components: componentsFor(preset, dimensions),
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
      ...flowMatterFor(preset, base.flow),
      ...(preset.fixedColor !== undefined
        ? { colorMode: "fixed" as const }
        : {}),
      ...(dimensions === 3 && preset.space.look?.colorMode !== undefined
        ? { colorMode: preset.space.look.colorMode }
        : {}),
      ...(dimensions === 3 && preset.space.look?.palette !== undefined
        ? { palette: preset.space.look.palette }
        : {}),
    },
    ...((dimensions === 3
      ? preset.space.look?.fixedColor
      : preset.fixedColor) !== undefined
      ? {
          color: {
            ...base.color,
            palette: preset.palette,
            fixedColor:
              (dimensions === 3
                ? preset.space.look?.fixedColor
                : preset.fixedColor) ?? base.color.fixedColor,
          },
        }
      : {}),
    space3d:
      dimensions === 3 ? spaceLookFor(preset, base.space3d) : base.space3d,
  };
}

/**
 * A preset's field for the product it is loaded on: its 3D form on Desmos 3D,
 * so it never lies flat there by accident, and its 2D form everywhere else.
 */
export function componentsFor(
  preset: GalleryPreset,
  dimensions: 2 | 3
): VectorFieldConfig["components"] {
  return dimensions === 3
    ? {
        xLatex: preset.space.xLatex,
        yLatex: preset.space.yLatex,
        zLatex: preset.space.zLatex,
      }
    : { xLatex: preset.xLatex, yLatex: preset.yLatex, zLatex: "0" };
}
