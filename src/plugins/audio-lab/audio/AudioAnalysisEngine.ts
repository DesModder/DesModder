/**
 * The one place audio is measured.
 *
 * Both outputs — the Desmos expressions and the Audio Field canvas — read the
 * frame this engine publishes, on their own clocks. Neither drives the
 * analysis, which is what lets either be switched off without changing what the
 * other sees, and what stops the calculator's update rate from deciding how
 * smooth the particles are.
 *
 * The engine allocates its buffers once, at construction and on an fftSize
 * change, and reuses them for the life of the run. There is no allocation in
 * the steady loop.
 */
import {
  AdaptiveNormalizer,
  AsymmetricSmoother,
  BANDS,
  BeatTracker,
  DEFAULT_SPEED_OF_SOUND,
  OnsetDetector,
  SILENT_FRAME,
  bandDensity,
  clamp,
  decibelsToMagnitudes,
  interpolatedPeak,
  peakAmplitude,
  spectralCentroid,
  spectralFlux,
  type AudioFeatureFrame,
} from "./features";
import { rms } from "../dsp";

/**
 * Below this, "the dominant frequency" describes noise. Pitch detection is
 * skipped entirely and the frame reports no frequency, rather than a number
 * that skates across the spectrum while nothing is playing.
 */
const SILENCE_RMS = 0.0015;

/**
 * A peak has to stand this far above its shoulders before its frequency is
 * reported at all. Below it the frame keeps the last good value and lets
 * confidence fall, so a moment of noise inside a song does not blank the
 * readout.
 */
const MIN_PROMINENCE = 0.12;

/** How long an onset impulse takes to decay to nothing. */
const ONSET_DECAY_S = 0.35;

/** A tab that was hidden for a minute must not integrate a minute of silence. */
const MAX_DELTA_S = 0.1;

/**
 * The smallest reference a band may be scaled against, in units of the
 * spectrum's average density.
 *
 * Every per-band adaptive reference decays to meet whatever is steady, so on
 * its own it maps *any* constant input to 1 — including the analyser's own
 * noise floor sitting in a band nothing is playing in. A bass-only passage
 * would light the treble up as brightly as a cymbal crash.
 *
 * Flooring the reference at the spectrum's average density fixes the meaning of
 * a full reading: this band is at least as dense as the sound taken as a whole,
 * *and* at its own recent maximum. A band quieter than average scales down in
 * proportion, however steady it is.
 */
const MIN_BAND_REFERENCE = 1;

export class AudioAnalysisEngine {
  private magnitudes = new Float32Array(0);
  private previousMagnitudes = new Float32Array(0);
  private elapsed = 0;
  private onsetLevel = 0;
  private lastGoodHz = NaN;
  private speedOfSound = DEFAULT_SPEED_OF_SOUND;
  private frame: AudioFeatureFrame = SILENT_FRAME;

  // Loudness needs a fast attack so a hit reads immediately, and a slow release
  // so the meter does not strobe between beats.
  private readonly rmsSmoother = new AsymmetricSmoother(0.02, 0.16);
  // Pitch is smoothed symmetrically and slowly: it is a running estimate of one
  // continuing note, not an event, and asymmetry there reads as sliding pitch.
  private readonly pitchSmoother = new AsymmetricSmoother(0.08, 0.08);
  private readonly confidenceSmoother = new AsymmetricSmoother(0.05, 0.4);
  private readonly bands = {
    bass: new AdaptiveNormalizer(),
    mid: new AdaptiveNormalizer(),
    treble: new AdaptiveNormalizer(),
  };
  private readonly bandSmoothers = {
    bass: new AsymmetricSmoother(0.02, 0.14),
    mid: new AsymmetricSmoother(0.03, 0.16),
    treble: new AsymmetricSmoother(0.02, 0.1),
  };
  private readonly centroidSmoother = new AsymmetricSmoother(0.2, 0.2);
  private readonly onsets = new OnsetDetector();
  private readonly beats = new BeatTracker();

  /** The most recent frame. Safe to read at any rate, including not at all. */
  get latest() {
    return this.frame;
  }

  /** Metres per second used to turn a frequency into a wavelength. */
  setSpeedOfSound(metresPerSecond: number) {
    if (Number.isFinite(metresPerSecond) && metresPerSecond > 0)
      this.speedOfSound = metresPerSecond;
  }

  /**
   * Clears every running estimate.
   *
   * Called when the source changes: the adaptive band references and the beat
   * intervals describe the track that just stopped, and carrying them into a
   * new one leaves the first several seconds mis-scaled.
   */
  reset() {
    this.elapsed = 0;
    this.onsetLevel = 0;
    this.lastGoodHz = NaN;
    this.frame = SILENT_FRAME;
    this.rmsSmoother.reset();
    this.pitchSmoother.reset();
    this.confidenceSmoother.reset();
    this.centroidSmoother.reset();
    this.onsets.reset();
    this.beats.reset();
    for (const key of ["bass", "mid", "treble"] as const) {
      this.bands[key].reset();
      this.bandSmoothers[key].reset();
    }
    this.previousMagnitudes.fill(0);
  }

  /**
   * Measures one frame.
   *
   * `decibels` is the analyser's own dBFS output, left untouched so the panel
   * can draw it directly; the linear copy used for the arithmetic lives here.
   */
  update(
    samples: Float32Array,
    decibels: Float32Array,
    sampleRate: number,
    fftSize: number,
    deltaSeconds: number
  ): AudioFeatureFrame {
    const dt = clamp(deltaSeconds, 0, MAX_DELTA_S);
    this.elapsed += dt;
    this.resize(decibels.length);

    const magnitudes = decibelsToMagnitudes(decibels, this.magnitudes);
    const level = this.rmsSmoother.update(rms(samples), dt);
    const peak = peakAmplitude(samples);
    const silent = level < SILENCE_RMS;

    const flux = silent ? 0 : spectralFlux(magnitudes, this.previousMagnitudes);
    // Copied after the flux is taken, so the next frame compares against this
    // one. Reusing the buffer keeps the steady loop allocation-free.
    this.previousMagnitudes.set(magnitudes);

    if (this.onsets.update(flux, this.elapsed, dt)) {
      this.onsetLevel = 1;
      this.beats.onOnset(this.elapsed);
    } else {
      // Decays on elapsed time rather than per frame, so the pulse looks the
      // same at 60 and at 144 Hz.
      this.onsetLevel *= Math.exp(-dt / ONSET_DECAY_S);
      if (this.onsetLevel < 1e-4) this.onsetLevel = 0;
    }

    // Average magnitude per bin across the whole spectrum. Each band is
    // measured as a multiple of this, so "loud" means loud relative to the rest
    // of the sound rather than relative to a fixed scale that cannot serve both
    // a quiet acoustic take and a loud master.
    let total = 0;
    for (let i = 1; i < magnitudes.length; i++) total += magnitudes[i];
    const averageDensity = total / Math.max(1, magnitudes.length - 1);
    // Silence zeroes the bands outright; there is no ratio worth taking when
    // there is nothing to take it against.
    const scale = silent || averageDensity <= 0 ? 0 : averageDensity;

    const { hz, prominence } = silent
      ? { hz: NaN, prominence: 0 }
      : interpolatedPeak(magnitudes, sampleRate, fftSize);
    // A confident peak updates the estimate; an unconfident one leaves it where
    // it was and lets confidence fall, so a snare hit over a held note does not
    // relabel the note.
    if (Number.isFinite(hz) && prominence >= MIN_PROMINENCE) {
      this.lastGoodHz = this.pitchSmoother.update(hz, dt);
    }
    const confidence = this.confidenceSmoother.update(
      silent ? 0 : clamp(prominence / 0.5, 0, 1),
      dt
    );
    const dominantHz =
      silent || !Number.isFinite(this.lastGoodHz) ? NaN : this.lastGoodHz;

    this.frame = {
      time: this.elapsed,
      rms: clamp(level, 0, 1),
      peak: clamp(peak, 0, 1),
      dominantHz,
      confidence,
      wavelength: Number.isFinite(dominantHz)
        ? this.speedOfSound / dominantHz
        : NaN,
      bass: this.band("bass", magnitudes, sampleRate, fftSize, dt, scale),
      mid: this.band("mid", magnitudes, sampleRate, fftSize, dt, scale),
      treble: this.band("treble", magnitudes, sampleRate, fftSize, dt, scale),
      centroid: this.centroidSmoother.update(
        silent ? 0 : spectralCentroid(magnitudes, sampleRate, fftSize),
        dt
      ),
      flux,
      onset: this.onsetLevel,
      beatPhase: this.beats.phaseAt(this.elapsed),
      bpm: this.beats.bpm,
      silent,
    };
    return this.frame;
  }

  private band(
    name: keyof typeof BANDS,
    magnitudes: Float32Array,
    sampleRate: number,
    fftSize: number,
    dt: number,
    averageDensity: number
  ) {
    const [low, high] = BANDS[name];
    // How many times denser this band is than the spectrum's average. A scale
    // of zero means silence, and the whole band goes with it.
    const share =
      averageDensity === 0
        ? 0
        : bandDensity(magnitudes, sampleRate, fftSize, low, high) /
          averageDensity;
    // Normalised before smoothing: smoothing an unbounded value and then
    // scaling it would let the reference chase its own lag.
    return this.bandSmoothers[name].update(
      this.bands[name].update(share, dt, MIN_BAND_REFERENCE),
      dt
    );
  }

  private resize(bins: number) {
    if (this.magnitudes.length === bins) return;
    this.magnitudes = new Float32Array(bins);
    this.previousMagnitudes = new Float32Array(bins);
  }
}
