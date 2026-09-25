/**
 * Turns one analyser frame into the small set of numbers everything else in
 * Audio Lab consumes.
 *
 * Every output is bounded, finite, and frame-rate independent: the smoothers
 * take a real elapsed time rather than a frame count, so a 144 Hz monitor and a
 * 60 Hz monitor settle at the same speed. Nothing here writes to Desmos or
 * touches WebGL — the engine produces a frame, and the two consumers read it on
 * their own clocks.
 */

/** Speed of sound in dry air at 20 °C, the value physics classes start from. */
export const DEFAULT_SPEED_OF_SOUND = 343;

/**
 * Bands are named for what a listener hears, not for a standard. The edges are
 * the usual ones for music visualisation: bass ends where kick and bass guitar
 * stop dominating, treble starts around cymbals and consonants.
 */
export const BANDS = {
  bass: [20, 250],
  mid: [250, 2000],
  treble: [2000, 12000],
} as const;

/** DC and room rumble are loud and never the note being played. */
const MIN_PITCH_HZ = 40;
/** Above this a dominant peak is a cymbal, not a pitch worth reporting. */
const MAX_PITCH_HZ = 5000;

/** Onsets closer together than this are one drum hit, not two. */
const ONSET_REFRACTORY_S = 0.12;

/** 240 BPM and 30 BPM. Outside this, the estimate is not a musical tempo. */
const MIN_BEAT_PERIOD_S = 0.25;
const MAX_BEAT_PERIOD_S = 2;

export interface AudioFeatureFrame {
  /** Seconds of analysis clock since the engine started. */
  readonly time: number;
  /** Smoothed loudness, 0-1. */
  readonly rms: number;
  /** Largest absolute sample this frame, 0-1. Near 1 means clipping. */
  readonly peak: number;
  /** Dominant frequency in hertz, or NaN when no stable peak was found. */
  readonly dominantHz: number;
  /** How much to trust `dominantHz`, 0-1. */
  readonly confidence: number;
  /** `speedOfSound / dominantHz`, or NaN when there is no frequency. */
  readonly wavelength: number;
  /** Band energies, each adaptively normalised to 0-1. */
  readonly bass: number;
  readonly mid: number;
  readonly treble: number;
  /** Energy-weighted mean frequency, log-normalised to 0-1. Brightness. */
  readonly centroid: number;
  /** Positive spectral change since the previous frame, 0-1. */
  readonly flux: number;
  /** Decaying impulse fired on an accepted onset, 0-1. */
  readonly onset: number;
  /**
   * How many onsets have been accepted since the engine last reset.
   *
   * A counter rather than a flag, because the consumers read frames on their
   * own clocks and several of them are faster than the analysis. A flag would
   * be seen set on three consecutive reads of the same frame and be acted on
   * three times; a count that has not moved is unmistakably the same onset.
   */
  readonly onsetCount: number;
  /** Position within the estimated beat, 0-1. */
  readonly beatPhase: number;
  /** Estimated tempo, or NaN before enough onsets have been seen. */
  readonly bpm: number;
  /** Whether the signal is too quiet to describe. */
  readonly silent: boolean;
}

export const SILENT_FRAME: AudioFeatureFrame = {
  time: 0,
  rms: 0,
  peak: 0,
  dominantHz: NaN,
  confidence: 0,
  wavelength: NaN,
  bass: 0,
  mid: 0,
  treble: 0,
  centroid: 0,
  flux: 0,
  onset: 0,
  onsetCount: 0,
  beatPhase: 0,
  bpm: NaN,
  silent: true,
};

export function clamp(value: number, low: number, high: number) {
  if (!Number.isFinite(value)) return low;
  return value < low ? low : value > high ? high : value;
}

/** The largest absolute sample in the buffer. */
export function peakAmplitude(samples: Float32Array) {
  let peak = 0;
  for (const sample of samples) {
    const magnitude = Math.abs(sample);
    if (magnitude > peak) peak = magnitude;
  }
  return Number.isFinite(peak) ? peak : 0;
}

/**
 * Converts a decibel spectrum into linear magnitudes.
 *
 * `getFloatFrequencyData` reports dBFS, which is convenient to draw and wrong
 * to add: energy in a band is a sum of magnitudes, and summing decibels
 * averages exponents instead. Bins at or below the analyser's floor become
 * exactly zero, so silence contributes nothing rather than a small constant.
 */
export function decibelsToMagnitudes(
  decibels: Float32Array,
  out: Float32Array,
  floorDb = -100
) {
  for (let i = 0; i < decibels.length; i++) {
    const db = decibels[i];
    out[i] = Number.isFinite(db) && db > floorDb ? 10 ** (db / 20) : 0;
  }
  return out;
}

/** The frequency at the centre of bin `index`. */
export function binToHz(index: number, sampleRate: number, fftSize: number) {
  return (index * sampleRate) / fftSize;
}

/** The bin whose centre is nearest `hz`. */
export function hzToBin(hz: number, sampleRate: number, fftSize: number) {
  return Math.round((hz * fftSize) / sampleRate);
}

export interface SpectralPeak {
  /** Refined peak frequency, or NaN when the range held nothing. */
  readonly hz: number;
  readonly magnitude: number;
  /** How far the peak stands above its own shoulders, 0-1. */
  readonly prominence: number;
}

/**
 * Locates the strongest spectral peak between two frequencies, refining it past
 * the bin grid.
 *
 * A 2048-point FFT at 48 kHz has bins 23 Hz apart, which is most of a semitone
 * down at A2 — reporting a bin centre would quantise every pitch to that grid.
 * Fitting a parabola through the peak bin and its two neighbours recovers the
 * true maximum, which is the standard correction and costs three arithmetic
 * operations.
 *
 * Prominence separates a pitch from a hiss: a pure tone towers over its
 * neighbouring bins, while broadband noise barely rises above them at all.
 */
export function interpolatedPeak(
  magnitudes: Float32Array,
  sampleRate: number,
  fftSize: number,
  minHz = MIN_PITCH_HZ,
  maxHz = MAX_PITCH_HZ
): SpectralPeak {
  const lowest = Math.max(1, hzToBin(minHz, sampleRate, fftSize));
  const highest = Math.min(
    magnitudes.length - 2,
    hzToBin(maxHz, sampleRate, fftSize)
  );
  let index = -1;
  let best = 0;
  for (let i = lowest; i <= highest; i++) {
    if (magnitudes[i] > best) {
      best = magnitudes[i];
      index = i;
    }
  }
  if (index < 0) return { hz: NaN, magnitude: 0, prominence: 0 };

  const left = magnitudes[index - 1];
  const right = magnitudes[index + 1];
  const shift = peakOffset(left, best, right);

  const shoulder = Math.max(left, right);
  const prominence = best === 0 ? 0 : (best - shoulder) / best;

  return {
    hz: binToHz(index + shift, sampleRate, fftSize),
    magnitude: best,
    prominence: clamp(prominence, 0, 1),
  };
}

/**
 * Where between bins the true peak lies, from the peak bin and its two
 * neighbours, in bins: −½ to ½.
 *
 * The parabola is fitted to the logarithms of the magnitudes, not to the
 * magnitudes. A window's main lobe is close to a Gaussian, and the log of a
 * Gaussian is exactly a parabola; the lobe itself is not. For the Blackman
 * window the analyser applies, the linear fit is off by up to 0.044 of a bin
 * — at 23 Hz a bin, 16 cents at A2 — and the log fit by 0.0066. (J. O. Smith
 * and X. Serra, "PARSHL", 1987: quadratic interpolation of the dB spectrum.)
 */
export function peakOffset(left: number, centre: number, right: number) {
  // A bin at exactly zero has no logarithm; the floor is far below anything
  // the analyser reports.
  const floor = 1e-30;
  const l = Math.log(Math.max(left, floor));
  const c = Math.log(Math.max(centre, floor));
  const r = Math.log(Math.max(right, floor));
  const denominator = l - 2 * c + r;
  // A flat or upward-curving triple is not a peak to refine; keep the bin.
  if (!(denominator < 0)) return 0;
  return clamp((0.5 * (l - r)) / denominator, -0.5, 0.5);
}

/**
 * Mean magnitude per bin between two frequencies.
 *
 * Per bin, not summed: the treble band covers forty times as many bins as the
 * bass band, so a sum would report treble as the larger of the two for a signal
 * that is nothing but a bass note over a flat noise floor. Density asks how
 * loud the band is, not how wide it is.
 */
export function bandDensity(
  magnitudes: Float32Array,
  sampleRate: number,
  fftSize: number,
  lowHz: number,
  highHz: number
) {
  const first = Math.max(1, hzToBin(lowHz, sampleRate, fftSize));
  const last = Math.min(
    magnitudes.length - 1,
    hzToBin(highHz, sampleRate, fftSize)
  );
  if (last < first) return 0;
  let total = 0;
  for (let i = first; i <= last; i++) total += magnitudes[i];
  return total / (last - first + 1);
}

/**
 * Energy-weighted mean frequency, normalised against a log scale.
 *
 * Pitch is logarithmic, so a linear normalisation would crowd every musical
 * centroid into the bottom tenth of the range and leave the palette that reads
 * it nearly constant.
 */
export function spectralCentroid(
  magnitudes: Float32Array,
  sampleRate: number,
  fftSize: number
) {
  let weighted = 0;
  let total = 0;
  for (let i = 1; i < magnitudes.length; i++) {
    weighted += binToHz(i, sampleRate, fftSize) * magnitudes[i];
    total += magnitudes[i];
  }
  if (total === 0) return 0;
  const hz = weighted / total;
  const lowest = Math.log2(MIN_PITCH_HZ);
  const highest = Math.log2(sampleRate / 2);
  return clamp(
    (Math.log2(Math.max(hz, MIN_PITCH_HZ)) - lowest) / (highest - lowest),
    0,
    1
  );
}

/**
 * Positive frame-to-frame spectral change, normalised by the current spectrum.
 *
 * Only increases count: a note starting is an onset, a note ending is not, and
 * counting both would fire twice per event.
 */
export function spectralFlux(magnitudes: Float32Array, previous: Float32Array) {
  let rise = 0;
  let total = 0;
  for (let i = 1; i < magnitudes.length; i++) {
    const delta = magnitudes[i] - previous[i];
    if (delta > 0) rise += delta;
    total += magnitudes[i];
  }
  return total === 0 ? 0 : clamp(rise / total, 0, 1);
}

/**
 * Everything one pass over the spectrum can produce at once.
 *
 * The separate functions above each walk the whole array, and the engine used
 * to call five of them per frame: decibels to magnitudes, flux against the
 * previous frame, the copy that becomes the next frame's previous, the total
 * for the band reference, and the centroid. Five passes over two thousand bins,
 * sixty times a second, is four passes more than the arithmetic needs — and it
 * is main-thread time, competing with the calculator that is trying to render.
 *
 * The individual functions are kept, because they are what the tests reason
 * about and what a reader should look at to understand any one measurement.
 * `spectrumUnitTest` asserts this agrees with all of them on the same input,
 * which is the guard that stops the fused copy from drifting away from the
 * readable one.
 */
export interface SpectrumSummary {
  /** Positive frame-to-frame change, normalised. Matches `spectralFlux`. */
  flux: number;
  /** Mean magnitude per bin over the whole spectrum. */
  averageDensity: number;
  /** Log-normalised energy-weighted mean frequency. Matches `spectralCentroid`. */
  centroid: number;
}

/**
 * Converts, compares, copies, totals and weights in one walk.
 *
 * `previous` is both read and written: it holds the last frame on the way in
 * and this frame on the way out, which is what lets the steady loop keep two
 * buffers rather than allocating a third.
 */
export function summarizeSpectrum(
  decibels: Float32Array,
  magnitudes: Float32Array,
  previous: Float32Array,
  sampleRate: number,
  fftSize: number,
  floorDb = -100
): SpectrumSummary {
  let rise = 0;
  let total = 0;
  let weighted = 0;
  const bins = decibels.length;
  // Bin 0 is DC. Every measurement here starts at 1, so the conversion writes
  // it and nothing reads it, exactly as the separate functions do.
  const [firstDb] = decibels;
  magnitudes[0] =
    Number.isFinite(firstDb) && firstDb > floorDb ? 10 ** (firstDb / 20) : 0;
  const [firstMagnitude] = magnitudes;
  previous[0] = firstMagnitude;
  const hzPerBin = sampleRate / fftSize;
  for (let i = 1; i < bins; i++) {
    const db = decibels[i];
    magnitudes[i] = Number.isFinite(db) && db > floorDb ? 10 ** (db / 20) : 0;
    // Read back rather than reused: the array is 32-bit and the expression
    // above is 64-bit, so the two differ in the last few places. Everything
    // downstream sees the stored value, and a total taken from the unstored one
    // would be a total of numbers nothing else ever has.
    const magnitude = magnitudes[i];
    const delta = magnitude - previous[i];
    if (delta > 0) rise += delta;
    previous[i] = magnitude;
    total += magnitude;
    weighted += i * hzPerBin * magnitude;
  }

  let centroid = 0;
  if (total > 0) {
    const hz = weighted / total;
    const lowest = Math.log2(MIN_PITCH_HZ);
    const highest = Math.log2(sampleRate / 2);
    centroid = clamp(
      (Math.log2(Math.max(hz, MIN_PITCH_HZ)) - lowest) / (highest - lowest),
      0,
      1
    );
  }

  return {
    flux: total === 0 ? 0 : clamp(rise / total, 0, 1),
    averageDensity: total / Math.max(1, bins - 1),
    centroid,
  };
}

/**
 * The spectrum reduced to a bounded number of points for display.
 *
 * Each output point keeps the loudest bin it covers rather than their average,
 * so a narrow peak survives the reduction. Averaging would smear a pure tone
 * into a low bump and make the trace disagree with the frequency readout beside
 * it.
 */
export function spectrumPoints(
  magnitudes: Float32Array,
  sampleRate: number,
  fftSize: number,
  count: number,
  maxHz = 12000
): SpectralComponent[] {
  const highest = Math.min(
    magnitudes.length - 1,
    hzToBin(maxHz, sampleRate, fftSize)
  );
  if (highest < 1 || count <= 0) return [];

  let loudest = 0;
  for (let i = 1; i <= highest; i++)
    if (magnitudes[i] > loudest) loudest = magnitudes[i];
  if (loudest === 0) return [];

  const points: SpectralComponent[] = [];
  const bucket = highest / count;
  for (let index = 0; index < count; index++) {
    const start = Math.max(1, Math.floor(index * bucket));
    const end = Math.max(start + 1, Math.floor((index + 1) * bucket));
    let peak = 0;
    let peakIndex = start;
    for (let i = start; i < end && i <= highest; i++) {
      if (magnitudes[i] > peak) {
        peak = magnitudes[i];
        peakIndex = i;
      }
    }
    points.push({
      hz: binToHz(peakIndex, sampleRate, fftSize),
      amplitude: clamp(peak / loudest, 0, 1),
    });
  }
  return points;
}

export interface SpectralComponent {
  readonly hz: number;
  /** Magnitude relative to the strongest component, 0-1. */
  readonly amplitude: number;
}

/**
 * The strongest local maxima in the spectrum, loudest first.
 *
 * Local maxima rather than the largest bins, because the largest bins in a
 * single peak are that peak and its two shoulders — taking them by magnitude
 * alone returns one note three times and calls it a chord.
 *
 * Amplitudes come back relative to the loudest component, which is what the
 * additive reconstruction wants: a shape, not an absolute level.
 */
export function strongestComponents(
  magnitudes: Float32Array,
  sampleRate: number,
  fftSize: number,
  count: number,
  minHz = MIN_PITCH_HZ,
  maxHz = 12000
): SpectralComponent[] {
  const lowest = Math.max(1, hzToBin(minHz, sampleRate, fftSize));
  const highest = Math.min(
    magnitudes.length - 2,
    hzToBin(maxHz, sampleRate, fftSize)
  );
  const peaks: Array<{ index: number; magnitude: number }> = [];
  for (let i = lowest; i <= highest; i++) {
    const value = magnitudes[i];
    if (value > 0 && value >= magnitudes[i - 1] && value > magnitudes[i + 1])
      peaks.push({ index: i, magnitude: value });
  }
  peaks.sort((a, b) => b.magnitude - a.magnitude);

  const loudest = peaks[0]?.magnitude ?? 0;
  if (loudest === 0) return [];
  return peaks.slice(0, Math.max(0, count)).map(({ index, magnitude }) => {
    // Refined the same way the dominant peak is, so a component and the
    // dominant frequency agree when they are the same note.
    const shift = peakOffset(
      magnitudes[index - 1],
      magnitude,
      magnitudes[index + 1]
    );
    return {
      hz: binToHz(index + shift, sampleRate, fftSize),
      amplitude: clamp(magnitude / loudest, 0, 1),
    };
  });
}

/**
 * A value that rises quickly and falls slowly.
 *
 * A meter tracking the signal exactly would flicker every frame; one smoothed
 * symmetrically would round the leading edge off every drum hit. Separate
 * attack and release keep transients sharp and the decay readable.
 *
 * Both constants are time constants in seconds, applied against real elapsed
 * time, so the settle time does not change with the frame rate.
 */
export class AsymmetricSmoother {
  private value = 0;
  private attackSeconds: number;
  private releaseSeconds: number;

  constructor(
    private readonly baseAttack: number,
    private readonly baseRelease: number
  ) {
    this.attackSeconds = baseAttack;
    this.releaseSeconds = baseRelease;
  }

  /**
   * Scales both time constants away from the ones this was built with.
   *
   * Against the originals rather than the current values, so repeated calls
   * cannot compound: dragging the response control from snappy to smooth and
   * back has to land exactly where it started, and a smoother that multiplied
   * its own current constant would get slower every time it was touched.
   */
  setResponseScale(scale: number) {
    const safe = Number.isFinite(scale) && scale > 0 ? scale : 1;
    this.attackSeconds = this.baseAttack * safe;
    this.releaseSeconds = this.baseRelease * safe;
  }

  update(target: number, dt: number) {
    if (!Number.isFinite(target)) return this.value;
    const tau = target > this.value ? this.attackSeconds : this.releaseSeconds;
    // dt/(dt+tau) is the exponential step written so that dt = 0 holds the
    // value and a very long dt jumps straight to the target, with no branch.
    const alpha = tau <= 0 ? 1 : clamp(dt / (dt + tau), 0, 1);
    this.value += (target - this.value) * alpha;
    return this.value;
  }

  get current() {
    return this.value;
  }

  reset() {
    this.value = 0;
  }
}

/**
 * Scales an unbounded energy into 0-1 against a reference that follows the loud
 * parts of the recent past.
 *
 * A fixed scale cannot serve both a quiet acoustic track and a loud master, and
 * a peak-hold reference never recovers from one loud transient. This rises
 * instantly to a new maximum and decays back slowly, so a quiet passage
 * eventually reads as a full range again without one clap flattening the next
 * thirty seconds.
 */
export class AdaptiveNormalizer {
  private reference = 0;

  constructor(
    private readonly decaySeconds = 8,
    private readonly floor = 1e-4
  ) {}

  /**
   * `floor` raises the smallest reference this frame may divide by.
   *
   * Without it, anything steady eventually reads as 1: the reference decays to
   * meet a constant input whatever its size, so the analyser's own noise floor
   * in an unused band would report as full energy. Callers pass a floor tied to
   * the whole spectrum, which is what makes "loud for this band" mean something
   * relative to the rest of the sound.
   */
  update(value: number, dt: number, floor = this.floor) {
    if (!Number.isFinite(value) || value < 0) return 0;
    if (value > this.reference) this.reference = value;
    else {
      const alpha = clamp(dt / (dt + this.decaySeconds), 0, 1);
      this.reference += (value - this.reference) * alpha;
    }
    return clamp(value / Math.max(this.reference, floor, this.floor), 0, 1);
  }

  reset() {
    this.reference = 0;
  }
}

/**
 * Decides when a rise in spectral flux is an event.
 *
 * Two guards keep one drum hit from becoming three: the flux must fall back
 * below a release level before another onset can arm, and a refractory window
 * ignores everything for a moment after one fires.
 */
export class OnsetDetector {
  private armed = true;
  private lastOnsetTime = -Infinity;
  private readonly average = new AsymmetricSmoother(0.35, 0.35);

  constructor(
    private readonly riseFactor = 1.6,
    private readonly releaseFactor = 1.1
  ) {}

  /** Returns whether this frame is an accepted onset. */
  update(flux: number, time: number, dt: number) {
    const baseline = this.average.update(flux, dt);
    const trigger = Math.max(baseline * this.riseFactor, 0.02);
    const release = Math.max(baseline * this.releaseFactor, 0.01);

    if (!this.armed && flux < release) this.armed = true;
    if (!this.armed || flux < trigger) return false;
    if (time - this.lastOnsetTime < ONSET_REFRACTORY_S) return false;

    this.armed = false;
    this.lastOnsetTime = time;
    return true;
  }

  reset() {
    this.armed = true;
    this.lastOnsetTime = -Infinity;
    this.average.reset();
  }
}

/**
 * Estimates a beat period from the spacing of accepted onsets, and reports
 * where the current moment sits inside it.
 *
 * The median of recent intervals is used rather than the mean because one
 * missed or doubled onset moves a mean permanently and a median not at all.
 * Phase advances on the clock between onsets, so the pulse stays smooth through
 * a bar with no drum hit in it.
 */
export class BeatTracker {
  private readonly intervals: number[] = [];
  private lastOnsetTime = NaN;
  private periodSeconds = NaN;

  onOnset(time: number) {
    if (Number.isFinite(this.lastOnsetTime)) {
      const interval = time - this.lastOnsetTime;
      if (interval >= MIN_BEAT_PERIOD_S && interval <= MAX_BEAT_PERIOD_S) {
        this.intervals.push(interval);
        if (this.intervals.length > 8) this.intervals.shift();
        this.periodSeconds = median(this.intervals);
      }
    }
    this.lastOnsetTime = time;
  }

  phaseAt(time: number) {
    if (
      !Number.isFinite(this.periodSeconds) ||
      !Number.isFinite(this.lastOnsetTime)
    )
      return 0;
    const elapsed = (time - this.lastOnsetTime) / this.periodSeconds;
    return elapsed - Math.floor(elapsed);
  }

  get bpm() {
    return Number.isFinite(this.periodSeconds) ? 60 / this.periodSeconds : NaN;
  }

  reset() {
    this.intervals.length = 0;
    this.lastOnsetTime = NaN;
    this.periodSeconds = NaN;
  }
}

function median(values: readonly number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}
