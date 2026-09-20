/**
 * Fields chosen because they are worth looking at.
 *
 * Separate from `VECTOR_FIELD_PRESETS` in `model.ts`, which is the development
 * test lab's set — those are deliberately plain, because their job is to make a
 * *rendering* bug obvious and a picture with a lot going on in it hides one.
 * These have the opposite job.
 *
 * ## A preset is a whole look, not two formulas
 *
 * Setting only P and Q and leaving everything else where it was produces a
 * black hole drawn as a grid of short blue arrows, which is nobody's idea of a
 * black hole. Each entry therefore carries its palette, its flow settings, the
 * domain it is framed in and whether arrows are drawn at all — because the
 * thing being chosen is the picture, and the formula is only how it is made.
 *
 * Nearly all of them turn the arrows off. These are flow pictures: an arrow
 * grid samples a field at fixed points, which is the right tool for reading one
 * and the wrong one for watching it move.
 *
 * ## The maths is real
 *
 * None of these is a shape drawn to look like something. The galaxy's arms come
 * out of differential rotation — inner orbits going round faster than outer
 * ones, which is what winds a spiral out of a disc — and the black hole's
 * particles accelerate inward because the field really does go as a power of
 * 1/r. That matters here more than it would elsewhere: this plugin's whole
 * claim is that what you see is the field, so a preset that cheated would be
 * the one thing in it that lies.
 */
import type { PaletteID } from "../../field-rendering/palettes";
import {
  cloneDefaultConfig,
  FLOW_LOOK_PRESETS,
  type FlowConfig,
  type SamplingAxisConfig,
  type VectorFieldConfig,
} from "./model";

export interface GalleryPreset {
  id: string;
  name: string;
  /** What it is, in one line, under the name. */
  blurb: string;
  xLatex: string;
  yLatex: string;
  palette: PaletteID;
  /** Applied over the defaults. The look is most of what a preset is. */
  flow?: Partial<FlowConfig>;
  /** Half-width of the square the field is framed in. */
  extent?: number;
  /** How fast the clock runs, for the ones that move. */
  timeSpeed?: number;
  /** The dark it is drawn on. Defaults to a near-black blue. */
  backdrop?: string;
}

const r2 = String.raw`\left(x^{2}+y^{2}\right)`;

/** The dark these are drawn on where a preset does not name its own. */
const DEFAULT_BACKDROP = "#0d1020";

export const FIELD_GALLERY: readonly GalleryPreset[] = [
  {
    id: "black-hole",
    name: "Black hole",
    blurb:
      "An accretion inspiral: orbital motion with a slow inward drift, speeding up as 1/√r.",
    // Rotation plus a drift toward the centre. The 3/4 power makes the speed
    // go as r^-1/2, which is the Keplerian falloff a real disc has — particles
    // visibly accelerate as they fall in, and that acceleration is the picture.
    xLatex: String.raw`\frac{-y-0.32x}{${r2}^{0.75}}`,
    yLatex: String.raw`\frac{x-0.32y}{${r2}^{0.75}}`,
    palette: "ember",
    backdrop: "#0c0806",
    flow: {
      particleCount: 70_000,
      glow: 0.75,
      opacity: 0.62,
      pointSize: 1.6,
      normalizeSpeed: false,
      speed: 0.8,
    },
    extent: 8,
  },
  {
    id: "spiral-galaxy",
    name: "Spiral galaxy",
    blurb:
      "Differential rotation: inner orbits come round faster than outer ones, which winds a spiral out of a disc.",
    xLatex: String.raw`\frac{-y}{1+\sqrt{${r2}}}`,
    yLatex: String.raw`\frac{x}{1+\sqrt{${r2}}}`,
    palette: "nebula",
    backdrop: "#0a0814",
    flow: {
      particleCount: 80_000,
      glow: 0.8,
      opacity: 0.58,
      pointSize: 1.5,
      normalizeSpeed: false,
      trailPersistence: 0.975,
      dropRate: 0.004,
    },
    extent: 10,
  },
  {
    id: "binary",
    name: "Binary orbit",
    blurb:
      "Two vortices circling their common centre. The clock moves them, so the whole pattern turns.",
    // The softening term keeps the centres finite. Without it the two points
    // are poles, and a pole swallows the colour range and the integrator both.
    xLatex: String.raw`\frac{-\left(y-3\sin t\right)}{\left(x-3\cos t\right)^{2}+\left(y-3\sin t\right)^{2}+0.6}+\frac{-\left(y+3\sin t\right)}{\left(x+3\cos t\right)^{2}+\left(y+3\sin t\right)^{2}+0.6}`,
    yLatex: String.raw`\frac{x-3\cos t}{\left(x-3\cos t\right)^{2}+\left(y-3\sin t\right)^{2}+0.6}+\frac{x+3\cos t}{\left(x+3\cos t\right)^{2}+\left(y+3\sin t\right)^{2}+0.6}`,
    palette: "starfield",
    flow: {
      particleCount: 70_000,
      glow: 0.7,
      opacity: 0.6,
      pointSize: 1.6,
      normalizeSpeed: false,
    },
    extent: 9,
    timeSpeed: 0.45,
  },
  {
    id: "aurora",
    name: "Aurora",
    blurb:
      "Curtains that drift and fold, because both components read the clock.",
    xLatex: String.raw`\cos\left(0.6y+t\right)`,
    yLatex: String.raw`0.35\sin\left(0.9x-t\right)`,
    palette: "aurora",
    backdrop: "#04080f",
    flow: {
      particleCount: 80_000,
      glow: 0.85,
      opacity: 0.55,
      pointSize: 1.7,
      trailPersistence: 0.97,
      dropRate: 0.006,
    },
    extent: 10,
    timeSpeed: 0.6,
  },
  {
    id: "pulsar",
    name: "Pulsar",
    blurb:
      "A radial field whose sign follows sin t, so the whole thing breathes in and out.",
    xLatex: String.raw`\frac{x\sin t}{\sqrt{${r2}}+0.4}`,
    yLatex: String.raw`\frac{y\sin t}{\sqrt{${r2}}+0.4}`,
    palette: "starfield",
    flow: {
      particleCount: 65_000,
      glow: 0.9,
      opacity: 0.65,
      pointSize: 1.8,
      normalizeSpeed: false,
    },
    extent: 8,
    timeSpeed: 0.8,
  },
  {
    id: "star-cluster",
    name: "Star cluster",
    blurb:
      "Three attractors. Particles fall into them and pile up, so the knots draw themselves.",
    xLatex: String.raw`\frac{-\left(x+4\right)}{\left(\left(x+4\right)^{2}+\left(y-2\right)^{2}+0.4\right)^{1.1}}+\frac{-\left(x-3\right)}{\left(\left(x-3\right)^{2}+\left(y-3\right)^{2}+0.4\right)^{1.1}}+\frac{-\left(x-1\right)}{\left(\left(x-1\right)^{2}+\left(y+4\right)^{2}+0.4\right)^{1.1}}`,
    yLatex: String.raw`\frac{-\left(y-2\right)}{\left(\left(x+4\right)^{2}+\left(y-2\right)^{2}+0.4\right)^{1.1}}+\frac{-\left(y-3\right)}{\left(\left(x-3\right)^{2}+\left(y-3\right)^{2}+0.4\right)^{1.1}}+\frac{-\left(y+4\right)}{\left(\left(x-1\right)^{2}+\left(y+4\right)^{2}+0.4\right)^{1.1}}`,
    palette: "nebula",
    flow: {
      particleCount: 75_000,
      glow: 0.8,
      opacity: 0.6,
      pointSize: 1.5,
      normalizeSpeed: false,
      dropRate: 0.03,
    },
    extent: 9,
  },
  {
    id: "cellular",
    name: "Vortex lattice",
    blurb:
      "Taylor–Green flow: an array of counter-rotating cells, each one shearing against its neighbours.",
    xLatex: String.raw`\sin x\cos y`,
    yLatex: String.raw`-\cos x\sin y`,
    palette: "aurora",
    backdrop: "#04080f",
    flow: {
      particleCount: 80_000,
      glow: 0.6,
      opacity: 0.58,
      pointSize: 1.5,
      normalizeSpeed: false,
    },
    extent: 9,
  },
  {
    id: "dipole",
    name: "Magnetic dipole",
    blurb:
      "The field of a bar magnet, and the one picture every physics textbook opens with.",
    xLatex: String.raw`\frac{3xy}{${r2}^{2.5}}`,
    yLatex: String.raw`\frac{2y^{2}-x^{2}}{${r2}^{2.5}}`,
    palette: "starfield",
    flow: {
      particleCount: 70_000,
      glow: 0.7,
      opacity: 0.62,
      pointSize: 1.6,
      // The field is enormous at the origin and tiny at the edge, so drawing
      // it at its own pace leaves everything but the centre standing still.
      normalizeSpeed: true,
      trailPersistence: 0.98,
      dropRate: 0.004,
    },
    extent: 6,
  },
];

export function galleryPreset(id: string): GalleryPreset | undefined {
  return FIELD_GALLERY.find((preset) => preset.id === id);
}

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
      backdropColor: preset.backdrop ?? DEFAULT_BACKDROP,
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
      backdropColor: preset.backdrop ?? DEFAULT_BACKDROP,
      ...preset.flow,
    },
  };
}
