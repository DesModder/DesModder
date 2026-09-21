/**
 * Every expression Audio Lab is allowed to touch, and nothing else.
 *
 * Removal and regeneration work from this list of exact IDs. An expression the
 * user wrote that happens to be called `A_{audio}`, or a folder they titled
 * "Audio Lab", is not in here and is therefore not Audio Lab's to delete.
 */

export const AUDIO_LAB_NAMESPACE = "audio_lab";

export const IDS = {
  folder: "audio_lab_folder",
  time: "audio_lab_time",
  amplitude: "audio_lab_amplitude",
  frequency: "audio_lab_frequency",
  phase: "audio_lab_phase",
  speed: "audio_lab_speed",
  wavelength: "audio_lab_wavelength",
  bass: "audio_lab_bass",
  mid: "audio_lab_mid",
  treble: "audio_lab_treble",
  brightness: "audio_lab_brightness",
  onset: "audio_lab_onset",
  beat: "audio_lab_beat",
  tempo: "audio_lab_tempo",
  waveX: "audio_lab_wave_x",
  waveY: "audio_lab_wave_y",
  /** Kept from the snapshot-only version so an existing graph is reused. */
  waveform: "audio_lab_waveform",
  spectrumF: "audio_lab_spectrum_f",
  spectrumS: "audio_lab_spectrum_s",
  spectrum: "audio_lab_spectrum",
  sampleIndex: "audio_lab_sample_index",
  sampleFloor: "audio_lab_sample_floor",
  componentA: "audio_lab_component_a",
  componentF: "audio_lab_component_f",
  componentP: "audio_lab_component_p",
  wave: "audio_lab_wave",
} as const;

export const OWNED_IDS: readonly string[] = Object.values(IDS);

/**
 * The three meanings `W_audio(x)` can carry.
 *
 * They are deliberately different things, and the panel labels them as such: a
 * representative sinusoid is not the recent waveform, and neither is a copy of
 * the source audio.
 */
export type WaveFunctionMode = "representative" | "recent" | "additive";

/** Version 1 caps additive reconstruction here, as the specification requires. */
export const MAX_COMPONENTS = 8;

/** Points in the live waveform trace. */
export const WAVEFORM_POINTS = 192;
/** Points in the live spectrum trace. */
export const SPECTRUM_POINTS = 96;

/** The x range the waveform and spectrum traces are drawn across. */
export const TRACE_X = { min: -10, max: 10 } as const;
