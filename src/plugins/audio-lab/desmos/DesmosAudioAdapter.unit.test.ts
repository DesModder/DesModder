/**
 * Gates 2-4: stable IDs update at the budgeted rate without serialising the
 * graph, unknown items survive every path, and the three meanings of
 * `W_audio(x)` are what they claim to be.
 */
import { DesmosAudioAdapter } from "./DesmosAudioAdapter";
import { IDS, OWNED_IDS, WAVEFORM_POINTS } from "./manifest";
import { num, traceXs, waveFunctionLatex } from "./latex";
import { SILENT_FRAME, type AudioFeatureFrame } from "../audio/features";
import type { Calc } from "#globals";
import type { ItemState } from "graph-state/state";

/**
 * A calculator that records what was asked of it.
 *
 * The counts matter as much as the contents: a `setState` during playback is
 * the failure this whole design exists to avoid, so the test asserts it never
 * happens rather than trusting the code to be careful.
 */
function fakeCalc(initial: ItemState[] = []) {
  const state = { expressions: { list: [...initial] } };
  const setStateCalls: ItemState[][] = [];
  const setExpressionsCalls: Array<Array<{ id: string; latex?: string }>> = [];
  const calc = {
    getState: () => JSON.parse(JSON.stringify(state)) as typeof state,
    setState: (next: typeof state) => {
      state.expressions.list = next.expressions.list;
      setStateCalls.push(next.expressions.list);
    },
    setExpressions: (expressions: Array<{ id: string; latex?: string }>) => {
      setExpressionsCalls.push(expressions);
      for (const expression of expressions) {
        const item = state.expressions.list.find((i) => i.id === expression.id);
        if (item !== undefined && expression.latex !== undefined)
          (item as { latex?: string }).latex = expression.latex;
      }
    },
  };
  return {
    calc: calc as unknown as Calc,
    state,
    setStateCalls,
    setExpressionsCalls,
  };
}

/** ExpressionState requires a color; these fixtures do not care what it is. */
function expr(id: string, latex: string): ItemState {
  return { type: "expression", id, latex, color: "#000000" };
}

const OPTIONS = { mode: "representative", speedOfSound: 343 } as const;

function frameAt(time: number, overrides: Partial<AudioFeatureFrame> = {}) {
  return {
    ...SILENT_FRAME,
    time,
    rms: 0.4,
    dominantHz: 440,
    silent: false,
    ...overrides,
  } satisfies AudioFeatureFrame;
}

const waveform = Array.from({ length: WAVEFORM_POINTS }, (_, i) =>
  Math.sin(i / 5)
);
const spectrum = [
  { hz: 440, amplitude: 1 },
  { hz: 880, amplitude: 0.4 },
];

describe("installation and ownership", () => {
  test("creates a folder and every owned expression in one undoable step", () => {
    const { calc, state, setStateCalls } = fakeCalc();
    new DesmosAudioAdapter(calc).install(OPTIONS);

    expect(setStateCalls).toHaveLength(1);
    const ids = state.expressions.list.map((item) => item.id);
    for (const id of OWNED_IDS) expect(ids).toContain(id);
    const folder = state.expressions.list.find(
      (item) => item.id === IDS.folder
    );
    expect(folder?.type).toBe("folder");
    // Everything else lives inside it, so one collapse hides the whole set.
    for (const item of state.expressions.list)
      if (item.id !== IDS.folder)
        expect((item as { folderId?: string }).folderId).toBe(IDS.folder);
  });

  test("unknown items survive install, update, and remove", () => {
    const mine: ItemState[] = [
      expr("1", "y=x^2"),
      { type: "folder", id: "myfolder", title: "Audio Lab" },
      // Shares the prefix and is not ours. Deleting by prefix would take it.
      expr("audio_lab_notes", "A_{audio}=7"),
      { type: "text", id: "3", text: "keep me" },
    ];
    const { calc, state } = fakeCalc(mine);
    const adapter = new DesmosAudioAdapter(calc);

    adapter.install(OPTIONS);
    adapter.update(frameAt(1), waveform, spectrum, [], 1000);
    adapter.remove();

    expect(state.expressions.list.map((item) => item.id)).toEqual([
      "1",
      "myfolder",
      "audio_lab_notes",
      "3",
    ]);
    expect(
      state.expressions.list.find((item) => item.id === "audio_lab_notes")
    ).toMatchObject({ latex: "A_{audio}=7" });
  });

  test("reinstalling keeps the set where the user left it in the list", () => {
    const { calc, state } = fakeCalc([
      expr("top", "y=1"),
      expr("bottom", "y=2"),
    ]);
    const adapter = new DesmosAudioAdapter(calc);
    adapter.install(OPTIONS);

    // Move the whole set above "bottom", the way a user dragging it would.
    const generated = state.expressions.list.filter(
      (item) => item.id !== "top" && item.id !== "bottom"
    );
    state.expressions.list = [
      expr("top", "y=1"),
      ...generated,
      expr("bottom", "y=2"),
    ];

    adapter.install(OPTIONS);
    const ids = state.expressions.list.map((item) => item.id);
    expect(ids[0]).toBe("top");
    expect(ids[ids.length - 1]).toBe("bottom");
  });

  test("remove on a graph that has none of it does not write at all", () => {
    const { calc, setStateCalls } = fakeCalc([expr("1", "y=x")]);
    new DesmosAudioAdapter(calc).remove();
    expect(setStateCalls).toHaveLength(0);
  });
});

describe("update budgets", () => {
  test("never serialises the graph during playback", () => {
    const { calc, setStateCalls } = fakeCalc();
    const adapter = new DesmosAudioAdapter(calc);
    adapter.install(OPTIONS);
    const afterInstall = setStateCalls.length;

    for (let i = 0; i < 600; i++)
      adapter.update(frameAt(i / 60), waveform, spectrum, [], i * (1000 / 60));

    expect(setStateCalls).toHaveLength(afterInstall);
  });

  test("ten seconds of frames sends far fewer than ten seconds of updates", () => {
    const { calc, setExpressionsCalls } = fakeCalc();
    const adapter = new DesmosAudioAdapter(calc);
    adapter.install(OPTIONS);

    // 600 animation frames, ten seconds. Scalars are budgeted at 12 Hz and
    // lists at 8 Hz, so at most 200 batches should leave.
    for (let i = 0; i < 600; i++)
      adapter.update(
        frameAt(i / 60, { rms: 0.3 + 0.2 * Math.sin(i / 7) }),
        waveform.map((v, k) => v * (1 + i / 1000) + k * 0),
        spectrum,
        [],
        i * (1000 / 60)
      );

    expect(setExpressionsCalls.length).toBeGreaterThan(0);
    expect(setExpressionsCalls.length).toBeLessThanOrEqual(200);
  });

  test("a value that has not changed is not sent again", () => {
    const { calc, setExpressionsCalls } = fakeCalc();
    const adapter = new DesmosAudioAdapter(calc);
    adapter.install(OPTIONS);

    // A held frame: same time, same everything. Only the very first update has
    // anything new to say.
    const held = frameAt(1);
    for (let i = 0; i < 120; i++)
      adapter.update(held, waveform, spectrum, [], 1000 + i * (1000 / 60));

    const sent = setExpressionsCalls.flat().map((e) => e.id);
    // Time, amplitude, bands, frequency and the traces go once; nothing repeats.
    expect(new Set(sent).size).toBe(sent.length);
  });

  test("does nothing at all before it is installed", () => {
    const { calc, setExpressionsCalls, setStateCalls } = fakeCalc();
    const adapter = new DesmosAudioAdapter(calc);
    adapter.update(frameAt(1), waveform, spectrum, [], 1000);
    adapter.setFunctionMode("recent");
    adapter.setSpeedOfSound(1500);
    expect(setExpressionsCalls).toHaveLength(0);
    expect(setStateCalls).toHaveLength(0);
  });

  test("keeps the last good frequency through a rest", () => {
    const { calc, state } = fakeCalc();
    const adapter = new DesmosAudioAdapter(calc);
    adapter.install(OPTIONS);
    adapter.update(
      frameAt(1, { dominantHz: 523.25 }),
      waveform,
      spectrum,
      [],
      1000
    );
    const sounding = state.expressions.list.find(
      (item) => item.id === IDS.frequency
    );
    expect(sounding).toMatchObject({ latex: "f_{audio}=523.25" });

    // A silent frame reports no frequency. Writing a zero would make the
    // wavelength infinite and blank the wave mid-song.
    adapter.update(
      frameAt(2, { dominantHz: NaN, silent: true }),
      waveform,
      spectrum,
      [],
      2000
    );
    expect(
      state.expressions.list.find((item) => item.id === IDS.frequency)
    ).toMatchObject({ latex: "f_{audio}=523.25" });
  });
});

describe("phase", () => {
  test("advances on elapsed time, not on how often it was called", () => {
    // Comparing the two runs' final phase directly would prove nothing: the
    // throttle lands the last write on a slightly different frame at each rate,
    // and a wrapped phase a few milliseconds apart is a different number. What
    // has to hold is that the phase written agrees with the audio clock written
    // beside it — at any frame rate, for whichever frame the throttle picked.
    const hz = 2;
    const read = (calls: number) => {
      const { calc, state } = fakeCalc();
      const adapter = new DesmosAudioAdapter(calc);
      adapter.install(OPTIONS);
      for (let i = 1; i <= calls; i++)
        adapter.update(
          frameAt(i / calls, { dominantHz: hz }),
          waveform,
          spectrum,
          [],
          i * (1000 / calls)
        );
      const value = (id: string) =>
        Number(
          (
            state.expressions.list.find((item) => item.id === id) as {
              latex: string;
            }
          ).latex.split("=")[1]
        );
      return { time: value(IDS.time), phase: value(IDS.phase) };
    };

    for (const calls of [30, 60, 144]) {
      const { time, phase } = read(calls);
      expect(time).toBeGreaterThan(0.9);
      // Compared as an angle. The running total wraps whenever it passes a
      // turn, so it can sit at -2pi where the closed form gives 0 — the same
      // place on the circle, and a plain subtraction would call it a failure.
      const turns = 2 * Math.PI;
      const error = phase - -turns * hz * time;
      expect(Math.abs(error - turns * Math.round(error / turns))).toBeLessThan(
        1e-3
      );
    }
  });

  test("holds still while the source is silent", () => {
    const { calc, state } = fakeCalc();
    const adapter = new DesmosAudioAdapter(calc);
    adapter.install(OPTIONS);
    adapter.update(frameAt(1), waveform, spectrum, [], 1000);
    const moving = state.expressions.list.find((item) => item.id === IDS.phase);

    for (let time = 2; time < 10; time++)
      adapter.update(
        frameAt(time, { dominantHz: NaN, silent: true }),
        waveform,
        spectrum,
        [],
        time * 1000
      );
    expect(
      state.expressions.list.find((item) => item.id === IDS.phase)
    ).toEqual(moving);
  });
});

describe("the wave function", () => {
  test("switching mode rewrites one expression and nothing else", () => {
    const { calc, setExpressionsCalls, setStateCalls } = fakeCalc();
    const adapter = new DesmosAudioAdapter(calc);
    adapter.install(OPTIONS);
    const before = setStateCalls.length;

    adapter.setFunctionMode("recent");
    expect(setStateCalls).toHaveLength(before);
    expect(setExpressionsCalls.at(-1)).toEqual([
      { type: "expression", id: IDS.wave, latex: waveFunctionLatex("recent") },
    ]);
  });

  test("each mode is a different definition", () => {
    const modes = ["representative", "recent", "additive"] as const;
    const written = modes.map((mode) => waveFunctionLatex(mode));
    expect(new Set(written).size).toBe(modes.length);
    // Every one of them defines the same user-facing name.
    for (const latex of written)
      expect(latex.startsWith("W_{audio}\\left(x\\right)=")).toBe(true);
  });

  test("the recent mode reads the sample list it is given", () => {
    const latex = waveFunctionLatex("recent");
    expect(latex).toContain("Y_{wave}");
    expect(latex).toContain("i_{audio}");
    expect(latex).toContain("u_{audio}");
  });

  test("additive components are capped at eight", () => {
    const { calc, state } = fakeCalc();
    const adapter = new DesmosAudioAdapter(calc);
    adapter.install({ mode: "additive", speedOfSound: 343 });
    const twenty = Array.from({ length: 20 }, (_, i) => ({
      hz: 100 * (i + 1),
      amplitude: 1 / (i + 1),
    }));
    adapter.update(frameAt(1), waveform, spectrum, twenty, 1000);

    const amplitudes = state.expressions.list.find(
      (item) => item.id === IDS.componentA
    ) as { latex: string };
    expect(amplitudes.latex.split(",")).toHaveLength(8);
  });

  test("components are not written in the other modes", () => {
    const { calc, setExpressionsCalls } = fakeCalc();
    const adapter = new DesmosAudioAdapter(calc);
    adapter.install(OPTIONS);
    adapter.update(
      frameAt(1),
      waveform,
      spectrum,
      [{ hz: 440, amplitude: 1 }],
      1000
    );
    const sent = setExpressionsCalls.flat().map((e) => e.id);
    expect(sent).not.toContain(IDS.componentA);
  });
});

describe("latex", () => {
  test("numbers are rounded rather than sent at full precision", () => {
    expect(num(1 / 3)).toBe("0.3333");
    expect(num(2)).toBe("2");
    expect(num(-0.00001)).toBe("0");
    expect(num(NaN)).toBe("0");
    expect(num(Infinity)).toBe("0");
  });

  test("the trace x coordinates span the window and stay in order", () => {
    const xs = traceXs(5);
    expect(xs[0]).toBe(-10);
    expect(xs[4]).toBe(10);
    expect(traceXs(0)).toEqual([]);
    expect(traceXs(1)).toEqual([-10]);
  });

  test("wavelength is a relationship in the graph, not a computed number", () => {
    const { calc, state } = fakeCalc();
    new DesmosAudioAdapter(calc).install(OPTIONS);
    expect(
      state.expressions.list.find((item) => item.id === IDS.wavelength)
    ).toMatchObject({
      latex: "\\lambda_{audio}=\\frac{c_{audio}}{f_{audio}}",
    });
  });
});
