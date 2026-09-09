/**
 * Gate 1's acceptance test: known test tones must produce the right RMS, bands,
 * peak, and frequency, and the smoothers must depend on elapsed time rather
 * than on how often they were called.
 */
import { AudioAnalysisEngine } from "./AudioAnalysisEngine";
import {
  AdaptiveNormalizer,
  AsymmetricSmoother,
  BeatTracker,
  OnsetDetector,
  bandDensity,
  decibelsToMagnitudes,
  interpolatedPeak,
  peakAmplitude,
  spectralCentroid,
  spectralFlux,
} from "./features";
import { rms } from "../dsp";

const RATE = 48000;
const FFT = 2048;
const BINS = FFT / 2;

function tone(hz: number, amplitude = 1, length = FFT) {
  return Float32Array.from({ length }, (_, i) =>
    Math.sin((2 * Math.PI * hz * i) / RATE)
  ).map((v) => v * amplitude);
}

/**
 * A stand-in for the analyser's dB output: one narrow peak at `hz` over a floor.
 * Real bins leak into their neighbours, and the parabolic refinement depends on
 * those shoulders, so they are modelled rather than left flat.
 */
function spectrumWithPeak(hz: number, peakDb = -6, floorDb = -95) {
  const centre = (hz * FFT) / RATE;
  return Float32Array.from({ length: BINS }, (_, i) => {
    const distance = Math.abs(i - centre);
    if (distance > 2) return floorDb;
    return floorDb + (peakDb - floorDb) * Math.exp(-(distance ** 2) / 0.9);
  });
}

describe("spectral primitives", () => {
  test("dB converts to linear magnitude and floors to zero", () => {
    const out = new Float32Array(4);
    decibelsToMagnitudes(
      Float32Array.from([0, -20, -100, -Infinity]),
      out,
      -100
    );
    expect(out[0]).toBeCloseTo(1, 6);
    expect(out[1]).toBeCloseTo(0.1, 6);
    expect(out[2]).toBe(0);
    expect(out[3]).toBe(0);
  });

  test("finds a peak off the bin grid", () => {
    // 440 Hz lands at bin 18.77 — deliberately between two bin centres, which
    // is exactly the case a bin-centre readout gets wrong.
    const magnitudes = decibelsToMagnitudes(
      spectrumWithPeak(440),
      new Float32Array(BINS)
    );
    const peak = interpolatedPeak(magnitudes, RATE, FFT);
    expect(peak.hz).toBeGreaterThan(430);
    expect(peak.hz).toBeLessThan(450);
    // The nearest bin centre is 445.3 Hz; refinement has to beat that.
    expect(Math.abs(peak.hz - 440)).toBeLessThan(Math.abs(445.3 - 440));
    expect(peak.prominence).toBeGreaterThan(0.5);
  });

  test("reports no peak for an empty spectrum", () => {
    const peak = interpolatedPeak(new Float32Array(BINS), RATE, FFT);
    expect(peak.hz).toBeNaN();
    expect(peak.prominence).toBe(0);
  });

  test("band density follows where the tone is", () => {
    const low = decibelsToMagnitudes(
      spectrumWithPeak(100),
      new Float32Array(BINS)
    );
    const high = decibelsToMagnitudes(
      spectrumWithPeak(6000),
      new Float32Array(BINS)
    );
    expect(bandDensity(low, RATE, FFT, 20, 250)).toBeGreaterThan(
      bandDensity(low, RATE, FFT, 2000, 12000)
    );
    expect(bandDensity(high, RATE, FFT, 2000, 12000)).toBeGreaterThan(
      bandDensity(high, RATE, FFT, 20, 250)
    );
  });

  test("centroid rises with brightness and stays inside 0-1", () => {
    const dark = spectralCentroid(
      decibelsToMagnitudes(spectrumWithPeak(120), new Float32Array(BINS)),
      RATE,
      FFT
    );
    const bright = spectralCentroid(
      decibelsToMagnitudes(spectrumWithPeak(8000), new Float32Array(BINS)),
      RATE,
      FFT
    );
    expect(bright).toBeGreaterThan(dark);
    for (const value of [dark, bright]) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  test("flux counts rises only", () => {
    const quiet = Float32Array.from({ length: 8 }, () => 0.1);
    const loud = Float32Array.from({ length: 8 }, () => 0.5);
    expect(spectralFlux(loud, quiet)).toBeGreaterThan(0);
    expect(spectralFlux(quiet, loud)).toBe(0);
    expect(spectralFlux(new Float32Array(8), new Float32Array(8))).toBe(0);
  });

  test("RMS and peak match a known tone", () => {
    const sine = tone(1000, 0.5);
    // A full-cycle sine has RMS = amplitude / sqrt(2).
    expect(rms(sine)).toBeCloseTo(0.5 / Math.SQRT2, 2);
    expect(peakAmplitude(sine)).toBeCloseTo(0.5, 2);
    expect(peakAmplitude(new Float32Array(16))).toBe(0);
  });
});

describe("smoothers", () => {
  test("attack is faster than release", () => {
    const smoother = new AsymmetricSmoother(0.01, 1);
    smoother.update(1, 0.02);
    const risen = smoother.current;
    smoother.update(0, 0.02);
    // 20 ms up should cover most of the way; 20 ms down almost none of it.
    expect(risen).toBeGreaterThan(0.6);
    expect(smoother.current).toBeGreaterThan(risen * 0.9);
  });

  test("settles on elapsed time, not on frame count", () => {
    const coarse = new AsymmetricSmoother(0.05, 0.05);
    const fine = new AsymmetricSmoother(0.05, 0.05);
    for (let i = 0; i < 30; i++) coarse.update(1, 1 / 30);
    for (let i = 0; i < 120; i++) fine.update(1, 1 / 120);
    // One second of signal, four times the frames: the same place.
    expect(fine.current).toBeCloseTo(coarse.current, 2);
  });

  test("adaptive normaliser jumps up and decays down", () => {
    const normalizer = new AdaptiveNormalizer(4);
    expect(normalizer.update(10, 0.02)).toBeCloseTo(1, 5);
    // Immediately after a loud frame, a tenth as loud reads as a tenth.
    expect(normalizer.update(1, 0.02)).toBeLessThan(0.2);
    for (let i = 0; i < 2000; i++) normalizer.update(1, 0.02);
    // Forty seconds later the reference has come down to meet it.
    expect(normalizer.update(1, 0.02)).toBeGreaterThan(0.9);
    expect(normalizer.update(-5, 0.02)).toBe(0);
  });
});

describe("onsets and beats", () => {
  test("one burst of flux fires one onset", () => {
    const detector = new OnsetDetector();
    let fired = 0;
    let time = 0;
    for (let i = 0; i < 6; i++) {
      time += 1 / 60;
      if (detector.update(0.9, time, 1 / 60)) fired++;
    }
    expect(fired).toBe(1);
  });

  test("a second hit after the refractory window is accepted", () => {
    const detector = new OnsetDetector();
    let time = 0;
    const step = (flux: number) => {
      time += 1 / 60;
      return detector.update(flux, time, 1 / 60);
    };
    expect(step(0.9)).toBe(true);
    // Quiet long enough to re-arm and clear the refractory interval.
    for (let i = 0; i < 20; i++) step(0.001);
    expect(step(0.9)).toBe(true);
  });

  test("beat phase wraps once per estimated period", () => {
    const beats = new BeatTracker();
    for (let i = 0; i < 5; i++) beats.onOnset(i * 0.5);
    expect(beats.bpm).toBeCloseTo(120, 5);
    expect(beats.phaseAt(2)).toBeCloseTo(0, 5);
    expect(beats.phaseAt(2.25)).toBeCloseTo(0.5, 5);
    expect(beats.phaseAt(2.5)).toBeCloseTo(0, 5);
  });

  test("an implausible interval does not become the tempo", () => {
    const beats = new BeatTracker();
    beats.onOnset(0);
    // 10 seconds apart is not a beat; the tracker should still have no estimate.
    beats.onOnset(10);
    expect(beats.bpm).toBeNaN();
    expect(beats.phaseAt(11)).toBe(0);
  });
});

describe("AudioAnalysisEngine", () => {
  const step = (
    engine: AudioAnalysisEngine,
    samples: Float32Array,
    decibels: Float32Array,
    frames: number
  ) => {
    let frame = engine.latest;
    for (let i = 0; i < frames; i++)
      frame = engine.update(samples, decibels, RATE, FFT, 1 / 60);
    return frame;
  };

  test("a steady tone produces its own frequency and wavelength", () => {
    const engine = new AudioAnalysisEngine();
    const frame = step(engine, tone(440, 0.5), spectrumWithPeak(440), 60);
    expect(frame.silent).toBe(false);
    expect(frame.rms).toBeCloseTo(0.5 / Math.SQRT2, 1);
    expect(frame.dominantHz).toBeGreaterThan(420);
    expect(frame.dominantHz).toBeLessThan(460);
    // 343 m/s at 440 Hz is about 78 cm.
    expect(frame.wavelength).toBeCloseTo(343 / frame.dominantHz, 5);
    expect(frame.confidence).toBeGreaterThan(0.3);
  });

  test("silence reports no frequency rather than a wrong one", () => {
    const engine = new AudioAnalysisEngine();
    const frame = step(
      engine,
      new Float32Array(FFT),
      new Float32Array(BINS).fill(-120),
      30
    );
    expect(frame.silent).toBe(true);
    expect(frame.dominantHz).toBeNaN();
    expect(frame.wavelength).toBeNaN();
    expect(frame.bass).toBe(0);
    expect(frame.onset).toBe(0);
  });

  test("a bass tone loads the bass band and a treble tone the treble", () => {
    const bass = step(
      new AudioAnalysisEngine(),
      tone(80, 0.6),
      spectrumWithPeak(80),
      90
    );
    const treble = step(
      new AudioAnalysisEngine(),
      tone(6000, 0.6),
      spectrumWithPeak(6000),
      90
    );
    expect(bass.bass).toBeGreaterThan(bass.treble);
    expect(treble.treble).toBeGreaterThan(treble.bass);
  });

  test("a steady noise floor in an unused band does not adapt its way to full", () => {
    // The adaptive reference decays to meet whatever is steady, so without a
    // spectrum-relative floor a bass-only tone reads as full treble after a few
    // seconds and drives the field as if a cymbal were ringing.
    const engine = new AudioAnalysisEngine();
    let frame = engine.latest;
    for (let i = 0; i < 600; i++)
      frame = engine.update(
        tone(80, 0.6),
        spectrumWithPeak(80),
        RATE,
        FFT,
        1 / 60
      );
    expect(frame.treble).toBeLessThan(0.5);
    expect(frame.bass).toBeGreaterThan(0.8);
  });

  test("every field stays finite and bounded under a clipped signal", () => {
    const engine = new AudioAnalysisEngine();
    const clipped = Float32Array.from({ length: FFT }, (_, i) =>
      i % 2 === 0 ? 4 : -4
    );
    const frame = step(engine, clipped, spectrumWithPeak(1000, 40), 30);
    expect(frame.peak).toBe(1);
    for (const value of [
      frame.rms,
      frame.bass,
      frame.mid,
      frame.treble,
      frame.centroid,
      frame.flux,
      frame.onset,
      frame.beatPhase,
      frame.confidence,
    ]) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  test("NaN in the spectrum does not escape into the frame", () => {
    const engine = new AudioAnalysisEngine();
    const poisoned = new Float32Array(BINS).fill(NaN);
    const frame = step(engine, tone(440, 0.4), poisoned, 20);
    for (const value of [frame.bass, frame.mid, frame.treble, frame.centroid])
      expect(Number.isFinite(value)).toBe(true);
  });

  test("a custom speed of sound changes the wavelength", () => {
    const engine = new AudioAnalysisEngine();
    engine.setSpeedOfSound(1500);
    const frame = step(engine, tone(1000, 0.5), spectrumWithPeak(1000), 60);
    expect(frame.wavelength).toBeCloseTo(1500 / frame.dominantHz, 5);
  });

  test("reset clears the running estimates", () => {
    const engine = new AudioAnalysisEngine();
    step(engine, tone(440, 0.5), spectrumWithPeak(440), 60);
    engine.reset();
    expect(engine.latest.dominantHz).toBeNaN();
    expect(engine.latest.time).toBe(0);
  });
});
