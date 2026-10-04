/**
 * Fields chosen because they are worth looking at.
 *
 * These live here, in the package neither plugin owns, because more than one
 * thing now wants them: Vector Tools offers them as saved fields, and Audio Lab
 * offers them as starting points for a field the music moves. What they are —
 * a name, a blurb, two components and the look that makes the picture — is not
 * specific to either, and a copy in each would be two lists to keep in step.
 *
 * What is *not* here is how a preset becomes a configuration. Each plugin's
 * configuration format is its own, so each does that mapping itself.
 *
 * ## A preset is a whole look, not two formulas
 *
 * Setting only P and Q and leaving everything else where it was produces a
 * black hole drawn as a grid of short blue arrows, which is nobody's idea of a
 * black hole. Each entry therefore carries its palette, its flow settings, the
 * domain it is framed in and whether arrows are drawn at all — because the
 * thing being chosen is the picture, and the formula is only how it is made.
 *
 * ## The maths is real
 *
 * None of these is a shape drawn to look like something. The galaxy's arms come
 * out of differential rotation — inner orbits going round faster than outer
 * ones, which is what winds a spiral out of a disc — and the black hole's
 * particles accelerate inward because the field really does go as a power of
 * 1/r. That matters here more than it would elsewhere: these plugins' whole
 * claim is that what you see is the field, so a preset that cheated would be
 * the one thing in them that lies.
 *
 * ## The LaTeX is Desmos's own
 *
 * Every component is written the way Desmos writes it: `\left(` and
 * `\right)` around a group, `\frac{a}{b}`, `x^{2}`, `\cdot` for an explicit
 * product. The compiler accepts the shorter spellings too, but these strings
 * are put in front of people and pasted into graphs, and one that came back
 * from Desmos looking different from the one that went in is a small lie about
 * where it came from.
 */
import type { PaletteID } from "./palettes";

/**
 * The drawing settings a gallery entry may carry.
 *
 * A subset, and deliberately a small one: every name here means the same thing
 * in both plugins' own settings, so each can spread it into its own without a
 * translation table. Anything that exists in only one of them is that plugin's
 * business and does not belong in a shared list of pictures.
 */
export interface GalleryLook {
  particleCount: number;
  speed: number;
  trailPersistence: number;
  dropRate: number;
  opacity: number;
  pointSize: number;
  glow: number;
  normalizeSpeed: boolean;
}

export interface GalleryPreset {
  id: string;
  name: string;
  /** What it is, in one line, under the name. */
  blurb: string;
  xLatex: string;
  yLatex: string;
  palette: PaletteID;
  /** Applied over whatever the caller's defaults are. */
  flow?: Partial<GalleryLook>;
  /** Half-width of the square the field is framed in. */
  extent?: number;
  /** How fast the clock runs, for the ones that move. */
  timeSpeed?: number;
  /** The dark it is drawn on. Defaults to a near-black blue. */
  backdrop?: string;
}

const r2 = String.raw`\left(x^{2}+y^{2}\right)`;

/** The dark these are drawn on where a preset does not name its own. */
export const GALLERY_DEFAULT_BACKDROP = "#0d1020";

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
    // Bracketed: Desmos refuses `\sin x\cos y` ("Use parentheses around the
    // argument of 'sin'"), and these are written into the expression list.
    xLatex: String.raw`\sin\left(x\right)\cos\left(y\right)`,
    yLatex: String.raw`-\cos\left(x\right)\sin\left(y\right)`,
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
