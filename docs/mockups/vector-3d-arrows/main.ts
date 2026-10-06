/**
 * The step-1 mock-up of live 3D arrows: the page, its controls, the Auto
 * rules, and the numbers the panel reports.
 *
 * Every trade-off is a control with an Auto default and a manual override, as
 * the plugin's are. What Auto picks is shown beside the control, so a reader
 * can see the rule working rather than take it on trust.
 */
import { projectToScreen } from "../../../src/field-rendering/camera3d";
import {
  compileFieldComponentToGLSL,
  EMPTY_ENVIRONMENT,
  type CompileResult,
} from "../../../src/field-rendering/latexToGLSL";
import {
  paletteCSSGradient,
  PALETTES,
  type PaletteID,
} from "../../../src/field-rendering/palettes";
import { buildCamera, type Box, type View } from "./camera";
import { runnable } from "./glslToJs";
import {
  boxScreenSize,
  instanceCount,
  Overlay,
  verticesPerArrow,
  type ArrowSettings,
  type LengthMode,
  type Occlusion,
  type Cutaway,
  type Look,
  type Sampling,
  type Shape,
} from "./overlay";
import { StandIn, STANDIN_RESOLUTION, type Theme } from "./standin";

const SPACE = { ...EMPTY_ENVIRONMENT, dimensions: 3 as const };

const FIELD_PRESETS: Record<
  string,
  { name: string; field: [string, string, string]; note: string }
> = {
  charge: {
    name: "Point charge",
    note: "E = r / |r|³. A pole at the origin: the test for colour and length.",
    field: [
      String.raw`\frac{x}{\left(x^{2}+y^{2}+z^{2}\right)^{1.5}}`,
      String.raw`\frac{y}{\left(x^{2}+y^{2}+z^{2}\right)^{1.5}}`,
      String.raw`\frac{z}{\left(x^{2}+y^{2}+z^{2}\right)^{1.5}}`,
    ],
  },
  dipole: {
    name: "Dipole",
    note: "+1 at (0, 0, 1) and −1 at (0, 0, −1). Two poles.",
    field: [
      String.raw`\frac{x}{\left(x^{2}+y^{2}+\left(z-1\right)^{2}\right)^{1.5}}-\frac{x}{\left(x^{2}+y^{2}+\left(z+1\right)^{2}\right)^{1.5}}`,
      String.raw`\frac{y}{\left(x^{2}+y^{2}+\left(z-1\right)^{2}\right)^{1.5}}-\frac{y}{\left(x^{2}+y^{2}+\left(z+1\right)^{2}\right)^{1.5}}`,
      String.raw`\frac{z-1}{\left(x^{2}+y^{2}+\left(z-1\right)^{2}\right)^{1.5}}-\frac{z+1}{\left(x^{2}+y^{2}+\left(z+1\right)^{2}\right)^{1.5}}`,
    ],
  },
  wire: {
    name: "Line current",
    note: "B around a wire on the z-axis: circles, falling off as 1/r.",
    field: [
      String.raw`\frac{-y}{x^{2}+y^{2}}`,
      String.raw`\frac{x}{x^{2}+y^{2}}`,
      "0",
    ],
  },
  rotation: {
    name: "Rotation",
    note: "(−y, x, 0). Curl is 2 everywhere, along z.",
    field: ["-y", "x", "0"],
  },
  saddle: {
    name: "∇(x²+y²−z²)",
    note: "A gradient field. Out along x and y, in along z.",
    field: ["2x", "2y", "-2z"],
  },
  abc: {
    name: "ABC flow",
    note: "Arnold–Beltrami–Childress: a classic tangled 3D flow.",
    field: [
      String.raw`\sin z+\cos y`,
      String.raw`\sin x+\cos z`,
      String.raw`\sin y+\cos x`,
    ],
  },
};

const SURFACE_PRESETS: Record<string, { name: string; latex: string }> = {
  none: { name: "None", latex: "" },
  bump: { name: "Bump", latex: String.raw`3e^{-\frac{x^{2}+y^{2}}{6}}-1` },
  saddle: { name: "Saddle", latex: String.raw`\frac{x^{2}-y^{2}}{8}` },
  ripple: {
    name: "Ripple",
    latex: String.raw`\cos\left(\sqrt{x^{2}+y^{2}}\right)`,
  },
};

const PALETTE_CHOICES: PaletteID[] = [
  "spectral",
  "sequential-a",
  "turbo",
  "plasma",
  "magma",
  "cividis",
];
const MESH_CHOICES = [16, 32, 64, 128, 256];

type Auto<T> = { auto: boolean; value: T };

const state = {
  preset: "charge" as string,
  field: [...FIELD_PRESETS.charge.field] as string[],
  surfacePreset: "bump" as string,
  surface: SURFACE_PRESETS.bump.latex,
  surfaceOpacity: 0.85,
  box: { min: [-5, -5, -5], max: [5, 5, 5] } as Box,
  view: { turn: -0.65, tilt: 0.42, zoom: 1, perspective: 1 } as View,
  shape: { auto: true, value: "solid" } as Auto<Shape>,
  sampling: "jitter" as Sampling,
  sliceAxis: 2 as 0 | 1 | 2,
  slicePosition: 0.5,
  count: { auto: true, value: 8 } as Auto<number>,
  lengthMode: "normalized" as LengthMode,
  /** Multiple of the spacing between arrows. */
  length: { auto: true, value: 0.8 } as Auto<number>,
  widthPx: 3,
  colorMode: "magnitude" as "magnitude" | "fixed",
  palette: "spectral" as PaletteID,
  scale: { auto: true, value: 1 } as Auto<number>,
  /** What Auto takes the colour scale from. */
  scaleRule: "field" as "field" | "box",
  shading: true,
  fog: false,
  outline: false,
  selfDepth: true,
  // Hidden by default: an arrow behind a surface the student graphed should
  // look behind it. X-ray and Faded stay one click away.
  occlusion: "hide" as Occlusion,
  mesh: { auto: true, value: 64 } as Auto<number>,
  clip: true,
  spin: false,
  look: "arrows" as Look,
  cutaway: "off" as Cutaway,
  cutAngle: Math.PI / 2,
  /** Undefined while the slice faces the viewer; an angle once fixed. */
  cutTurn: undefined as number | undefined,
  lines: { auto: true, value: 2500 } as Auto<number>,
  lineLength: 0.6,
  lineOpacity: 0.4,
  points: { auto: true, value: 150000 } as Auto<number>,
  pointPx: 2,
  cloudOpacity: 0.35,
  cloudContrast: 3,
  cloudByDirection: false,
  animate: true,
  flowSpeed: 0.25,
  flowWindow: 0.4,
};

// ---------------------------------------------------------------- elements
const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const stage = $("stage");
const desmosCanvas = $<HTMLCanvasElement>("desmos");
const overlayCanvas = $<HTMLCanvasElement>("overlay");

let standIn: StandIn;
let overlay: Overlay;
try {
  standIn = new StandIn(desmosCanvas);
  overlay = new Overlay(overlayCanvas);
} catch (error) {
  $("fatal").hidden = false;
  $("fatal").textContent =
    `This mock-up needs WebGL2. ${(error as Error).message}`;
  throw error;
}

// ---------------------------------------------------------------- compile
let fieldJs: ((p: readonly number[]) => number)[] = [];
let surfaceJs: ((p: readonly number[]) => number) | undefined;
let surfaceOk = false;

function compileAll() {
  const results = state.field.map((latex) =>
    compileFieldComponentToGLSL(latex.trim() === "" ? "0" : latex, SPACE)
  );
  const failed = results.findIndex((r) => !r.ok);
  const fieldError = $("fieldError");
  let surfaceResult: CompileResult | undefined;
  const surfaceError = $("surfaceError");
  if (state.surface.trim() !== "") {
    surfaceResult = compileFieldComponentToGLSL(state.surface);
  }
  surfaceError.hidden = surfaceResult === undefined || surfaceResult.ok;
  if (surfaceResult !== undefined && !surfaceResult.ok) {
    surfaceError.textContent = `z = … : ${surfaceResult.error}`;
  }
  const surface = surfaceResult?.ok === true ? surfaceResult : undefined;
  surfaceOk = surface !== undefined;
  surfaceJs = surface !== undefined ? runnable(surface) : undefined;
  try {
    standIn.setSurface(
      surface?.glsl,
      surface?.helpers.map((h) => h.glsl).join("\n") ?? ""
    );
  } catch (error) {
    surfaceError.hidden = false;
    surfaceError.textContent = `The surface did not compile: ${(error as Error).message.split("\n")[0]}`;
  }
  if (failed >= 0) {
    const r = results[failed] as { ok: false; error: string };
    fieldError.hidden = false;
    fieldError.textContent = `${"PQR"[failed]}: ${r.error}`;
    return;
  }
  fieldError.hidden = true;
  const ok = results as Extract<CompileResult, { ok: true }>[];
  fieldJs = ok.map((r) => runnable(r)!);
  try {
    overlay.setField(
      ok.map((r) => r.glsl),
      dedupeHelpers(ok),
      surface?.glsl,
      surface?.helpers.map((h) => h.glsl).join("\n") ?? ""
    );
  } catch (error) {
    fieldError.hidden = false;
    fieldError.textContent = `The shader did not compile: ${(error as Error).message.split("\n")[0]}`;
  }
}

function dedupeHelpers(results: Extract<CompileResult, { ok: true }>[]) {
  const seen = new Map<string, string>();
  for (const r of results) for (const h of r.helpers) seen.set(h.name, h.glsl);
  return [...seen.values()].join("\n");
}

// ---------------------------------------------------------------- auto rules
let lastBoxPx = 600;
/** The median |F| over the arrows last sampled, for the field's scale rule. */
let fieldMedian = NaN;

function effective(): ArrowSettings & { autoNotes: Record<string, string> } {
  const sampling =
    state.sampling === "surface" && !surfaceOk ? "grid" : state.sampling;
  const volume = sampling === "grid" || sampling === "jitter";
  // Auto count follows the box's size on screen: about one arrow per 75 px
  // across a volume, one per 34 px across a slice or a surface, so the field
  // reads the same whether the box fills the view or a corner of it.
  const autoCount = volume
    ? clamp(Math.round(lastBoxPx / 75), 4, 12)
    : clamp(Math.round(lastBoxPx / 34), 8, 32);
  const count = state.count.auto
    ? autoCount
    : clamp(Math.round(state.count.value), 1, 64);
  const instances = volume ? count ** 3 : count ** 2;
  // Solid glyphs until the field is dense enough that their shading turns
  // into noise and their vertices into cost; flat arrows past that.
  const autoShape: Shape = instances <= 3000 ? "solid" : "flat";
  const shape = state.shape.auto ? autoShape : state.shape.value;
  const spacing = 2 / count;
  const lengthMultiple = state.length.auto ? 0.8 : state.length.value;
  const widths = [0, 1, 2].map((i) => state.box.max[i] - state.box.min[i]);
  // The 2D overlay's scale is a third of the viewport's width; the nearest
  // thing in 3D is a third of the box's mean width. Measured on a point
  // charge, that leaves 97% of the arrows in the first tenth of the ramp: an
  // inverse-square field is small almost everywhere in a box, and a rule
  // about the box knows nothing about the field. The field rule puts the
  // median magnitude in the middle of the ramp instead (1 − e^(−ln 2) = ½).
  // A median survives poles by construction: a pole moves a handful of
  // samples, and the median does not care how large those few are.
  const boxScale = (widths[0] + widths[1] + widths[2]) / 9;
  const autoScale =
    state.scaleRule === "field" &&
    Number.isFinite(fieldMedian) &&
    fieldMedian > 0
      ? fieldMedian / Math.LN2
      : boxScale;
  const speedScale = state.scale.auto
    ? autoScale
    : Math.max(1e-6, state.scale.value);
  const autoMesh = autoMeshResolution();
  // Enough lines to fill the box with threads at about one per 9 px of its
  // on-screen size, and a cloud of about half a point per square pixel of it:
  // dense enough to read as a volume, faint enough to see through.
  const autoLines = clamp(Math.round((lastBoxPx / 9) ** 2), 800, 6000);
  const autoPoints = clamp(Math.round(0.5 * lastBoxPx ** 2), 40000, 400000);
  const meshResolution = state.mesh.auto ? autoMesh : state.mesh.value;
  return {
    shape,
    sampling,
    count,
    sliceAxis: state.sliceAxis,
    slicePosition: state.slicePosition,
    lengthMode: state.lengthMode,
    length: lengthMultiple * spacing,
    widthPx: state.widthPx,
    colorMode: state.colorMode,
    palette: state.palette,
    fixedColor: [0.18, 0.38, 0.72],
    speedScale,
    shading: state.shading,
    fog: state.fog,
    outline: state.outline,
    selfDepth: state.selfDepth,
    occlusion: state.occlusion,
    meshResolution,
    clip: state.clip,
    look: state.look,
    cutaway: state.cutaway,
    cutAngle: state.cutAngle,
    cutTurn: state.cutTurn,
    lines: state.lines.auto
      ? autoLines
      : clamp(Math.round(state.lines.value), 1, 40000),
    steps: 96,
    lineLength: state.lineLength,
    lineOpacity: state.lineOpacity,
    points: state.points.auto
      ? autoPoints
      : clamp(Math.round(state.points.value), 1, 2000000),
    pointPx: state.pointPx,
    cloudOpacity: state.cloudOpacity,
    cloudContrast: state.cloudContrast,
    cloudByDirection: state.cloudByDirection,
    animate: state.animate,
    flowSpeed: state.flowSpeed,
    flowWindow: state.flowWindow,
    time: performance.now() / 1000,
    autoNotes: {
      lines: autoLines.toLocaleString(),
      points: autoPoints.toLocaleString(),
      count: `${autoCount} per ${volume ? "axis" : "side"}`,
      shape: autoShape === "solid" ? "Shaded 3D" : "Flat",
      length: "0.8 × spacing",
      scale: fmt(autoScale),
      mesh: `${autoMesh}`,
    },
  };
}

// ---------------------------------------------------------------- measurement
/**
 * How far a mesh of `res` cells per side strays from the true surface, in
 * screen pixels, measured where a triangle mesh is worst: the middle of each
 * cell's diagonal and of its edges. An arrow closer than this to the surface
 * may be hidden or shown wrongly by our depth-only copy.
 */
function meshGap(res: number): { worst: number; mean: number } | undefined {
  if (surfaceJs === undefined) return undefined;
  const camera = currentCamera();
  const { min, max } = state.box;
  const f = (x: number, y: number) => surfaceJs!([x, y]);
  let worst = 0;
  let sum = 0;
  let n = 0;
  const xs = (i: number) => min[0] + ((max[0] - min[0]) * i) / res;
  const ys = (j: number) => min[1] + ((max[1] - min[1]) * j) / res;
  const corner: number[] = [];
  for (let j = 0; j <= res; j++)
    for (let i = 0; i <= res; i++) corner.push(f(xs(i), ys(j)));
  const at = (i: number, j: number) => corner[j * (res + 1) + i];
  const probe = (x: number, y: number, meshZ: number) => {
    const z = f(x, y);
    if (!Number.isFinite(z) || !Number.isFinite(meshZ)) return;
    if (z < min[2] || z > max[2]) return;
    const a = projectToScreen(camera, x, y, z);
    const b = projectToScreen(camera, x, y, meshZ);
    if (a === undefined || b === undefined) return;
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    worst = Math.max(worst, d);
    sum += d;
    n++;
  };
  for (let j = 0; j < res; j++) {
    for (let i = 0; i < res; i++) {
      const x0 = xs(i),
        x1 = xs(i + 1),
        y0 = ys(j),
        y1 = ys(j + 1);
      probe((x0 + x1) / 2, (y0 + y1) / 2, (at(i, j) + at(i + 1, j + 1)) / 2);
      probe((x0 + x1) / 2, y0, (at(i, j) + at(i + 1, j)) / 2);
      probe(x0, (y0 + y1) / 2, (at(i, j) + at(i, j + 1)) / 2);
    }
  }
  return n === 0 ? undefined : { worst, mean: sum / n };
}

const gapCache = new Map<number, ReturnType<typeof meshGap>>();
let gapKey = "";
function cachedGap(res: number) {
  const key = `${state.surface}|${state.box.min}|${state.box.max}|${lastBoxPx.toFixed(0)}`;
  if (key !== gapKey) {
    gapCache.clear();
    gapKey = key;
  }
  if (!gapCache.has(res)) gapCache.set(res, meshGap(res));
  return gapCache.get(res);
}

/** The coarsest mesh whose worst gap is under a pixel. */
function autoMeshResolution() {
  if (!surfaceOk) return 64;
  for (const res of MESH_CHOICES) {
    const gap = cachedGap(res);
    if (gap === undefined || gap.worst < 1) return res;
  }
  return MESH_CHOICES[MESH_CHOICES.length - 1];
}

function pcg(v: number) {
  const state_ = (Math.imul(v >>> 0, 747796405) + 2891336453) >>> 0;
  const word =
    Math.imul(
      ((state_ >>> ((state_ >>> 28) + 4)) ^ state_) >>> 0,
      277803737
    ) >>> 0;
  return ((word >>> 22) ^ word) >>> 0;
}

/** The field at every point the shader samples, evaluated on the CPU. */
function fieldStats(s: ArrowSettings) {
  const { min, max } = state.box;
  const n = s.count;
  const mix = (i: number, t: number) => min[i] + (max[i] - min[i]) * t;
  const magnitudes: number[] = [];
  const half = [0, 1, 2].map((i) => (max[i] - min[i]) / 2);
  const cap = 0.125 * 2 * Math.sqrt(3);
  let capped = 0;
  const total = instanceCount(s);
  for (let id = 0; id < total; id++) {
    let p: number[];
    if (s.sampling === "grid" || s.sampling === "jitter") {
      const t = [id % n, Math.floor(id / n) % n, Math.floor(id / (n * n))].map(
        (c) => (c + 0.5) / n
      );
      if (s.sampling === "jitter") {
        const h = [
          pcg(id),
          pcg((id ^ 0x9e3779b9) >>> 0),
          pcg((id ^ 0x85ebca6b) >>> 0),
        ];
        for (let k = 0; k < 3; k++)
          t[k] += ((h[k] / 4294967295 - 0.5) * 0.72) / n;
      }
      p = t.map((tk, k) => mix(k, tk));
    } else {
      const t = [((id % n) + 0.5) / n, (Math.floor(id / n) + 0.5) / n];
      if (s.sampling === "slice") {
        const u =
          s.sliceAxis === 0
            ? [s.slicePosition, t[0], t[1]]
            : s.sliceAxis === 1
              ? [t[0], s.slicePosition, t[1]]
              : [t[0], t[1], s.slicePosition];
        p = u.map((tk, k) => mix(k, tk));
      } else {
        const x = mix(0, t[0]);
        const y = mix(1, t[1]);
        const z = surfaceJs?.([x, y]) ?? NaN;
        if (!(z >= min[2] && z <= max[2])) continue;
        p = [x, y, z];
      }
    }
    const v = fieldJs.map((c) => c(p));
    if (v.some((c) => !Number.isFinite(c))) continue;
    const m = Math.hypot(v[0], v[1], v[2]);
    if (m <= 1e-9) continue;
    magnitudes.push(m);
    const wl = Math.hypot(v[0] / half[0], v[1] / half[1], v[2] / half[2]);
    const len =
      s.lengthMode === "normalized"
        ? s.length
        : s.lengthMode === "saturating"
          ? s.length * (1 - Math.exp(-m / s.speedScale))
          : s.lengthMode === "clamped"
            ? Math.min((s.length * m) / s.speedScale, 1.6 * s.length)
            : wl;
    if (len > cap) capped++;
  }
  magnitudes.sort((a, b) => a - b);
  const ramp = (m: number) => 1 - Math.exp(-m / s.speedScale);
  const drawn = magnitudes.length;
  return {
    drawn,
    median: drawn > 0 ? magnitudes[Math.floor(drawn / 2)] : NaN,
    max: drawn > 0 ? magnitudes[drawn - 1] : NaN,
    saturated:
      drawn > 0 ? magnitudes.filter((m) => ramp(m) > 0.95).length / drawn : 0,
    bottom:
      drawn > 0 ? magnitudes.filter((m) => ramp(m) < 0.1).length / drawn : 0,
    capped: drawn > 0 ? capped / drawn : 0,
  };
}

// ---------------------------------------------------------------- render
function cssSize() {
  const rect = stage.getBoundingClientRect();
  return { width: Math.max(1, rect.width), height: Math.max(1, rect.height) };
}

function currentCamera() {
  const { width, height } = cssSize();
  return buildCamera(state.box, state.view, width, height);
}

function readTheme(): Theme {
  const style = getComputedStyle(document.documentElement);
  const rgb = (name: string) => {
    const probe = document.createElement("span");
    probe.style.color = style.getPropertyValue(name);
    document.body.appendChild(probe);
    const m = getComputedStyle(probe)
      .color.match(/[\d.]+/g)!
      .map(Number);
    probe.remove();
    return [m[0] / 255, m[1] / 255, m[2] / 255] as [number, number, number];
  };
  const paper = rgb("--paper");
  return {
    paper,
    ink: rgb("--ink"),
    dark: paper[0] + paper[1] + paper[2] < 1.2,
  };
}

let theme = readTheme();
let statsDirty = true;
let lastStats: ReturnType<typeof fieldStats> | undefined;
let frameQueued = false;
let lastFrameTime = 0;
const frameIntervals: number[] = [];

function requestRender(fieldChanged = false) {
  if (fieldChanged) statsDirty = true;
  if (frameQueued) return;
  frameQueued = true;
  requestAnimationFrame(render);
}

function render(time: number) {
  frameQueued = false;
  if (lastFrameTime > 0) {
    frameIntervals.push(time - lastFrameTime);
    if (frameIntervals.length > 60) frameIntervals.shift();
  }
  lastFrameTime = time;
  if (state.spin) state.view.turn += 0.006;
  const camera = currentCamera();
  lastBoxPx = boxScreenSize(camera, state.box);
  let s = effective();
  if (statsDirty) {
    // The median does not depend on the colour scale, so one pass finds it
    // and a second reports the ramp under the scale it implies.
    fieldMedian = fieldStats(s).median;
    s = effective();
  }
  // The stand-in redraws, then the overlay redraws from the camera that
  // redraw used, in the same task: what the plugin's hook on
  // onRedraw3dResults will do.
  standIn.draw(camera, state.box, theme);
  const frame = overlay.draw(camera, state.box, s);
  if (statsDirty) {
    lastStats = fieldStats(s);
    statsDirty = false;
  }
  showReadouts(s, frame);
  const flowing = state.look === "streamlines" && state.animate;
  if (state.spin || benchmarkFrames > 0 || flowing) {
    if (benchmarkFrames > 0 && --benchmarkFrames === 0) finishBenchmark();
    requestRender();
  } else {
    lastFrameTime = 0;
  }
}

// ---------------------------------------------------------------- readouts
function fmt(v: number, digits = 3) {
  if (!Number.isFinite(v)) return "—";
  if (v !== 0 && (Math.abs(v) >= 1e4 || Math.abs(v) < 1e-3))
    return v.toExponential(2);
  return Number(v.toPrecision(digits)).toString();
}
const pct = (v: number) => `${(v * 100).toFixed(v > 0 && v < 0.01 ? 2 : 0)}%`;

let lastGap: ReturnType<typeof meshGap> | undefined;

function showReadouts(
  s: ReturnType<typeof effective>,
  frame: { instances: number; vertices: number; gpuMs?: number }
) {
  $("autoCount").textContent = s.autoNotes.count;
  $("autoShape").textContent = s.autoNotes.shape;
  $("autoLength").textContent = s.autoNotes.length;
  $("autoScale").textContent =
    `${s.autoNotes.scale} (${state.scaleRule === "field" ? "median |F| ÷ ln 2" : "box width ÷ 3"})`;
  syncChips("scaleRule", state.scaleRule);
  $("autoMesh").textContent = s.autoNotes.mesh;
  if (state.count.auto && document.activeElement !== $("count"))
    $<HTMLInputElement>("count").value = String(s.count);
  if (state.scale.auto && document.activeElement !== $("scale"))
    $<HTMLInputElement>("scale").value = fmt(s.speedScale);
  if (state.length.auto) $<HTMLInputElement>("length").value = "0.8";
  $("lengthValue").textContent =
    `${(state.length.auto ? 0.8 : state.length.value).toFixed(2)} × spacing`;
  syncChips("shape", state.shape.auto ? "auto" : state.shape.value);
  syncChips("mesh", state.mesh.auto ? "auto" : String(state.mesh.value));
  syncChips("sampling", s.sampling);

  $("mInstances").textContent = frame.instances.toLocaleString();
  $("mPerArrow").textContent =
    s.look === "streamlines"
      ? `${s.steps} per line`
      : s.look === "cloud"
        ? "1 per point"
        : `${verticesPerArrow(s.shape)} (${s.shape === "solid" ? "shaded 3D" : s.shape})`;
  $("mAskedLabel").textContent =
    s.look === "streamlines"
      ? "Lines"
      : s.look === "cloud"
        ? "Points tried"
        : "Arrows asked for";
  $("autoLines").textContent = s.autoNotes.lines;
  $("autoPoints").textContent = s.autoNotes.points;
  if (state.lines.auto && document.activeElement !== $("lines"))
    $<HTMLInputElement>("lines").value = String(s.lines);
  if (state.points.auto && document.activeElement !== $("points"))
    $<HTMLInputElement>("points").value = String(s.points);
  syncChips("look", state.look);
  for (const el of document.querySelectorAll<HTMLElement>("[data-look]")) {
    el.hidden = !el.dataset.look!.split(" ").includes(state.look);
  }
  $("lineLengthValue").textContent =
    `${Math.round(state.lineLength * 100)}% of the box`;
  $("lineOpacityValue").textContent = state.lineOpacity.toFixed(2);
  $("pointPxValue").textContent = `${state.pointPx} px`;
  $("cloudOpacityValue").textContent = state.cloudOpacity.toFixed(2);
  $("cloudContrastValue").textContent = state.cloudContrast.toFixed(1);
  syncChips("cutaway", state.cutaway);
  $("cutAngleRow").hidden = state.cutaway !== "wedge";
  syncChips("cutFacing", state.cutTurn === undefined ? "camera" : "fixed");
  $("cutTurnRow").hidden = state.cutTurn === undefined;
  if (state.cutTurn !== undefined) {
    const degrees = ((((state.cutTurn * 180) / Math.PI) % 360) + 360) % 360;
    if (document.activeElement !== $("cutTurn"))
      $<HTMLInputElement>("cutTurn").value = String(Math.round(degrees));
    $("cutTurnValue").textContent = `${Math.round(degrees)}°`;
  }
  $("cutAngleValue").textContent =
    `${Math.round((state.cutAngle * 180) / Math.PI)}°`;
  $("flowSpeedValue").textContent = `${state.flowSpeed.toFixed(2)} lines/s`;
  $("flowWindowValue").textContent =
    `${Math.round(state.flowWindow * 100)}% of a line`;
  $("mVertices").textContent = frame.vertices.toLocaleString();
  $("mGpu").textContent = overlay.hasTimer
    ? frame.gpuMs !== undefined
      ? `${frame.gpuMs.toFixed(2)} ms`
      : "measuring…"
    : "no GPU timer in this browser";
  const intervals = [...frameIntervals].sort((a, b) => a - b);
  $("mFps").textContent =
    intervals.length > 10
      ? `${(1000 / intervals[Math.floor(intervals.length / 2)]).toFixed(0)} fps`
      : "spin to measure";
  if (lastStats !== undefined) {
    $("mDrawn").textContent = lastStats.drawn.toLocaleString();
    $("mMedian").textContent = fmt(lastStats.median);
    $("mMax").textContent = fmt(lastStats.max);
    $("mSaturated").textContent = pct(lastStats.saturated);
    $("mBottom").textContent = pct(lastStats.bottom);
    $("mCapped").textContent = pct(lastStats.capped);
    const verdict = $("colourVerdict");
    if (lastStats.bottom > 0.6) {
      verdict.className = "verdict warn";
      verdict.textContent = `Most arrows (${pct(lastStats.bottom)}) sit in the first tenth of the ramp: the scale is too large for this field. Lower it to spread the colours.`;
    } else if (lastStats.saturated > 0.4) {
      verdict.className = "verdict warn";
      verdict.textContent = `${pct(lastStats.saturated)} of arrows are at the end of the ramp: the scale is too small for this field.`;
    } else {
      verdict.className = "verdict good";
      verdict.textContent =
        "The colours spread across the ramp. Arrows near a pole run into its end, as they should.";
    }
  }
  lastGap = surfaceOk ? cachedGap(s.meshResolution) : undefined;
  $("mGap").textContent =
    lastGap === undefined
      ? "no surface"
      : `${lastGap.worst.toFixed(2)} px worst, ${lastGap.mean.toFixed(2)} px mean`;
  $("meshRow").hidden = state.occlusion === "over";
  $("sliceRow").hidden = state.sampling !== "slice";
  $("slicePosValue").textContent = fmt(
    state.box.min[state.sliceAxis] +
      (state.box.max[state.sliceAxis] - state.box.min[state.sliceAxis]) *
        state.slicePosition
  );
  $("perspectiveValue").textContent =
    state.view.perspective === 0
      ? "0 (orthographic)"
      : state.view.perspective.toFixed(1);
  $("opacityValue").textContent = state.surfaceOpacity.toFixed(2);
  $("widthValue").textContent = `${state.widthPx} px`;
  for (const button of document.querySelectorAll<HTMLButtonElement>(
    '[data-key="sampling"] [data-value="surface"]'
  )) {
    button.disabled = !surfaceOk;
  }
}

// ---------------------------------------------------------------- benchmark
let benchmarkFrames = 0;
function startBenchmark() {
  overlay.gpuMs = [];
  frameIntervals.length = 0;
  lastFrameTime = 0;
  benchmarkFrames = 90;
  $("benchmark").textContent = "Timing…";
  requestRender();
}
function finishBenchmark() {
  $("benchmark").textContent = "Time 90 frames";
  const intervals = [...frameIntervals].sort((a, b) => a - b);
  const gpu = [...overlay.gpuMs].sort((a, b) => a - b);
  const s = effective();
  $("benchmarkResult").textContent =
    `${instanceCount(s).toLocaleString()} arrows, ${s.shape === "solid" ? "shaded 3D" : s.shape}: ` +
    (gpu.length > 0
      ? `GPU ${gpu[Math.floor(gpu.length / 2)].toFixed(2)} ms median, `
      : "") +
    `${(1000 / intervals[Math.floor(intervals.length / 2)]).toFixed(0)} fps (both layers redrawn every frame).`;
}

// ---------------------------------------------------------------- controls
function syncChips(key: string, value: string) {
  for (const button of document.querySelectorAll<HTMLButtonElement>(
    `[data-key="${key}"] [data-value]`
  )) {
    button.setAttribute("aria-pressed", String(button.dataset.value === value));
  }
}

function onChips(key: string, handler: (value: string) => void) {
  const group = document.querySelector<HTMLElement>(`[data-key="${key}"]`)!;
  group.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "[data-value]"
    );
    if (button === null || button.disabled) return;
    handler(button.dataset.value!);
    syncChips(key, button.dataset.value!);
    requestRender(true);
  });
}

function toggle(id: string, get: () => boolean, set: (v: boolean) => void) {
  const button = $(id);
  const sync = () => button.setAttribute("aria-pressed", String(get()));
  sync();
  button.addEventListener("click", () => {
    set(!get());
    sync();
    requestRender(true);
  });
}

function buildPresetChips() {
  const fieldChips = document.querySelector('[data-key="preset"]')!;
  for (const [id, preset] of Object.entries(FIELD_PRESETS)) {
    const b = document.createElement("button");
    b.className = "chip";
    b.dataset.value = id;
    b.textContent = preset.name;
    fieldChips.appendChild(b);
  }
  const surfaceChips = document.querySelector('[data-key="surfacePreset"]')!;
  for (const [id, preset] of Object.entries(SURFACE_PRESETS)) {
    const b = document.createElement("button");
    b.className = "chip";
    b.dataset.value = id;
    b.textContent = preset.name;
    surfaceChips.appendChild(b);
  }
  const paletteChips = document.querySelector('[data-key="palette"]')!;
  for (const id of PALETTE_CHOICES) {
    const b = document.createElement("button");
    b.className = "chip swatch";
    b.dataset.value = id;
    b.title = PALETTES[id].name;
    b.innerHTML = `<span class="ramp" style="background:${paletteCSSGradient(id)}"></span>${PALETTES[id].name}`;
    paletteChips.appendChild(b);
  }
  const meshChips = document.querySelector('[data-key="mesh"]')!;
  for (const res of MESH_CHOICES) {
    const b = document.createElement("button");
    b.className = "chip";
    b.dataset.value = String(res);
    b.textContent = String(res);
    meshChips.appendChild(b);
  }
}

function setFieldInputs() {
  ["fieldP", "fieldQ", "fieldR"].forEach((id, i) => {
    $<HTMLInputElement>(id).value = state.field[i];
  });
  $("presetNote").textContent =
    FIELD_PRESETS[state.preset]?.note ?? "Your own field.";
}

function wire() {
  buildPresetChips();
  setFieldInputs();
  $<HTMLInputElement>("surface").value = state.surface;

  onChips("preset", (v) => {
    state.preset = v;
    state.field = [...FIELD_PRESETS[v].field];
    setFieldInputs();
    compileAll();
  });
  ["fieldP", "fieldQ", "fieldR"].forEach((id, i) => {
    $<HTMLInputElement>(id).addEventListener("input", (e) => {
      state.field[i] = (e.target as HTMLInputElement).value;
      state.preset = "";
      syncChips("preset", "");
      $("presetNote").textContent = "Your own field.";
      compileAll();
      requestRender(true);
    });
  });
  onChips("surfacePreset", (v) => {
    state.surfacePreset = v;
    state.surface = SURFACE_PRESETS[v].latex;
    $<HTMLInputElement>("surface").value = state.surface;
    compileAll();
  });
  $<HTMLInputElement>("surface").addEventListener("input", (e) => {
    state.surface = (e.target as HTMLInputElement).value;
    syncChips("surfacePreset", "");
    compileAll();
    requestRender(true);
  });

  onChips("shape", (v) => {
    state.shape =
      v === "auto"
        ? { auto: true, value: state.shape.value }
        : { auto: false, value: v as Shape };
  });
  onChips("sampling", (v) => {
    state.sampling = v as Sampling;
  });
  onChips("sliceAxis", (v) => {
    state.sliceAxis = Number(v) as 0 | 1 | 2;
  });
  $<HTMLInputElement>("slicePos").addEventListener("input", (e) => {
    state.slicePosition = Number((e.target as HTMLInputElement).value);
    requestRender(true);
  });
  toggle(
    "countAuto",
    () => state.count.auto,
    (v) => (state.count.auto = v)
  );
  $<HTMLInputElement>("count").addEventListener("input", (e) => {
    const value = Number((e.target as HTMLInputElement).value);
    if (!(value >= 1)) return;
    state.count = { auto: false, value };
    $("countAuto").setAttribute("aria-pressed", "false");
    requestRender(true);
  });
  onChips("lengthMode", (v) => {
    state.lengthMode = v as LengthMode;
  });
  toggle(
    "lengthAuto",
    () => state.length.auto,
    (v) => (state.length.auto = v)
  );
  $<HTMLInputElement>("length").addEventListener("input", (e) => {
    state.length = {
      auto: false,
      value: Number((e.target as HTMLInputElement).value),
    };
    $("lengthAuto").setAttribute("aria-pressed", "false");
    requestRender(true);
  });
  $<HTMLInputElement>("width").addEventListener("input", (e) => {
    state.widthPx = Number((e.target as HTMLInputElement).value);
    requestRender();
  });
  onChips("colorMode", (v) => {
    state.colorMode = v as "magnitude" | "fixed";
  });
  onChips("palette", (v) => {
    state.palette = v as PaletteID;
  });
  toggle(
    "scaleAuto",
    () => state.scale.auto,
    (v) => (state.scale.auto = v)
  );
  onChips("scaleRule", (v) => {
    state.scaleRule = v as "field" | "box";
    state.scale = { auto: true, value: state.scale.value };
    $("scaleAuto").setAttribute("aria-pressed", "true");
  });
  $<HTMLInputElement>("scale").addEventListener("input", (e) => {
    const value = Number((e.target as HTMLInputElement).value);
    if (!(value > 0)) return;
    state.scale = { auto: false, value };
    $("scaleAuto").setAttribute("aria-pressed", "false");
    requestRender(true);
  });
  toggle(
    "cueShading",
    () => state.shading,
    (v) => (state.shading = v)
  );
  toggle(
    "cueFog",
    () => state.fog,
    (v) => (state.fog = v)
  );
  toggle(
    "cueOutline",
    () => state.outline,
    (v) => (state.outline = v)
  );
  toggle(
    "cueDepth",
    () => state.selfDepth,
    (v) => (state.selfDepth = v)
  );
  toggle(
    "clip",
    () => state.clip,
    (v) => (state.clip = v)
  );
  onChips("cutFacing", (v) => {
    // Fixing the slice keeps it where it is now, so switching never jumps.
    state.cutTurn = v === "fixed" ? overlay.cameraAzimuth : undefined;
  });
  $<HTMLInputElement>("cutTurn").addEventListener("input", (e) => {
    state.cutTurn =
      (Number((e.target as HTMLInputElement).value) * Math.PI) / 180;
    syncChips("cutFacing", "fixed");
    requestRender();
  });
  onChips("cutaway", (v) => {
    state.cutaway = v as Cutaway;
  });
  onChips("look", (v) => {
    state.look = v as Look;
  });
  if (!overlay.canTrace) {
    const b = document.querySelector<HTMLButtonElement>(
      '[data-key="look"] [data-value="streamlines"]'
    )!;
    b.disabled = true;
    b.title =
      "Streamlines need float render targets, which this browser lacks.";
  }
  toggle(
    "linesAuto",
    () => state.lines.auto,
    (v) => (state.lines.auto = v)
  );
  $<HTMLInputElement>("lines").addEventListener("input", (e) => {
    const value = Number((e.target as HTMLInputElement).value);
    if (!(value >= 1)) return;
    state.lines = { auto: false, value };
    $("linesAuto").setAttribute("aria-pressed", "false");
    requestRender();
  });
  toggle(
    "pointsAuto",
    () => state.points.auto,
    (v) => (state.points.auto = v)
  );
  $<HTMLInputElement>("points").addEventListener("input", (e) => {
    const value = Number((e.target as HTMLInputElement).value);
    if (!(value >= 1)) return;
    state.points = { auto: false, value };
    $("pointsAuto").setAttribute("aria-pressed", "false");
    requestRender();
  });
  const slider = (id: string, set: (v: number) => void) =>
    $<HTMLInputElement>(id).addEventListener("input", (e) => {
      set(Number((e.target as HTMLInputElement).value));
      requestRender();
    });
  slider("lineLength", (v) => (state.lineLength = v));
  slider("lineOpacity", (v) => (state.lineOpacity = v));
  slider("pointPx", (v) => (state.pointPx = v));
  slider("cloudOpacity", (v) => (state.cloudOpacity = v));
  slider("cloudContrast", (v) => (state.cloudContrast = v));
  slider("cutAngle", (v) => (state.cutAngle = (v * Math.PI) / 180));
  slider("flowSpeed", (v) => (state.flowSpeed = v));
  slider("flowWindow", (v) => (state.flowWindow = v));
  toggle(
    "animate",
    () => state.animate,
    (v) => (state.animate = v)
  );
  onChips("occlusion", (v) => {
    state.occlusion = v as Occlusion;
  });
  onChips("mesh", (v) => {
    state.mesh =
      v === "auto"
        ? { auto: true, value: state.mesh.value }
        : { auto: false, value: Number(v) };
  });
  $<HTMLInputElement>("opacity").addEventListener("input", (e) => {
    state.surfaceOpacity = Number((e.target as HTMLInputElement).value);
    standIn.surfaceOpacity = state.surfaceOpacity;
    requestRender();
  });
  $<HTMLInputElement>("perspective").addEventListener("input", (e) => {
    state.view.perspective = Number((e.target as HTMLInputElement).value);
    requestRender();
  });
  ["xmin", "ymin", "zmin", "xmax", "ymax", "zmax"].forEach((id) => {
    const input = $<HTMLInputElement>(id);
    const axis = "xyz".indexOf(id[0]);
    const end = id.endsWith("min") ? "min" : "max";
    input.value = String(state.box[end][axis]);
    input.addEventListener("input", () => {
      const value = Number(input.value);
      if (!Number.isFinite(value)) return;
      const next = { min: [...state.box.min], max: [...state.box.max] } as Box;
      next[end][axis] = value;
      if (!(next.max[axis] > next.min[axis])) return;
      state.box = next;
      requestRender(true);
    });
  });
  toggle(
    "spin",
    () => state.spin,
    (v) => (state.spin = v)
  );
  $("resetView").addEventListener("click", () => {
    state.view = {
      turn: -0.65,
      tilt: 0.42,
      zoom: 1,
      perspective: state.view.perspective,
    };
    requestRender(true);
  });
  $("benchmark").addEventListener("click", startBenchmark);

  // Rotation and zoom, as Desmos 3D does them: drag to turn and tilt, wheel to zoom.
  let drag: { x: number; y: number } | undefined;
  stage.addEventListener("pointerdown", (e) => {
    drag = { x: e.clientX, y: e.clientY };
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener("pointermove", (e) => {
    if (drag === undefined) return;
    state.view.turn += (e.clientX - drag.x) * 0.01;
    state.view.tilt = clamp(
      state.view.tilt + (e.clientY - drag.y) * 0.01,
      -1.55,
      1.55
    );
    drag = { x: e.clientX, y: e.clientY };
    requestRender();
  });
  const end = () => {
    drag = undefined;
    statsDirty = true;
    requestRender();
  };
  stage.addEventListener("pointerup", end);
  stage.addEventListener("pointercancel", end);
  stage.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      state.view.zoom = clamp(
        state.view.zoom * Math.exp(-e.deltaY * 0.0012),
        0.3,
        6
      );
      requestRender(true);
    },
    { passive: false }
  );

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const { width, height } = cssSize();
    for (const canvas of [desmosCanvas, overlayCanvas]) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }
    requestRender(true);
  };
  new ResizeObserver(resize).observe(stage);
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      theme = readTheme();
      requestRender();
    });
  new MutationObserver(() => {
    theme = readTheme();
    requestRender();
  }).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  syncChips("preset", state.preset);
  syncChips("surfacePreset", state.surfacePreset);
  syncChips("sliceAxis", String(state.sliceAxis));
  syncChips("lengthMode", state.lengthMode);
  syncChips("colorMode", state.colorMode);
  syncChips("palette", state.palette);
  syncChips("occlusion", state.occlusion);
  compileAll();
  resize();
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

/** For the measuring script: set state and read the numbers back. */
(window as unknown as { mockup: unknown }).mockup = {
  state,
  set(patch: Partial<typeof state>) {
    Object.assign(state, patch);
    if (patch.field !== undefined || patch.surface !== undefined) compileAll();
    standIn.surfaceOpacity = state.surfaceOpacity;
    requestRender(true);
  },
  preset(id: string) {
    state.preset = id;
    state.field = [...FIELD_PRESETS[id].field];
    setFieldInputs();
    syncChips("preset", id);
    compileAll();
    requestRender(true);
  },
  numbers() {
    const s = effective();
    return {
      settings: { ...s, autoNotes: s.autoNotes },
      stats: lastStats,
      gap: lastGap,
      gaps: Object.fromEntries(MESH_CHOICES.map((r) => [r, cachedGap(r)])),
      standInResolution: STANDIN_RESOLUTION,
      boxPx: lastBoxPx,
    };
  },
  benchmark: startBenchmark,
};

wire();
