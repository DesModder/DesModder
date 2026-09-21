/**
 * Builds the LaTeX Audio Lab writes into the graph.
 *
 * Kept apart from the adapter and free of calculator calls so the exact strings
 * can be asserted in a unit test — a malformed definition here is invisible
 * until a graph renders it, and by then it has already been written.
 */
import {
  IDS,
  MAX_COMPONENTS,
  TRACE_X,
  type WaveFunctionMode,
} from "./manifest";

/**
 * Rounds to a fixed number of places and strips the trailing zeros.
 *
 * Desmos re-parses everything written to it, so a value carrying seventeen
 * significant digits costs parse time on every one of a dozen updates a second
 * and shows the user a number no measurement justifies.
 */
export function num(value: number, places = 4) {
  if (!Number.isFinite(value)) return "0";
  const rounded = Number(value.toFixed(places));
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

export function listLatex(values: readonly number[], places = 4) {
  return `\\left[${values.map((value) => num(value, places)).join(",")}\\right]`;
}

/**
 * The plotted trace, as a point built from the two lists beside it.
 *
 * This replaced a literal list of 192 points, and the reason is arithmetic: the
 * same samples were being written to the graph twice, once as `Y_{wave}` and
 * again inside the point list, so every trace update carried about twice the
 * LaTeX Desmos then had to re-parse — eight times a second, on the main thread,
 * while the calculator was trying to render. Naming the lists sends the samples
 * once, and makes the trace an expression that never has to be rewritten at
 * all: it follows the lists.
 *
 * Desmos truncates an elementwise operation to the shorter of its lists, so a
 * moment where the two disagree in length draws the part they agree on rather
 * than failing. Avoiding that was the original reason for the literal list, and
 * it turns out not to need one.
 */
export function zippedLatex(xs: string, ys: string) {
  return `\\left(${xs},${ys}\\right)`;
}

/** Evenly spaced x coordinates across the trace window. */
export function traceXs(count: number) {
  if (count <= 0) return [];
  if (count === 1) return [TRACE_X.min];
  const span = TRACE_X.max - TRACE_X.min;
  return Array.from(
    { length: count },
    (_, i) => TRACE_X.min + (span * i) / (count - 1)
  );
}

export const SCALARS = {
  [IDS.time]: "t_{audio}",
  [IDS.amplitude]: "A_{audio}",
  [IDS.frequency]: "f_{audio}",
  [IDS.phase]: "\\phi_{audio}",
  [IDS.speed]: "c_{audio}",
  [IDS.bass]: "B_{audio}",
  [IDS.mid]: "M_{audio}",
  [IDS.treble]: "T_{audio}",
  [IDS.brightness]: "S_{audio}",
  [IDS.onset]: "O_{audio}",
  [IDS.beat]: "R_{audio}",
  [IDS.tempo]: "N_{audio}",
} as const;

export function scalarLatex(id: keyof typeof SCALARS, value: number) {
  return `${SCALARS[id]}=${num(value)}`;
}

/**
 * Wavelength is defined in the graph rather than computed here.
 *
 * The point of the variable is that a student can see where it comes from and
 * change the speed of sound to something other than air. Sending a finished
 * number would make it a readout instead of a relationship.
 */
export function wavelengthLatex() {
  return "\\lambda_{audio}=\\frac{c_{audio}}{f_{audio}}";
}

/**
 * The helper that maps an x on the trace window to a position in the sample
 * list, and the clamped integer below it.
 *
 * The clamp is what stops the interpolation reading one past the end of the
 * list at the right-hand edge, where `floor` lands exactly on the last index.
 */
export function sampleIndexLatex() {
  return `u_{audio}\\left(x\\right)=\\frac{x-\\left(${TRACE_X.min}\\right)}{${
    TRACE_X.max - TRACE_X.min
  }}\\left(\\operatorname{length}\\left(Y_{wave}\\right)-1\\right)+1`;
}

export function sampleFloorLatex() {
  return "i_{audio}\\left(x\\right)=\\min\\left(\\max\\left(\\operatorname{floor}\\left(u_{audio}\\left(x\\right)\\right),1\\right),\\operatorname{length}\\left(Y_{wave}\\right)-1\\right)";
}

/**
 * The user-facing function, in whichever of its three meanings is selected.
 *
 * One stable definition that reads live variables, never a new definition per
 * frame: the point of `W_audio(x)` is that a student can differentiate it,
 * intersect it, or plot it against something else, and every one of those
 * breaks if the expression is replaced twelve times a second.
 */
export function waveFunctionLatex(mode: WaveFunctionMode) {
  switch (mode) {
    case "representative":
      return "W_{audio}\\left(x\\right)=A_{audio}\\sin\\left(\\frac{2\\pi x}{\\lambda_{audio}}+\\phi_{audio}\\right)";
    case "recent":
      // Linear interpolation between the two samples either side of x, so the
      // trace is a function rather than a scatter of points.
      return (
        `W_{audio}\\left(x\\right)=\\left\\{${TRACE_X.min}\\le x\\le ${TRACE_X.max}:` +
        "Y_{wave}\\left[i_{audio}\\left(x\\right)\\right]+" +
        "\\left(Y_{wave}\\left[i_{audio}\\left(x\\right)+1\\right]-Y_{wave}\\left[i_{audio}\\left(x\\right)\\right]\\right)" +
        "\\left(u_{audio}\\left(x\\right)-i_{audio}\\left(x\\right)\\right)\\right\\}"
      );
    case "additive":
      // Desmos broadcasts over the three component lists and `total` sums the
      // result, so the whole partial reconstruction is one expression whose
      // definition never changes - only the lists it reads do.
      return "W_{audio}\\left(x\\right)=\\operatorname{total}\\left(A_{comp}\\sin\\left(\\frac{2\\pi F_{comp}x}{c_{audio}}+P_{comp}\\right)\\right)";
  }
}

export interface Component {
  readonly amplitude: number;
  readonly hz: number;
  readonly phase: number;
}

/**
 * The strongest components, as three parallel lists.
 *
 * Capped at eight. This is an approximation of the sound and is labelled as
 * one; it is not a way to reconstruct or export a recording.
 */
export function componentLatex(components: readonly Component[]) {
  const capped = components.slice(0, MAX_COMPONENTS);
  return {
    [IDS.componentA]: `A_{comp}=${listLatex(capped.map((c) => c.amplitude))}`,
    [IDS.componentF]: `F_{comp}=${listLatex(
      capped.map((c) => c.hz),
      2
    )}`,
    [IDS.componentP]: `P_{comp}=${listLatex(capped.map((c) => c.phase))}`,
  };
}
