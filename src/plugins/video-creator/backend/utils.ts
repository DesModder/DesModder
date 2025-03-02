import { Scale } from "../../../globals";

interface Bounds {
  left: number;
  right: number;
  bottom: number;
  top: number;
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#escaping
export function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Scales x coordinates by a factor of xr about center, and
 * scales y coordinates by a factor of yr about center.
 * This is all from the perspective of pixels.
 */
export function scaleBoundsAboutCenter(
  b: Bounds,
  xr: number,
  yr: number,
  scales: {
    xAxisScale: Scale;
    yAxisScale: Scale;
  }
) {
  const { lo: left, hi: right } = scaleIntervalAboutCenter(
    b.left,
    b.right,
    xr,
    scales.xAxisScale
  );
  const { lo: bottom, hi: top } = scaleIntervalAboutCenter(
    b.bottom,
    b.top,
    yr,
    scales.yAxisScale
  );
  return { left, right, bottom, top };
}

function scaleIntervalAboutCenter(
  lo: number,
  hi: number,
  r: number,
  scale: Scale
) {
  switch (scale) {
    case "logarithmic":
      return scaleLogAboutCenter(lo, hi, r);
    case "linear":
    default:
      return scaleLinAboutCenter(lo, hi, r);
  }
}

function scaleLinAboutCenter(lo: number, hi: number, r: number) {
  const dx = (hi - lo) * ((r - 1) / 2);
  // After this, `hi - lo` becomes `(hi - lo) - 2 * dx`
  // which equals `(hi - lo) * (r - 1 + 1)`.
  return {
    lo: lo - dx,
    hi: hi + dx,
  };
}

function scaleLogAboutCenter(lo: number, hi: number, r: number) {
  const dx = (hi / lo) ** ((r - 1) / 2);
  // After this, `hi / lo` becomes `(hi / lo) * dx ** 2`
  // which equals `(hi / lo) ** (r - 1 + 1)`.
  return {
    lo: lo / dx,
    hi: hi * dx,
  };
}
/**
 * Segment [lo, hi] into `count` intervals.
 * Guarantees the first interval matches lo, and the last interval matches hi,
 * and [lo, hi] of the intervals in between
 */
export function segmentInterval(
  lo: number,
  hi: number,
  count: number,
  scale: Scale
): readonly (readonly [number, number])[] {
  let range;
  switch (scale) {
    case "logarithmic":
      range = logspace(lo, hi, count);
      break;
    case "linear":
    default:
      range = linspace(lo, hi, count);
      break;
  }
  const out: [number, number][] = [];
  let left = range.next().value!;
  for (const right of range) {
    out.push([left, right]);
    left = right;
  }
  return out;
}

/**
 * Assumes count is an integer at least 1.
 * Yields count+1 numbers, logarithmically spaced,
 * where the middle count-1 are fresh,
 * the first is lo, and the last is hi.
 */
function* logspace(lo: number, hi: number, count: number) {
  yield lo;
  for (let i = 1; i < count; i++) {
    yield lo ** ((count - i) / count) * hi ** (i / count);
  }
  yield hi;
}

/**
 * Assumes count is an integer at least 1.
 * Yields count+1 numbers, linearly spaced,
 * where the middle count-1 are fresh,
 * the first is lo, and the last is hi.
 */
function* linspace(lo: number, hi: number, count: number) {
  yield lo;
  for (let i = 1; i < count; i++) {
    yield lo * ((count - i) / count) + hi * (i / count);
  }
  yield hi;
}
