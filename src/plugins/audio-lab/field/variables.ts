/**
 * The live values a field expression may read, and where each one comes from.
 *
 * One list, used by four things that would otherwise drift: the managed Desmos
 * folder writes these names, the field compiler accepts them, the renderer
 * uploads their values as uniforms, and the panel lists them as help. A
 * variable added here appears in all four.
 *
 * Every name is a Latin letter with a subscript, and that is a constraint
 * rather than a style. Desmos's identifier grammar — the one `latexToGLSL`
 * shares with the expression scanner — is a letter plus an optional subscript,
 * so `\lambda_{audio}` is read as the command `\lambda` followed by nothing and
 * never becomes a name the compiler can resolve. The graph still defines
 * `\lambda_{audio}` and `\phi_{audio}`; they are simply not available *here*,
 * and the panel says so rather than letting someone type one and get an error
 * that blames the wrong thing.
 */
import type { AudioFeatureFrame } from "../audio/features";

export interface AudioVariable {
  /** As written in Desmos, and as typed into a field component. */
  readonly latex: string;
  /** What `latexToGLSL` and `setParameters` call it. */
  readonly name: string;
  /** Shown in the panel's variable list. */
  readonly description: string;
  /** The range a field expression can assume, for the panel to state. */
  readonly range: string;
  /** Pulls this frame's value out of a measurement. */
  readonly read: (frame: AudioFeatureFrame) => number;
}

/**
 * A frequency that is not there reads as zero rather than as NaN.
 *
 * A NaN uniform is worse than a wrong one: it propagates into every particle
 * position in a single frame and the field never recovers, because NaN survives
 * every arithmetic operation applied to it. Zero is visibly wrong and
 * recoverable, which is the right failure for a value that is genuinely absent
 * during a drum break.
 */
const orZero = (value: number) => (Number.isFinite(value) ? value : 0);

export const AUDIO_VARIABLES: readonly AudioVariable[] = [
  {
    latex: "A_{audio}",
    name: "A_audio",
    description: "Loudness",
    range: "0 to 1",
    read: (frame) => orZero(frame.rms),
  },
  {
    latex: "B_{audio}",
    name: "B_audio",
    description: "Bass energy",
    range: "0 to 1",
    read: (frame) => orZero(frame.bass),
  },
  {
    latex: "M_{audio}",
    name: "M_audio",
    description: "Mid energy",
    range: "0 to 1",
    read: (frame) => orZero(frame.mid),
  },
  {
    latex: "T_{audio}",
    name: "T_audio",
    description: "Treble energy",
    range: "0 to 1",
    read: (frame) => orZero(frame.treble),
  },
  {
    latex: "S_{audio}",
    name: "S_audio",
    description: "Brightness",
    range: "0 to 1",
    read: (frame) => orZero(frame.centroid),
  },
  {
    latex: "O_{audio}",
    name: "O_audio",
    description: "Onset impulse",
    range: "0 to 1, spikes on a hit",
    read: (frame) => orZero(frame.onset),
  },
  {
    latex: "R_{audio}",
    name: "R_audio",
    description: "Beat phase",
    range: "0 to 1 across one beat",
    read: (frame) => orZero(frame.beatPhase),
  },
  {
    latex: "N_{audio}",
    name: "N_audio",
    description: "Tempo",
    range: "beats per minute",
    read: (frame) => orZero(frame.bpm),
  },
  {
    latex: "f_{audio}",
    name: "f_audio",
    description: "Dominant frequency",
    range: "hertz",
    read: (frame) => orZero(frame.dominantHz),
  },
  {
    latex: "t_{audio}",
    name: "t_audio",
    description: "Seconds of analysis",
    range: "seconds",
    read: (frame) => orZero(frame.time),
  },
];

/** Canonical names, for building the compiler's environment. */
export const AUDIO_VARIABLE_NAMES: ReadonlySet<string> = new Set(
  AUDIO_VARIABLES.map((variable) => variable.name)
);

/**
 * Fills a map with this frame's values, in place.
 *
 * In place because this runs on every animation frame and a fresh `Map` per
 * frame is the kind of allocation that only shows up later, as a sawtooth in a
 * memory profile and a collection pause in the middle of a song.
 */
export function readAudioVariables(
  into: Map<string, number>,
  frame: AudioFeatureFrame
) {
  for (const variable of AUDIO_VARIABLES)
    into.set(variable.name, variable.read(frame));
  return into;
}
