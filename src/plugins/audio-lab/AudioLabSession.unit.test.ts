/**
 * Closing the panel must not switch anything off.
 *
 * This is the behaviour the whole session/view split exists for, and it is the
 * kind that rots quietly: someone adds a teardown line to the view's `destroy`
 * and the field goes away on close again, with every other test still green.
 */
import AudioLabSession, {
  type SessionView,
  type SpotifyPlayback,
} from "./AudioLabSession";
import { IDS } from "./desmos/manifest";
import { cloneAudioFieldConfig } from "./field/model";
import type AudioLab from ".";
import type { ItemState } from "graph-state/state";

function fakePlugin() {
  const state = { expressions: { list: [] as ItemState[] } };
  const settings = {
    spotifyUrl: "",
    waveMode: "representative",
    fieldConfig: "",
    response: "balanced",
    speedOfSound: "343",
  };
  const calc = {
    getState: () => JSON.parse(JSON.stringify(state)) as typeof state,
    setState: (next: typeof state) => {
      state.expressions.list = next.expressions.list;
    },
    setExpressions: () => {},
    observe: () => {},
    unobserve: () => {},
    graphpaperBounds: {
      mathCoordinates: { left: -10, right: 10, top: 6, bottom: -6 },
    },
  };
  const plugin = {
    calc,
    cc: { graphSettings: { config: { invertedColors: false } } },
    settings,
    setSetting: (key: string, value: string) => {
      (settings as Record<string, string>)[key] = value;
    },
  };
  return { plugin: plugin as unknown as AudioLab, state, settings };
}

function recordingView() {
  const calls = { state: 0, status: [] as string[] };
  const view: SessionView = {
    onFrame: () => {},
    onStateChange: () => calls.state++,
    onStatus: (message: string) => calls.status.push(message),
    onAccount: () => {},
    onPlayback: (_: SpotifyPlayback) => {},
  };
  return { view, calls };
}

/**
 * `attach` kicks off a Spotify status request, which needs a request id. jsdom
 * has no `crypto.randomUUID`, and the resulting throw would surface as an
 * unhandled rejection rather than a failure anyone could read.
 */
beforeAll(() => {
  if (typeof crypto === "undefined" || crypto.randomUUID === undefined) {
    Object.defineProperty(globalThis, "crypto", {
      value: { randomUUID: () => `id-${Math.random()}` },
      configurable: true,
    });
  }
});

describe("the session outliving the panel", () => {
  test("the graph keeps updating after the panel closes", () => {
    const { plugin, state } = fakePlugin();
    const session = new AudioLabSession(plugin);
    const { view } = recordingView();

    session.attach(view);
    session.toggleGraph();
    expect(session.isGraphLive).toBe(true);
    expect(state.expressions.list.some((i) => i.id === IDS.folder)).toBe(true);

    // Closing the panel. This is the assertion the split exists for.
    session.detach();
    expect(session.isGraphLive).toBe(true);
    expect(state.expressions.list.some((i) => i.id === IDS.folder)).toBe(true);

    session.destroy();
  });

  test("stopping is the only thing that stops it", () => {
    const { plugin } = fakePlugin();
    const session = new AudioLabSession(plugin);
    const { view } = recordingView();

    session.attach(view);
    session.toggleGraph();
    session.toggleGraph();
    expect(session.isGraphLive).toBe(false);
    session.destroy();
  });

  test("disabling the plugin does stop everything", () => {
    const { plugin } = fakePlugin();
    const session = new AudioLabSession(plugin);
    const { view } = recordingView();

    session.attach(view);
    session.toggleGraph();
    session.destroy();
    expect(session.isGraphLive).toBe(false);
    expect(session.isFieldRunning).toBe(false);
    expect(session.isCapturing).toBe(false);
  });

  test("a panel reopening is told the current state, not the defaults", () => {
    const { plugin } = fakePlugin();
    const session = new AudioLabSession(plugin);

    const first = recordingView();
    session.attach(first.view);
    session.toggleGraph();
    session.setWaveMode("additive");
    session.detach();

    // A fresh panel, as a reopen would build.
    const second = recordingView();
    session.attach(second.view);
    expect(second.calls.state).toBeGreaterThan(0);
    expect(session.isGraphLive).toBe(true);
    expect(session.waveMode).toBe("additive");
    session.destroy();
  });

  test("the last status survives a close, so reopening is not silent", () => {
    const { plugin } = fakePlugin();
    const session = new AudioLabSession(plugin);

    const first = recordingView();
    session.attach(first.view);
    session.toggleGraph();
    const said = session.status$.message;
    expect(said).not.toBe("");
    session.detach();

    const second = recordingView();
    session.attach(second.view);
    // An empty status line reads as "nothing is happening" when in fact the
    // graph is live and the field may be drawing.
    expect(second.calls.status).toContain(said);
    session.destroy();
  });
});

describe("remembered settings", () => {
  test("the wave mode, field, response and speed go through plugin settings", () => {
    const { plugin, settings } = fakePlugin();
    const session = new AudioLabSession(plugin);

    session.setWaveMode("recent");
    session.loadFieldPreset("vortex");
    session.setResponse("smooth");
    expect(session.setSpeedOfSound(1500)).toBe(true);

    // Written through the plugin, which is what survives a page reload.
    expect(settings.waveMode).toBe("recent");
    expect(JSON.parse(settings.fieldConfig).presetId).toBe("vortex");
    expect(settings.response).toBe("smooth");
    expect(settings.speedOfSound).toBe("1500");
    expect(session.speedOfSound).toBe(1500);
    session.destroy();
  });

  test("a stored field configuration comes back as the user's", () => {
    const { plugin, settings } = fakePlugin();
    const first = new AudioLabSession(plugin);
    first.loadFieldPreset("storm");
    const edited = cloneAudioFieldConfig(first.fieldConfig);
    edited.p = "2y";
    first.setFieldConfig(edited);
    first.destroy();

    // A fresh session over the same settings, which is what a reload is.
    const second = new AudioLabSession(plugin);
    expect(second.fieldConfig.p).toBe("2y");
    // Editing a component makes the field the user's rather than the preset's.
    expect(second.fieldConfig.presetId).toBe("custom");
    expect(settings.fieldConfig).not.toBe("");
    second.destroy();
  });

  test("a field configuration that will not parse falls back to a default", () => {
    const { plugin, settings } = fakePlugin();
    settings.fieldConfig = "{not json";
    const session = new AudioLabSession(plugin);
    expect(session.fieldConfig.presetId).toBe("stream");
    session.destroy();
  });

  test("an expression that cannot compile is kept and reported", () => {
    const { plugin } = fakePlugin();
    const session = new AudioLabSession(plugin);
    const broken = cloneAudioFieldConfig(session.fieldConfig);
    broken.p = "Z_{nonsense}";
    const error = session.setFieldConfig(broken);
    expect(error).toContain("P could not be read");
    // Kept, because it is what the user is in the middle of writing.
    expect(session.fieldConfig.p).toBe("Z_{nonsense}");
    session.destroy();
  });

  test("the old quality setting migrates onto the response it meant", () => {
    const { plugin, settings } = fakePlugin();
    settings.response = "performance";
    const session = new AudioLabSession(plugin);
    expect(session.response).toBe("snappy");
    session.destroy();
  });

  test("a nonsense speed of sound is refused and the old one kept", () => {
    const { plugin } = fakePlugin();
    const session = new AudioLabSession(plugin);
    expect(session.setSpeedOfSound(0)).toBe(false);
    expect(session.setSpeedOfSound(NaN)).toBe(false);
    expect(session.setSpeedOfSound(-5)).toBe(false);
    expect(session.speedOfSound).toBe(343);
    session.destroy();
  });

  test("a corrupted stored speed falls back rather than poisoning the maths", () => {
    const { plugin, settings } = fakePlugin();
    settings.speedOfSound = "not a number";
    const session = new AudioLabSession(plugin);
    expect(session.speedOfSound).toBe(343);
    session.destroy();
  });
});
