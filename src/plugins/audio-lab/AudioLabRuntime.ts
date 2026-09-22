/**
 * Binds the panel's DOM to the session, and nothing else.
 *
 * This object lives exactly as long as the panel is open. It owns no audio, no
 * WebGL, and no expression — every control here asks the session to do
 * something, and every readout here is drawn from what the session reports.
 * Closing the panel destroys this and leaves all of that running.
 *
 * The consequence worth stating: there is no state in this file beyond what the
 * DOM already holds. On attach it reads the session and renders whatever it
 * finds, which is what makes reopening the panel mid-song show the truth rather
 * than a set of defaults.
 *
 * ## What `onFrame` may and may not do
 *
 * `onFrame` runs at the analysis rate, which is now up to every animation
 * frame, and it runs on the same main thread Desmos renders on. Three rules
 * come out of that, and all three were written after measuring the panel doing
 * the opposite:
 *
 *  - **Never query the DOM.** Every element is looked up once, in the
 *    constructor, and kept. The readouts alone were seven `querySelector` calls
 *    a frame.
 *  - **Never measure layout.** `getBoundingClientRect` forces the browser to
 *    settle layout before it answers, and the two canvases were asking twice a
 *    frame. Their size is measured by a `ResizeObserver` instead, which reports
 *    a box that has already been computed.
 *  - **Never write text that has not changed.** Assigning `textContent` dirties
 *    the node whether or not the string differs, and a readout that reads
 *    "0.412" for half a second should cost nothing for the other twenty-nine
 *    frames of it.
 */
import type AudioLab from ".";
import type AudioLabSession from "./AudioLabSession";
import {
  RESPONSE,
  type Response,
  type SessionView,
  type SpotifyPlayback,
} from "./AudioLabSession";
import type { AudioFeatureFrame } from "./audio/features";
import { SCALARS } from "./desmos/latex";
import { MAX_COMPONENTS, type WaveFunctionMode } from "./desmos/manifest";
import {
  AUDIO_FIELD_PRESETS,
  cloneAudioFieldConfig,
  type AudioFieldConfig,
  type PointerMode,
  type RippleOrigin,
  type RippleSource,
} from "./field/model";
import { galleryChoices, galleryPresetFromConfigId } from "./field/gallery";
import { AUDIO_VARIABLES } from "./field/variables";
import { PALETTE_GROUPS, PALETTES } from "../../field-rendering/palettes";
import type { PaletteID } from "../../field-rendering/palettes";
import type { FlowColorMode } from "../../field-rendering/types";

/**
 * Says what `W_audio(x)` currently means.
 *
 * The three modes are genuinely different objects and the panel has to say so.
 * A representative sinusoid at the dominant frequency is not the recent
 * waveform, and neither of them is the sound.
 */
const WAVE_MODE_HINTS: Record<WaveFunctionMode, string> = {
  representative:
    "A single sine at the dominant frequency. Useful for wavelength and pitch, and not the shape of the sound.",
  recent:
    "Interpolated through the most recent samples. This is the real waveform, redrawn a few times a second.",
  additive: `A sum of the strongest ${MAX_COMPONENTS} components. An approximation for Fourier work, not a copy of the track.`,
};

const WAVE_MODES: ReadonlyArray<[WaveFunctionMode, string]> = [
  ["representative", "Representative wave"],
  ["recent", "Recent waveform"],
  ["additive", "Additive spectrum"],
];

const RIPPLE_SOURCES: ReadonlyArray<[RippleSource, string]> = [
  ["onset", "On every hit"],
  ["beat", "On the beat"],
  ["off", "Never"],
];

const RIPPLE_ORIGINS: ReadonlyArray<[RippleOrigin, string]> = [
  ["scatter", "Anywhere"],
  ["centre", "The middle"],
  ["pointer", "The cursor"],
  ["spectrum", "By pitch and loudness"],
];

const POINTER_MODES: ReadonlyArray<[PointerMode, string]> = [
  ["push", "Push away"],
  ["pull", "Draw in"],
  ["swirl", "Stir"],
  ["off", "Nothing"],
];

const COLOR_MODES: ReadonlyArray<[FlowColorMode, string]> = [
  ["speed", "Speed"],
  ["direction", "Direction"],
  ["fixed", "One colour"],
];

type TabName = "source" | "field" | "graph";

/** One editable number, and where it lives in the configuration. */
interface NumberSpec {
  label: string;
  min: number;
  max: number;
  step: number;
  get: (config: AudioFieldConfig) => number;
  set: (config: AudioFieldConfig, value: number) => void;
}

export default class AudioLabRuntime implements SessionView {
  private readonly session: AudioLabSession;
  private readonly wave: HTMLCanvasElement;
  private readonly spectrum: HTMLCanvasElement;
  /** Every named element, resolved once. See the note at the top of the file. */
  private readonly elements = new Map<string, HTMLElement>();
  /**
   * Canvas sizes, kept rather than measured.
   *
   * A `ResizeObserver` reports a box the browser has already computed, so
   * reading it costs nothing; `getBoundingClientRect` in a frame callback makes
   * the browser stop and compute one.
   */
  private readonly canvasSize = new WeakMap<
    HTMLCanvasElement,
    { width: number; height: number }
  >();
  private resizeObserver?: ResizeObserver;
  /** Whether the popover is on screen at all. Off screen, nothing is drawn. */
  private visible = true;
  private visibilityObserver?: IntersectionObserver;
  /** The last string written to each readout, so an unchanged one is skipped. */
  private readonly lastText = new Map<HTMLElement, string>();
  private tab: TabName = "source";

  constructor(
    private readonly plugin: AudioLab,
    private readonly root: HTMLElement
  ) {
    this.session = plugin.session;
    this.hydrateCanvases();
    this.cacheElements();
    this.wave = this.find<HTMLCanvasElement>("wave");
    this.spectrum = this.find<HTMLCanvasElement>("spectrum");
    this.observeLayout();
    this.bind();
    this.session.attach(this);
  }

  destroy() {
    this.resizeObserver?.disconnect();
    this.visibilityObserver?.disconnect();
    // Detach, not stop. The capture, the field, and the graph updates were
    // turned on deliberately and are switched off the same way.
    this.session.detach();
  }

  // ------------------------------------------------------------------- setup

  private hydrateCanvases() {
    for (const name of ["wave", "spectrum"]) {
      const canvas = document.createElement("canvas");
      canvas.className = "dsm-audio-lab-canvas";
      canvas.dataset.audioLab = name;
      this.root
        .querySelector(`[data-audio-lab-placeholder="${name}"]`)
        ?.replaceWith(canvas);
    }
  }

  private cacheElements() {
    for (const element of this.root.querySelectorAll<HTMLElement>(
      "[data-audio-lab]"
    ))
      this.elements.set(element.dataset.audioLab!, element);
  }

  private observeLayout() {
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const canvas = entry.target as HTMLCanvasElement;
        const box = entry.contentRect;
        this.canvasSize.set(canvas, {
          width: box.width,
          height: box.height,
        });
        // Resizing a canvas clears it, so the next frame has to redraw — which
        // it will, because something is always asking for one while the panel
        // is open.
        this.sizeCanvas(canvas);
      }
    });
    this.resizeObserver.observe(this.wave);
    this.resizeObserver.observe(this.spectrum);

    // A popover scrolled out of view, or one the browser has otherwise stopped
    // painting, is still receiving frames. Drawing into it is the clearest kind
    // of waste: work whose result nobody can see.
    this.visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        this.visible = entry?.isIntersecting ?? true;
      },
      { threshold: 0 }
    );
    this.visibilityObserver.observe(this.root);
  }

  private find<T extends HTMLElement>(name: string) {
    const element = this.elements.get(name) as T | undefined;
    if (element === undefined)
      throw new Error(`Missing Audio Lab element: ${name}`);
    return element;
  }

  private on<T extends HTMLElement>(
    name: string,
    event: string,
    handler: (element: T) => void
  ) {
    const element = this.find<T>(name);
    element.addEventListener(event, () => handler(element));
    return element;
  }

  /** Writes only when the string differs. See the note at the top. */
  private text(name: string, value: string) {
    const element = this.find(name);
    if (this.lastText.get(element) === value) return;
    this.lastText.set(element, value);
    element.textContent = value;
  }

  // ------------------------------------------------------------- small parts

  /**
   * A row of one-click chips.
   *
   * Not a `<select>`, for the same reason the Vector Tools panel has none: a
   * native dropdown inside a scrolling popover is awkward to hit, and it hides
   * the options behind a click when there are only three or four of them.
   */
  private chips<T extends string>(
    host: string,
    options: ReadonlyArray<readonly [T, string]>,
    selected: () => T,
    choose: (value: T) => void
  ) {
    const container = this.find(host);
    const buttons = options.map(([value, label]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.dataset.value = value;
      button.addEventListener("click", () => choose(value));
      return button;
    });
    container.replaceChildren(...buttons);
    const sync = () => {
      const current = selected();
      for (const button of buttons) {
        const active = button.dataset.value === current;
        button.classList.toggle("dsm-audio-lab-chip-on", active);
        button.setAttribute("aria-pressed", String(active));
      }
    };
    sync();
    return sync;
  }

  /** A row of labelled number inputs, each bound to one place in the config. */
  private numbers(host: string, specs: readonly NumberSpec[]) {
    const container = this.find(host);
    const inputs = specs.map((spec) => {
      const label = document.createElement("label");
      label.className = "dsm-audio-lab-field";
      label.append(spec.label);
      const input = document.createElement("input");
      input.type = "number";
      input.min = String(spec.min);
      input.max = String(spec.max);
      input.step = String(spec.step);
      input.addEventListener("change", () => {
        const value = Number(input.value);
        if (!Number.isFinite(value)) {
          input.value = String(spec.get(this.session.fieldConfig));
          return;
        }
        this.editConfig((config) => spec.set(config, value));
      });
      label.append(input);
      container.append(label);
      return { spec, input };
    });
    return () => {
      const config = this.session.fieldConfig;
      for (const { spec, input } of inputs) {
        // Not while it has focus: a re-render mid-edit must not fight typing.
        if (document.activeElement === input) continue;
        const value = String(round(spec.get(config)));
        if (input.value !== value) input.value = value;
      }
    };
  }

  /**
   * Applies an edit to the stored configuration.
   *
   * Cloned before mutating, because the session hands out the object it has
   * cached and editing it in place would leave the cache and the stored string
   * disagreeing about what the field is.
   */
  private editConfig(mutate: (config: AudioFieldConfig) => void) {
    const config = cloneAudioFieldConfig(this.session.fieldConfig);
    mutate(config);
    const error = this.session.setFieldConfig(config);
    this.text("field-error", error ?? "");
    // Every edit can change more than the control that made it: editing a
    // component moves the preset to "Yours", and normalizing may have clamped a
    // number to something other than what was typed. Re-reading the whole
    // configuration is the only version of this that cannot go stale.
    this.syncField();
  }

  // -------------------------------------------------------------------- bind

  private bind() {
    this.bindTabs();
    this.bindSource();
    this.bindField();
    this.bindGraph();
  }

  private bindTabs() {
    const buttons = [
      ...this.root.querySelectorAll<HTMLButtonElement>("[data-audio-lab-tab]"),
    ];
    const panels = [
      ...this.root.querySelectorAll<HTMLElement>("[data-audio-lab-panel]"),
    ];
    const show = (name: TabName) => {
      this.tab = name;
      for (const button of buttons) {
        const active = button.dataset.audioLabTab === name;
        button.classList.toggle("dsm-audio-lab-chip-on", active);
        button.setAttribute("aria-selected", String(active));
      }
      for (const panel of panels)
        panel.hidden = panel.dataset.audioLabPanel !== name;
    };
    for (const button of buttons)
      button.addEventListener("click", () =>
        show(button.dataset.audioLabTab as TabName)
      );
    show(this.tab);
  }

  private bindSource() {
    const url = this.find<HTMLInputElement>("spotify-url");
    url.value = this.plugin.settings.spotifyUrl;

    this.on("sign-in", "click", () => {
      void this.session.signIn();
    });
    this.on("sign-out", "click", () => {
      void this.session.signOut();
    });
    this.on("open-spotify", "click", () => {
      void this.session.openSpotify();
    });
    this.on("spotify-load", "click", () => {
      void this.session.playLink(url.value);
    });
    this.on("spotify-toggle", "click", () => {
      void this.session.runPlaybackCommand(
        this.session.isSpotifyPlaying ? "pause" : "resume"
      );
    });
    this.on("previous", "click", () => {
      void this.session.runPlaybackCommand("previous");
    });
    this.on("next", "click", () => {
      void this.session.runPlaybackCommand("next");
    });

    this.on("analyze", "click", () => {
      if (this.session.isCapturing) this.session.stopTabAnalysis();
      else void this.session.analyzeTab();
    });
    this.on<HTMLInputElement>("file", "change", (file) => {
      this.session.loadFile(file.files?.[0]);
    });
    this.on("play", "click", () => this.session.togglePlay());
    const volume = this.on<HTMLInputElement>("volume", "input", (element) => {
      this.session.setVolume(Number(element.value));
    });
    volume.value = String(this.session.volume);

    // Built from the registry rather than written out in the markup, so adding
    // a response level cannot leave the picker one option short.
    this.syncResponse = this.chips(
      "response",
      Object.entries(RESPONSE).map(
        ([id, profile]) => [id as Response, profile.label] as const
      ),
      () => this.session.response,
      (value) => this.session.setResponse(value)
    );
  }

  private bindField() {
    // Two rows, because they are two different offers. The first are fields
    // written to be moved by sound; the second are the gallery's, whose maths
    // is a black hole's or a dipole's and which the sound reaches through a
    // loudness term written into the boxes. Only one chip across both rows is
    // ever lit, because `presetId` has one value.
    const loadPreset = (id: string) => {
      if (id === "custom") return;
      this.session.loadFieldPreset(id);
      this.syncField();
    };
    this.syncPreset = this.chips(
      "field-preset",
      [
        ...AUDIO_FIELD_PRESETS.map(
          (preset) => [preset.id, preset.name] as const
        ),
        ["custom", "Yours"] as const,
      ],
      () => this.session.fieldConfig.presetId,
      loadPreset
    );
    this.syncGallery = this.chips(
      "field-gallery",
      galleryChoices(),
      () => this.session.fieldConfig.presetId,
      loadPreset
    );

    for (const [name, key] of [
      ["field-p", "p"],
      ["field-q", "q"],
    ] as const) {
      const input = this.find<HTMLInputElement>(name);
      // `change` rather than `input`: recompiling and relinking two shader
      // programs on every keystroke is both slow and a stream of errors for
      // every half-typed expression on the way to a whole one.
      input.addEventListener("change", () => {
        this.editConfig((config) => {
          config[key] = input.value;
        });
      });
    }

    this.find("field-variables").replaceChildren(
      ...AUDIO_VARIABLES.map((variable) => {
        const row = document.createElement("div");
        const name = document.createElement("code");
        name.textContent = variable.latex.replace(/[{}\\]/g, "");
        const what = document.createElement("span");
        what.textContent = `${variable.description} — ${variable.range}`;
        row.append(name, what);
        return row;
      })
    );

    this.syncRippleSource = this.chips(
      "ripple-source",
      RIPPLE_SOURCES,
      () => this.session.fieldConfig.ripples.source,
      (source) => {
        this.editConfig((config) => {
          config.ripples.source = source;
        });
      }
    );
    this.syncRippleOrigin = this.chips(
      "ripple-origin",
      RIPPLE_ORIGINS,
      () => this.session.fieldConfig.ripples.origin,
      (origin) => {
        this.editConfig((config) => {
          config.ripples.origin = origin;
        });
      }
    );
    this.syncRippleNumbers = this.numbers("ripple-numbers", [
      {
        label: "Speed",
        min: 0,
        max: 40,
        step: 0.1,
        get: (c) => c.ripples.speed,
        set: (c, v) => (c.ripples.speed = v),
      },
      {
        label: "Wavelength",
        min: 0.05,
        max: 20,
        step: 0.1,
        get: (c) => c.ripples.wavelength,
        set: (c, v) => (c.ripples.wavelength = v),
      },
      {
        label: "Lifetime (s)",
        min: 0.1,
        max: 15,
        step: 0.1,
        get: (c) => c.ripples.lifetime,
        set: (c, v) => (c.ripples.lifetime = v),
      },
      {
        label: "Strength",
        min: -20,
        max: 20,
        step: 0.1,
        get: (c) => c.ripples.strength,
        set: (c, v) => (c.ripples.strength = v),
      },
    ]);
    this.on("ripple-test", "click", () => this.session.dropRipple());

    this.syncPointerMode = this.chips(
      "pointer-mode",
      POINTER_MODES,
      () => this.session.fieldConfig.pointer.mode,
      (mode) => {
        this.editConfig((config) => {
          config.pointer.mode = mode;
        });
      }
    );
    this.syncPointerNumbers = this.numbers("pointer-numbers", [
      {
        label: "Strength",
        min: 0,
        max: 20,
        step: 0.1,
        get: (c) => c.pointer.strength,
        set: (c, v) => (c.pointer.strength = v),
      },
      {
        label: "Reach",
        min: 0.1,
        max: 40,
        step: 0.1,
        get: (c) => c.pointer.radius,
        set: (c, v) => (c.pointer.radius = v),
      },
    ]);
    const click = this.on<HTMLInputElement>(
      "pointer-click",
      "change",
      (box) => {
        this.editConfig((config) => {
          config.pointer.clickRipples = box.checked;
        });
      }
    );
    click.checked = this.session.fieldConfig.pointer.clickRipples;

    this.syncColorMode = this.chips(
      "look-color",
      COLOR_MODES,
      () => this.session.fieldConfig.look.colorMode,
      (mode) => {
        this.editConfig((config) => {
          config.look.colorMode = mode;
        });
      }
    );
    this.syncPalette = this.chips(
      "look-palette",
      paletteOptions(),
      () => this.session.fieldConfig.look.palette,
      (palette) => {
        this.editConfig((config) => {
          config.look.palette = palette;
        });
      }
    );
    this.syncLookNumbers = this.numbers("look-numbers", [
      {
        label: "Particles",
        min: 500,
        max: 60_000,
        step: 500,
        get: (c) => c.look.particleCount,
        set: (c, v) => (c.look.particleCount = Math.round(v)),
      },
      {
        label: "Trail",
        min: 0,
        max: 0.995,
        step: 0.005,
        get: (c) => c.look.trailPersistence,
        set: (c, v) => (c.look.trailPersistence = v),
      },
      {
        label: "Flow speed",
        min: 0.05,
        max: 6,
        step: 0.05,
        get: (c) => c.look.speed,
        set: (c, v) => (c.look.speed = v),
      },
      {
        label: "Glow",
        min: 0,
        max: 1,
        step: 0.05,
        get: (c) => c.look.glow,
        set: (c, v) => (c.look.glow = v),
      },
      {
        label: "Opacity",
        min: 0.02,
        max: 1,
        step: 0.02,
        get: (c) => c.look.opacity,
        set: (c, v) => (c.look.opacity = v),
      },
      {
        label: "Render detail",
        min: 0.25,
        max: 1,
        step: 0.05,
        get: (c) => c.look.renderScale,
        set: (c, v) => (c.look.renderScale = v),
      },
    ]);
    const normalize = this.on<HTMLInputElement>(
      "look-normalize",
      "change",
      (box) => {
        this.editConfig((config) => {
          config.look.normalizeSpeed = box.checked;
        });
      }
    );
    normalize.checked = this.session.fieldConfig.look.normalizeSpeed;

    this.on("field-toggle", "click", () => this.session.toggleField());
    this.syncField();
  }

  private bindGraph() {
    this.syncWaveMode = this.chips(
      "wave-mode",
      WAVE_MODES,
      () => this.session.waveMode,
      (mode) => this.session.setWaveMode(mode)
    );

    const speed = this.on<HTMLInputElement>("speed", "change", (element) => {
      // A rejected value is put back rather than left showing something the
      // session did not accept.
      if (!this.session.setSpeedOfSound(Number(element.value)))
        element.value = String(this.session.speedOfSound);
    });
    speed.value = String(this.session.speedOfSound);

    this.find("graph-variables").replaceChildren(
      ...Object.values(SCALARS).map((latex) => {
        const row = document.createElement("code");
        row.textContent = latex.replace(/[{}\\]/g, "");
        return row;
      }),
      ...[
        "lambda_audio",
        "X_wave",
        "Y_wave",
        "F_bin",
        "S_bin",
        "W_audio(x)",
      ].map((name) => {
        const row = document.createElement("code");
        row.textContent = name;
        return row;
      })
    );

    this.on("graph-toggle", "click", () => this.session.toggleGraph());
    this.on("graph-remove", "click", () => this.session.removeGraph());
  }

  // Set by `bind`, called by `onStateChange`. Declared here rather than inline
  // so that a control added without a matching sync is a compile error.
  private syncResponse?: () => void;
  private syncPreset?: () => void;
  private syncGallery?: () => void;
  private syncRippleSource?: () => void;
  private syncRippleOrigin?: () => void;
  private syncRippleNumbers?: () => void;
  private syncPointerMode?: () => void;
  private syncPointerNumbers?: () => void;
  private syncColorMode?: () => void;
  private syncPalette?: () => void;
  private syncLookNumbers?: () => void;
  private syncWaveMode?: () => void;

  private syncField() {
    const config = this.session.fieldConfig;
    const p = this.find<HTMLInputElement>("field-p");
    const q = this.find<HTMLInputElement>("field-q");
    if (document.activeElement !== p) p.value = config.p;
    if (document.activeElement !== q) q.value = config.q;
    this.syncPreset?.();
    this.syncGallery?.();
    this.syncRippleSource?.();
    this.syncRippleOrigin?.();
    this.syncRippleNumbers?.();
    this.syncPointerMode?.();
    this.syncPointerNumbers?.();
    this.syncColorMode?.();
    this.syncPalette?.();
    this.syncLookNumbers?.();
    const preset = AUDIO_FIELD_PRESETS.find(
      (item) => item.id === config.presetId
    );
    const gallery = galleryPresetFromConfigId(config.presetId);
    this.text(
      "field-hint",
      preset?.description ??
        gallery?.blurb ??
        "Your own field. Pick a starting point above to begin again from one."
    );
  }

  // ------------------------------------------------------------ SessionView

  onStateChange() {
    this.text(
      "analyze",
      this.session.isCapturing ? "Stop tab analysis" : "Analyze tab audio"
    );
    this.text(
      "graph-toggle",
      this.session.isGraphLive ? "Stop updating the graph" : "Start live graph"
    );
    this.find<HTMLButtonElement>("graph-remove").disabled =
      !this.session.graphExists;
    this.text(
      "field-toggle",
      this.session.isFieldRunning ? "Hide audio field" : "Show audio field"
    );
    this.text("wave-mode-hint", WAVE_MODE_HINTS[this.session.waveMode]);
    this.text("response-hint", RESPONSE[this.session.response].hint);
    this.find<HTMLButtonElement>("play").disabled = !this.session.hasFile;
    this.text("filename", this.session.currentFileName);
    this.syncResponse?.();
    this.syncWaveMode?.();
    this.syncField();
  }

  onStatus(message: string, error: boolean) {
    this.text("status", message);
    this.find("status").classList.toggle("dsm-audio-lab-error", error);
  }

  onAccount(name?: string) {
    const signedIn = name !== undefined;
    this.text("account", signedIn ? `Signed in as ${name}` : "Not signed in");
    this.find<HTMLButtonElement>("sign-in").hidden = signedIn;
    this.find<HTMLButtonElement>("sign-out").hidden = !signedIn;
    this.find<HTMLButtonElement>("spotify-load").disabled = !signedIn;
  }

  onPlayback(playback: SpotifyPlayback) {
    this.text(
      "track",
      playback.active
        ? (playback.track ?? "Unknown track")
        : "No active Spotify player"
    );
    this.text(
      "artist",
      playback.active
        ? [playback.artist, playback.device].filter(Boolean).join(" · ")
        : "Open Spotify and play anything once."
    );
    this.text(
      "playback-time",
      `${formatTime((playback.progressMs ?? 0) / 1000)} / ${formatTime(
        (playback.durationMs ?? 0) / 1000
      )}`
    );
    this.text(
      "spotify-toggle",
      this.session.isSpotifyPlaying ? "Pause" : "Play"
    );
    for (const name of ["spotify-toggle", "previous", "next"])
      this.find<HTMLButtonElement>(name).disabled = !playback.active;
  }

  onFrame(frame: AudioFeatureFrame) {
    if (!this.visible) return;
    this.showMetrics(frame);
    this.drawWaveform();
    // The spectrum canvas lives in the Source tab. Drawing it while the Field
    // tab is showing is a canvas nobody can see, redrawn sixty times a second.
    if (this.tab === "source") this.drawSpectrum();
  }

  // ---------------------------------------------------------------- drawing

  /**
   * The readouts beside the canvases.
   *
   * A frequency the analyser is not confident about shows as an em dash rather
   * than as a number: a polyphonic frame does not have "a" frequency, and
   * printing the loudest bin anyway is how a readout becomes a lie.
   */
  private showMetrics(frame: AudioFeatureFrame) {
    const confident =
      Number.isFinite(frame.dominantHz) && frame.confidence > 0.2;
    this.text("peak", confident ? `${Math.round(frame.dominantHz)} Hz` : "—");
    this.text(
      "wavelength",
      confident ? `${frame.wavelength.toFixed(2)} m` : "—"
    );
    this.text(
      "tempo",
      Number.isFinite(frame.bpm) ? `${Math.round(frame.bpm)} BPM` : "—"
    );
    this.text("rms", frame.rms.toFixed(3));
    this.text(
      "bands",
      `${Math.round(frame.bass * 100)} / ${Math.round(
        frame.mid * 100
      )} / ${Math.round(frame.treble * 100)}`
    );
  }

  /** Matches the backing store to the observed box. Never measures. */
  private sizeCanvas(canvas: HTMLCanvasElement) {
    const box = this.canvasSize.get(canvas);
    if (box === undefined) return false;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(box.width * ratio));
    const height = Math.max(1, Math.round(box.height * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    return true;
  }

  /**
   * The waveform, decimated to the width it is drawn at.
   *
   * The analyser hands over up to 4096 samples and the canvas is a few hundred
   * pixels wide, so drawing one line segment per sample asked the rasteriser to
   * resolve an order of magnitude more geometry than the canvas can show — and
   * then threw most of it away. Two vertices per column, the extremes of the
   * samples that fall in it, is the same picture: it keeps the envelope, which
   * is the whole of what a waveform at this size conveys.
   */
  private drawWaveform() {
    const samples = this.session.waveform;
    if (samples.length === 0) return;
    const canvas = this.wave;
    if (!this.sizeCanvas(canvas)) return;
    const { width, height } = canvas;
    const context = canvas.getContext("2d");
    if (context === null) return;
    context.clearRect(0, 0, width, height);

    const columns = Math.min(Math.max(1, Math.floor(width)), 2048);
    const perColumn = samples.length / columns;
    context.strokeStyle = "#2d70b3";
    context.lineWidth = Math.max(1, Math.min(devicePixelRatio || 1, 2));
    context.beginPath();
    for (let column = 0; column < columns; column++) {
      const start = Math.floor(column * perColumn);
      const end = Math.max(start + 1, Math.floor((column + 1) * perColumn));
      let lowest = Infinity;
      let highest = -Infinity;
      for (let i = start; i < end && i < samples.length; i++) {
        const sample = samples[i];
        if (sample < lowest) lowest = sample;
        if (sample > highest) highest = sample;
      }
      const x = (column / Math.max(1, columns - 1)) * width;
      context.moveTo(x, (0.5 - highest * 0.45) * height);
      context.lineTo(x, (0.5 - lowest * 0.45) * height);
    }
    context.stroke();
  }

  /**
   * The spectrum, as bars.
   *
   * Reduced by walking the bins directly rather than by building an
   * intermediate array, which is one allocation per frame that only ever exists
   * to be read once and dropped.
   */
  private drawSpectrum() {
    const bins = this.session.spectrum;
    if (bins.length === 0) return;
    const canvas = this.spectrum;
    if (!this.sizeCanvas(canvas)) return;
    const { width, height } = canvas;
    const context = canvas.getContext("2d");
    if (context === null) return;
    context.clearRect(0, 0, width, height);

    const bars = Math.min(128, bins.length);
    const perBar = bins.length / bars;
    const barWidth = width / bars;
    context.fillStyle = "#2d70b3";
    for (let bar = 0; bar < bars; bar++) {
      const start = Math.floor(bar * perBar);
      const end = Math.max(start + 1, Math.floor((bar + 1) * perBar));
      let loudest = -Infinity;
      for (let i = start; i < end && i < bins.length; i++)
        if (bins[i] > loudest) loudest = bins[i];
      // dBFS, floored at -100, which is the analyser's own reporting floor.
      const level = Math.max(0, Math.min(1, (loudest + 100) / 100));
      context.fillRect(
        bar * barWidth,
        height * (1 - level),
        Math.max(1, barWidth - 1),
        height * level
      );
    }
  }
}

/** The palettes, grouped the way the shared picker groups them. */
function paletteOptions(): ReadonlyArray<readonly [PaletteID, string]> {
  const options: Array<readonly [PaletteID, string]> = [];
  for (const group of PALETTE_GROUPS)
    for (const [id, palette] of Object.entries(PALETTES))
      if (palette.group === group.id)
        options.push([id as PaletteID, palette.name]);
  return options;
}

/** Enough places to be exact for every step this panel offers, and no more. */
function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}
