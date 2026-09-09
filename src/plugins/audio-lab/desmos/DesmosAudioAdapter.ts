/**
 * The only thing in Audio Lab that writes to the calculator.
 *
 * Two rules shape all of it.
 *
 * The first is rate separation. The analysis engine runs every animation frame
 * because the field needs it to; Desmos does not, and treating the expression
 * list as a video renderer is what makes a calculator with a plugin in it feel
 * slower than one without. Scalars go out about twelve times a second and lists
 * about eight, coalesced, with unchanged values dropped before they are sent.
 *
 * The second is ownership. Creating the set is a single `setState`, so it is
 * atomic, undoable, and lands in one folder. Every update after that is
 * `setExpressions` with an id and a latex string, because `setState` during
 * playback would serialise the user's entire graph a dozen times a second.
 * Removal works from an explicit list of exact IDs, never from a prefix.
 */
import {
  IDS,
  OWNED_IDS,
  SPECTRUM_POINTS,
  TRACE_X,
  WAVEFORM_POINTS,
  type WaveFunctionMode,
} from "./manifest";
import {
  SCALARS,
  componentLatex,
  listLatex,
  num,
  pairsLatex,
  sampleFloorLatex,
  sampleIndexLatex,
  scalarLatex,
  traceXs,
  waveFunctionLatex,
  wavelengthLatex,
} from "./latex";
import type { AudioFeatureFrame, SpectralComponent } from "../audio/features";
import type { Calc } from "#globals";
import type { ExpressionState, ItemState } from "graph-state/state";

/** Twelve a second, inside the specification's 10-15 Hz budget for scalars. */
const SCALAR_INTERVAL_MS = 1000 / 12;
/** Eight a second, inside the 5-12 Hz budget for sample lists. */
const LIST_INTERVAL_MS = 1000 / 8;

const DESMOS_BLUE = "#2d70b3";
const DESMOS_GREEN = "#388c46";
const DESMOS_PURPLE = "#6042a6";

export interface AudioGraphOptions {
  readonly mode: WaveFunctionMode;
  /** Metres per second, user-editable for demonstrations in other media. */
  readonly speedOfSound: number;
}

export class DesmosAudioAdapter {
  private installed = false;
  private lastScalarWrite = 0;
  private lastListWrite = 0;
  private phase = 0;
  private lastFrameTime = 0;
  private mode: WaveFunctionMode = "representative";
  /**
   * The latex last written for each owned id.
   *
   * An update whose rendered value has not changed is dropped before it reaches
   * the calculator. A held note or a paused track then costs nothing at all,
   * which is most of what a plugin left open does.
   */
  private readonly written = new Map<string, string>();
  private readonly xs = traceXs(WAVEFORM_POINTS);

  constructor(private readonly calc: Calc) {}

  get isInstalled() {
    return this.installed;
  }

  get functionMode() {
    return this.mode;
  }

  /**
   * Creates the managed folder and every expression in it, in one undoable step.
   *
   * Refuses rather than overwrites when one of the IDs is already in the graph
   * as something Audio Lab did not put there. Silently replacing it is how a
   * plugin eats work the user did.
   */
  install(options: AudioGraphOptions) {
    const state = this.calc.getState();
    const owned = new Set<string>(OWNED_IDS);
    const others: ItemState[] = [];
    let insertionIndex: number | undefined;
    for (const item of state.expressions.list) {
      // Regenerating puts the set back where it already was, rather than
      // sending it to the bottom of a list the user has arranged.
      if (owned.has(item.id)) insertionIndex ??= others.length;
      else others.push(item);
    }

    this.mode = options.mode;
    this.written.clear();
    this.phase = 0;
    this.lastFrameTime = 0;

    const definitions = this.definitions(options);
    for (const { id, latex } of definitions) this.written.set(id, latex);
    const generated: ItemState[] = [
      { type: "folder", id: IDS.folder, title: "Audio Lab", collapsed: false },
      ...definitions.map(
        ({ id, latex, hidden, color, lines, points }): ExpressionState => ({
          type: "expression",
          id,
          folderId: IDS.folder,
          latex,
          color: color ?? DESMOS_BLUE,
          hidden: hidden ?? false,
          ...(lines === undefined ? {} : { lines }),
          ...(points === undefined ? {} : { points }),
        })
      ),
    ];

    state.expressions.list =
      insertionIndex === undefined
        ? [...others, ...generated]
        : [
            ...others.slice(0, insertionIndex),
            ...generated,
            ...others.slice(insertionIndex),
          ];
    this.calc.setState(state, { allowUndo: true });
    this.installed = true;
  }

  /**
   * Removes exactly what Audio Lab created.
   *
   * By id, never by prefix: an expression the user happened to name
   * `audio_lab_notes` shares the prefix and is not ours.
   */
  remove() {
    const removable = new Set<string>(OWNED_IDS);
    const state = this.calc.getState();
    const remaining = state.expressions.list.filter(
      (item) => !removable.has(item.id)
    );
    this.installed = false;
    this.written.clear();
    if (remaining.length === state.expressions.list.length) return;
    state.expressions.list = remaining;
    this.calc.setState(state, { allowUndo: true });
  }

  /**
   * Switches what `W_audio(x)` means.
   *
   * Rewrites that one expression and nothing else, so a mode change does not
   * disturb the variables or the traces, and does not cost a `setState`.
   */
  setFunctionMode(mode: WaveFunctionMode) {
    this.mode = mode;
    if (!this.installed) return;
    this.write([{ id: IDS.wave, latex: waveFunctionLatex(mode) }]);
  }

  setSpeedOfSound(metresPerSecond: number) {
    if (!this.installed || !Number.isFinite(metresPerSecond)) return;
    this.write([
      { id: IDS.speed, latex: scalarLatex(IDS.speed, metresPerSecond) },
    ]);
  }

  /**
   * Publishes the latest frame, subject to both budgets.
   *
   * Called every animation frame; sends on far fewer of them. `nowMs` is passed
   * in rather than read here so a test can drive the clock.
   */
  update(
    frame: AudioFeatureFrame,
    waveform: readonly number[],
    spectrum: readonly SpectralComponent[],
    components: readonly SpectralComponent[],
    nowMs: number
  ) {
    if (!this.installed) return;
    this.advancePhase(frame);

    const updates: Array<{ id: string; latex: string }> = [];
    if (nowMs - this.lastScalarWrite >= SCALAR_INTERVAL_MS) {
      this.lastScalarWrite = nowMs;
      updates.push(
        { id: IDS.time, latex: scalarLatex(IDS.time, frame.time) },
        { id: IDS.amplitude, latex: scalarLatex(IDS.amplitude, frame.rms) },
        { id: IDS.phase, latex: scalarLatex(IDS.phase, this.phase) },
        { id: IDS.bass, latex: scalarLatex(IDS.bass, frame.bass) },
        { id: IDS.mid, latex: scalarLatex(IDS.mid, frame.mid) },
        { id: IDS.treble, latex: scalarLatex(IDS.treble, frame.treble) }
      );
      // Frequency is written only when there is one. Sending a zero during a
      // rest would make the wavelength infinite and blank the wave; leaving the
      // last good value there keeps the picture steady through a gap.
      if (Number.isFinite(frame.dominantHz))
        updates.push({
          id: IDS.frequency,
          latex: scalarLatex(IDS.frequency, frame.dominantHz),
        });
    }

    if (nowMs - this.lastListWrite >= LIST_INTERVAL_MS) {
      this.lastListWrite = nowMs;
      const ys = waveform.slice(0, WAVEFORM_POINTS);
      const xs = this.xs.slice(0, ys.length);
      updates.push(
        { id: IDS.waveX, latex: `X_{wave}=${listLatex(xs)}` },
        { id: IDS.waveY, latex: `Y_{wave}=${listLatex(ys)}` },
        { id: IDS.waveform, latex: pairsLatex(xs, ys) }
      );

      const bins = spectrum.slice(0, SPECTRUM_POINTS);
      const hz = bins.map((bin) => bin.hz);
      const level = bins.map((bin) => bin.amplitude);
      updates.push(
        { id: IDS.spectrumF, latex: `F_{bin}=${listLatex(hz, 1)}` },
        { id: IDS.spectrumS, latex: `S_{bin}=${listLatex(level)}` },
        { id: IDS.spectrum, latex: pairsLatex(hz, level) }
      );

      if (this.mode === "additive") {
        const withPhase = components.map((component) => ({
          amplitude: component.amplitude * frame.rms,
          hz: component.hz,
          // Each component is drawn as a travelling wave at its own frequency.
          // The analyser reports magnitudes only, so this phase is a chosen
          // animation rather than a measured one - which is exactly why this
          // mode is labelled an approximation and not a reconstruction.
          phase: -2 * Math.PI * component.hz * frame.time,
        }));
        for (const [id, latex] of Object.entries(componentLatex(withPhase)))
          updates.push({ id, latex });
      }
    }

    this.write(updates);
  }

  /**
   * Advances the representative wave's phase on the analysis clock.
   *
   * Frame count would tie the animation speed to the monitor. An invalid or
   * silent frame advances nothing, so the wave stops where it was when the
   * music stopped instead of drifting through the rest.
   */
  private advancePhase(frame: AudioFeatureFrame) {
    const dt = frame.time - this.lastFrameTime;
    this.lastFrameTime = frame.time;
    if (!Number.isFinite(frame.dominantHz) || dt <= 0) return;
    this.phase -= 2 * Math.PI * frame.dominantHz * dt;
    // Wrapped so the number written stays small and readable forever.
    this.phase %= 2 * Math.PI;
  }

  /** Sends only what actually changed, in one batch. */
  private write(updates: ReadonlyArray<{ id: string; latex: string }>) {
    const changed = updates.filter(
      ({ id, latex }) => this.written.get(id) !== latex
    );
    if (changed.length === 0) return;
    for (const { id, latex } of changed) this.written.set(id, latex);
    this.calc.setExpressions(
      changed.map(({ id, latex }) => ({ type: "expression", id, latex }))
    );
  }

  /** The full set, in the order it appears in the folder. */
  private definitions(options: AudioGraphOptions) {
    return [
      { id: IDS.time, latex: scalarLatex(IDS.time, 0), hidden: true },
      { id: IDS.amplitude, latex: scalarLatex(IDS.amplitude, 0), hidden: true },
      {
        id: IDS.frequency,
        latex: scalarLatex(IDS.frequency, 440),
        hidden: true,
      },
      { id: IDS.phase, latex: scalarLatex(IDS.phase, 0), hidden: true },
      {
        id: IDS.speed,
        latex: scalarLatex(IDS.speed, options.speedOfSound),
        hidden: true,
      },
      { id: IDS.wavelength, latex: wavelengthLatex(), hidden: true },
      { id: IDS.bass, latex: scalarLatex(IDS.bass, 0), hidden: true },
      { id: IDS.mid, latex: scalarLatex(IDS.mid, 0), hidden: true },
      { id: IDS.treble, latex: scalarLatex(IDS.treble, 0), hidden: true },
      {
        id: IDS.waveX,
        latex: `X_{wave}=${listLatex(this.xs)}`,
        hidden: true,
      },
      {
        id: IDS.waveY,
        latex: `Y_{wave}=${listLatex(this.xs.map(() => 0))}`,
        hidden: true,
      },
      {
        id: IDS.spectrumF,
        latex: `F_{bin}=${listLatex([])}`,
        hidden: true,
      },
      {
        id: IDS.spectrumS,
        latex: `S_{bin}=${listLatex([])}`,
        hidden: true,
      },
      { id: IDS.sampleIndex, latex: sampleIndexLatex(), hidden: true },
      { id: IDS.sampleFloor, latex: sampleFloorLatex(), hidden: true },
      {
        id: IDS.componentA,
        latex: `A_{comp}=${listLatex([])}`,
        hidden: true,
      },
      {
        id: IDS.componentF,
        latex: `F_{comp}=${listLatex([])}`,
        hidden: true,
      },
      {
        id: IDS.componentP,
        latex: `P_{comp}=${listLatex([])}`,
        hidden: true,
      },
      {
        id: IDS.waveform,
        latex: pairsLatex(
          this.xs,
          this.xs.map(() => 0)
        ),
        color: DESMOS_BLUE,
        lines: true,
        points: false,
      },
      {
        id: IDS.spectrum,
        latex: pairsLatex([], []),
        color: DESMOS_GREEN,
        lines: true,
        points: false,
      },
      {
        id: IDS.wave,
        latex: waveFunctionLatex(options.mode),
        color: DESMOS_PURPLE,
      },
    ] satisfies Array<{
      id: string;
      latex: string;
      hidden?: boolean;
      color?: string;
      lines?: boolean;
      points?: boolean;
    }>;
  }
}

export { TRACE_X, SCALARS, num };
