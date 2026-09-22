/**
 * Everything Audio Lab keeps running, whether or not its panel is open.
 *
 * The panel used to own all of this, which meant closing it silently stopped
 * the capture, the field, and the graph updates. That is the wrong lifetime:
 * the panel is a set of controls, and closing a control surface is not a
 * request to stop what it was controlling. A field drawing behind the graph and
 * a folder of live variables are things the user turned on, and they stay on
 * until the user turns them off or disables the plugin.
 *
 * So the session lives on the plugin controller, and the panel attaches to it
 * as a view. Attaching is what starts the panel's own canvases, its readouts,
 * and the Spotify polling — none of which is worth doing when nobody can see
 * it. Detaching stops exactly those, and nothing else.
 */
import type AudioLab from ".";
import { listenToMessageDown, postMessageUp } from "#utils/messages.ts";
import { downsample, spotifyUri } from "./dsp";
import { AudioAnalysisEngine } from "./audio/AudioAnalysisEngine";
import {
  DEFAULT_SPEED_OF_SOUND,
  SILENT_FRAME,
  spectrumPoints,
  strongestComponents,
  type AudioFeatureFrame,
  type SpectralComponent,
} from "./audio/features";
import { DesmosAudioAdapter } from "./desmos/DesmosAudioAdapter";
import {
  MAX_COMPONENTS,
  SPECTRUM_POINTS,
  WAVEFORM_POINTS,
  type WaveFunctionMode,
} from "./desmos/manifest";
import { AudioFieldController } from "./field/AudioFieldController";
import { compileAudioField } from "./field/compile";
import {
  configFromGalleryPreset,
  galleryPresetFromConfigId,
  identifyPreset,
} from "./field/gallery";
import {
  AUDIO_FIELD_PRESETS,
  configFromPreset,
  normalizeAudioFieldConfig,
  type AudioFieldConfig,
} from "./field/model";

/**
 * How patient the measurement is, as one choice.
 *
 * Every number here trades the same thing, which is why they move together.
 * A shorter window, less analyser smoothing and slacker engine smoothers all
 * mean the field moves sooner after the sound does, and all mean the numbers
 * jitter more on material that is not a clean tone.
 *
 * The delay this controls is larger than it looks. At the old fixed settings a
 * bin was averaged with roughly the previous three frames *and* measured over
 * an 85 ms window *and* then smoothed again by the engine, which put the field
 * something like a sixth of a second behind the music — far enough to see on a
 * drum track, and the single biggest reason it felt laggy.
 *
 * `intervalMs` is a floor, not a rate: the loop runs on animation frames and
 * skips one that arrives too soon. Zero means measure on every frame, which is
 * what `snappy` wants and what a 240 Hz display makes cheap enough to do.
 */
export const RESPONSE = {
  snappy: {
    label: "Snappy",
    fftSize: 1024,
    analyserSmoothing: 0,
    smootherScale: 0.35,
    intervalMs: 0,
    hint: "Reacts almost at once. The frequency readout will wander on anything but a clean note.",
  },
  balanced: {
    label: "Balanced",
    fftSize: 2048,
    analyserSmoothing: 0.35,
    smootherScale: 1,
    intervalMs: 1000 / 60,
    hint: "Quick enough to feel connected to the music, steady enough to read.",
  },
  smooth: {
    label: "Smooth",
    fftSize: 4096,
    analyserSmoothing: 0.72,
    smootherScale: 2,
    intervalMs: 1000 / 40,
    hint: "Steadiest numbers and the finest frequency resolution, at about a sixth of a second behind.",
  },
} as const;

export type Response = keyof typeof RESPONSE;

/**
 * The old setting's three values, mapped onto the new ones.
 *
 * A stored `quality` of "performance" meant a small window, which is what
 * `snappy` is; "quality" meant a large one. Migrating rather than resetting so
 * that someone who had chosen a setting keeps the closest thing to it.
 */
const RESPONSE_FROM_QUALITY: Record<string, Response> = {
  performance: "snappy",
  balanced: "balanced",
  quality: "smooth",
};

export function normalizeResponse(stored: string): Response {
  if (stored in RESPONSE) return stored as Response;
  return RESPONSE_FROM_QUALITY[stored] ?? "balanced";
}

type SpotifyAction =
  | "sign-in"
  | "status"
  | "sign-out"
  | "play"
  | "pause"
  | "resume"
  | "next"
  | "previous"
  | "playback-state"
  | "open";

interface SpotifyProfile {
  name: string;
}

export interface SpotifyPlayback {
  active: boolean;
  isPlaying?: boolean;
  progressMs?: number;
  durationMs?: number;
  track?: string;
  artist?: string;
  device?: string;
}

/**
 * What the session tells whoever is currently looking at it.
 *
 * Every method is optional to implement in spirit but required in the type,
 * because a view that forgets one goes quietly stale rather than failing.
 */
export interface SessionView {
  /** A new measurement. Called at the analysis rate while attached. */
  onFrame: (frame: AudioFeatureFrame) => void;
  /** Something the controls should re-read: button labels, enabled states. */
  onStateChange: () => void;
  onStatus: (message: string, error: boolean) => void;
  onAccount: (name?: string) => void;
  onPlayback: (playback: SpotifyPlayback) => void;
}

/**
 * Checks a configuration compiles, without a renderer to try it on.
 *
 * The field may be switched off while someone is editing the expression, and an
 * editor that says nothing until you switch the field on is an editor that lets
 * you get it wrong in silence.
 */
function compileOnly(config: AudioFieldConfig) {
  const compiled = compileAudioField(config);
  return compiled.ok
    ? undefined
    : `${compiled.which} could not be read. ${compiled.error}`;
}

/** Handed to the adapter on a frame with no lists due. Shared, never written. */
const EMPTY_NUMBERS: readonly number[] = [];
const EMPTY_COMPONENTS: readonly SpectralComponent[] = [];

export default class AudioLabSession {
  private context?: AudioContext;
  private analyser?: AnalyserNode;
  private source?: AudioNode;
  private localSource?: MediaElementAudioSourceNode;
  private sourceMode?: "local" | "capture";
  private capture?: MediaStream;
  private objectUrl?: string;
  private frame?: number;
  private lastFrame = 0;
  private timeData = new Float32Array();
  private frequencyData = new Float32Array();
  private spotifyPlaying = false;
  private signedInName?: string;
  private lastPlayback: SpotifyPlayback = { active: false };
  private fileName = "";
  private playbackPoll?: ReturnType<typeof setInterval>;
  private view?: SessionView;
  private destroyed = false;
  /**
   * The last thing the session had to say.
   *
   * Kept so reopening the panel shows the current situation rather than an
   * empty status line, which reads as "nothing is happening" when quite a lot
   * may be.
   */
  private lastStatus = { message: "", error: false };

  private readonly engine = new AudioAnalysisEngine();
  private readonly graph: DesmosAudioAdapter;
  private readonly field: AudioFieldController;
  /** Reused across frames so the steady loop allocates nothing. */
  private components: SpectralComponent[] = [];
  private readonly messageListener: (event: MessageEvent) => void;
  /** Owned here and never put in the DOM. A detached audio element still plays. */
  private readonly audio: HTMLAudioElement;
  private readonly spotifyResponses = new Map<
    string,
    {
      resolve: (value?: unknown) => void;
      reject: (error: Error) => void;
      timeout: ReturnType<typeof setTimeout>;
    }
  >();

  constructor(private readonly plugin: AudioLab) {
    this.graph = new DesmosAudioAdapter(plugin.calc);
    // The field reads the latest frame on its own animation clock. It never
    // drives the analysis and the analysis never waits for it, which is what
    // lets either be switched off without changing what the other sees.
    this.field = new AudioFieldController(plugin.calc, {
      onError: (message) => {
        this.status(message, true);
        this.changed();
      },
      onRecovered: () => {
        this.status("The audio field is drawing again.");
        this.changed();
      },
      getFrame: () => this.engine.latest,
      reversesContrast: () =>
        plugin.cc.graphSettings?.config?.invertedColors ?? false,
    });
    this.audio = document.createElement("audio");
    this.audio.preload = "metadata";
    this.audio.addEventListener("play", () => this.ensureAudioElementGraph());
    this.audio.addEventListener("play", () => this.changed());
    this.audio.addEventListener("pause", () => this.changed());
    this.engine.setSpeedOfSound(this.speedOfSound);
    // The stored response has to reach the engine here, not only when the
    // control is touched. Without it, a page reloaded on "Snappy" measures at
    // the default patience until someone clicks the chip that is already lit.
    this.engine.setResponseScale(RESPONSE[this.response].smootherScale);

    this.messageListener = listenToMessageDown((message) => {
      if (message.type !== "audio-lab-spotify-response") return false;
      const pending = this.spotifyResponses.get(message.requestId);
      if (pending === undefined) return false;
      this.spotifyResponses.delete(message.requestId);
      clearTimeout(pending.timeout);
      if (message.ok) pending.resolve(message.value);
      else
        pending.reject(new Error(message.error ?? "Spotify request failed."));
      return false;
    });
  }

  // ---------------------------------------------------------------- settings
  // Read through the plugin's own config so they survive a page reload, which
  // is what "the last preset" has to mean to be worth remembering at all.

  get waveMode() {
    return this.plugin.settings.waveMode;
  }

  /**
   * The audio field's whole configuration.
   *
   * Parsed from the stored string on every read, and that is affordable because
   * every caller is a control or a start, never the animation loop — the
   * running field holds the configuration it was started with.
   */
  get fieldConfig(): AudioFieldConfig {
    return (this.cachedFieldConfig ??= this.readFieldConfig());
  }

  private cachedFieldConfig?: AudioFieldConfig;

  private readFieldConfig(): AudioFieldConfig {
    const stored = this.plugin.settings.fieldConfig;
    if (stored === "") return configFromPreset("stream");
    try {
      return normalizeAudioFieldConfig(JSON.parse(stored));
    } catch {
      // A setting that will not parse is a setting written by something else,
      // or by a hand. Starting from the default beats refusing to draw.
      return configFromPreset("stream");
    }
  }

  get response(): Response {
    return normalizeResponse(this.plugin.settings.response);
  }

  get speedOfSound() {
    const value = Number(this.plugin.settings.speedOfSound);
    return Number.isFinite(value) && value > 0 ? value : DEFAULT_SPEED_OF_SOUND;
  }

  // ------------------------------------------------------------------- state

  get isCapturing() {
    return this.capture !== undefined;
  }

  get isFieldRunning() {
    return this.field.isRunning;
  }

  get isGraphLive() {
    return this.graph.isInstalled;
  }

  get graphExists() {
    return this.graph.exists;
  }

  get hasFile() {
    return this.objectUrl !== undefined;
  }

  get currentFileName() {
    return this.fileName;
  }

  get isFilePlaying() {
    return !this.audio.paused;
  }

  get volume() {
    return this.audio.volume;
  }

  get isSignedIn() {
    return this.signedInName !== undefined;
  }

  get accountName() {
    return this.signedInName;
  }

  get playbackState() {
    return this.lastPlayback;
  }

  get status$() {
    return this.lastStatus;
  }

  get latest() {
    return this.engine.latest;
  }

  /** The analyser's raw buffers, for the panel's own canvases. */
  get waveform(): Readonly<Float32Array> {
    return this.timeData;
  }

  get spectrum(): Readonly<Float32Array> {
    return this.frequencyData;
  }

  // ------------------------------------------------------------------ attach

  /**
   * Connects a panel. Starts the things only a visible panel needs.
   *
   * The analysis loop may already be running for the field or the graph; this
   * only adds the view to the list of reasons to run it.
   */
  attach(view: SessionView) {
    this.view = view;
    view.onAccount(this.signedInName);
    view.onPlayback(this.lastPlayback);
    view.onStatus(this.lastStatus.message, this.lastStatus.error);
    view.onStateChange();
    this.syncLoop();
    void this.refreshSpotifyStatus();
    this.playbackPoll ??= setInterval(() => {
      void this.refreshPlayback();
    }, 2500);
  }

  /**
   * Disconnects the panel and stops only what the panel was for.
   *
   * The capture, the analysis, the field, and the graph updates all carry on.
   * That is the point.
   */
  detach() {
    this.view = undefined;
    if (this.playbackPoll !== undefined) clearInterval(this.playbackPoll);
    this.playbackPoll = undefined;
    this.syncLoop();
  }

  /** Full teardown. Only the plugin being disabled should call this. */
  destroy() {
    this.destroyed = true;
    this.detach();
    this.graph.stop();
    this.field.stop();
    this.stopLoop();
    window.removeEventListener("message", this.messageListener, false);
    for (const pending of this.spotifyResponses.values()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Audio Lab was disabled."));
    }
    this.spotifyResponses.clear();
    this.capture?.getTracks().forEach((track) => track.stop());
    this.capture = undefined;
    if (!this.audio.paused) this.audio.pause();
    this.source?.disconnect();
    this.source = undefined;
    void this.context?.close();
    this.context = undefined;
    if (this.objectUrl !== undefined) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = undefined;
  }

  // ---------------------------------------------------------------- commands

  async analyzeTab() {
    try {
      this.capture?.getTracks().forEach((track) => track.stop());
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      stream.getVideoTracks().forEach((track) => track.stop());
      if (stream.getAudioTracks().length === 0) {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error(
          "No tab audio was shared. Enable Share tab audio and retry."
        );
      }
      this.capture = new MediaStream(stream.getAudioTracks());
      this.setupContext();
      this.source?.disconnect();
      this.analyser!.disconnect();
      this.source = this.context!.createMediaStreamSource(this.capture);
      this.sourceMode = "capture";
      this.source.connect(this.analyser!);
      this.capture
        .getAudioTracks()[0]
        ?.addEventListener("ended", () => this.stopTabAnalysis());
      // The adaptive references and beat intervals describe the source that
      // just stopped; carrying them into a new one mis-scales its first
      // several seconds.
      this.engine.reset();
      this.status(
        "Live analysis is running. It keeps going if you close this."
      );
    } catch (error) {
      this.status(
        error instanceof Error ? error.message : "Tab analysis was cancelled.",
        true
      );
    }
    this.changed();
  }

  stopTabAnalysis() {
    const { capture } = this;
    this.capture = undefined;
    capture?.getTracks().forEach((track) => track.stop());
    if (this.sourceMode === "capture") {
      this.source?.disconnect();
      this.source = undefined;
      this.sourceMode = undefined;
    }
    this.status("Tab analysis stopped.");
    this.changed();
  }

  loadFile(file?: File) {
    if (!file?.type.startsWith("audio/")) {
      this.status("Choose a supported audio file.", true);
      return;
    }
    if (this.objectUrl !== undefined) URL.revokeObjectURL(this.objectUrl);
    this.stopTabAnalysis();
    this.objectUrl = URL.createObjectURL(file);
    this.audio.src = this.objectUrl;
    this.fileName = file.name;
    this.engine.reset();
    this.status("Audio ready.");
    this.changed();
  }

  togglePlay() {
    if (this.audio.paused) void this.audio.play();
    else this.audio.pause();
  }

  setVolume(value: number) {
    if (Number.isFinite(value))
      this.audio.volume = Math.min(Math.max(value, 0), 1);
  }

  setResponse(response: Response) {
    this.plugin.setSetting("response", response);
    this.configureAnalyser();
    this.engine.setResponseScale(RESPONSE[response].smootherScale);
    this.changed();
  }

  /** Creates the managed folder, or stops writing to it. */
  toggleGraph() {
    if (this.graph.isInstalled) {
      this.graph.stop();
      this.status(
        "The Audio Lab variables are still in your graph; they have stopped updating."
      );
    } else {
      try {
        this.graph.install({
          mode: this.waveMode,
          speedOfSound: this.speedOfSound,
        });
        this.status(
          "The Audio Lab folder is live. It keeps updating if you close this."
        );
      } catch (error) {
        this.status(
          error instanceof Error
            ? error.message
            : "The Audio Lab folder could not be created.",
          true
        );
      }
    }
    this.syncLoop();
    this.changed();
  }

  removeGraph() {
    this.graph.remove();
    this.status("Removed the Audio Lab folder. Nothing else was touched.");
    this.syncLoop();
    this.changed();
  }

  setWaveMode(mode: WaveFunctionMode) {
    this.plugin.setSetting("waveMode", mode);
    this.graph.setFunctionMode(mode);
    this.changed();
  }

  setSpeedOfSound(metresPerSecond: number) {
    if (!Number.isFinite(metresPerSecond) || metresPerSecond <= 0) {
      this.status("The speed of sound has to be a positive number.", true);
      return false;
    }
    this.plugin.setSetting("speedOfSound", String(metresPerSecond));
    this.engine.setSpeedOfSound(metresPerSecond);
    this.graph.setSpeedOfSound(metresPerSecond);
    return true;
  }

  toggleField() {
    if (this.field.isRunning) {
      this.field.stop();
      this.status("The audio field is off.");
    } else {
      const error = this.field.start(this.fieldConfig);
      if (error !== undefined) this.status(error, true);
      else if (this.field.isRunning)
        this.status(
          "The audio field is drawing behind the graph. It stays until you hide it."
        );
    }
    this.syncLoop();
    this.changed();
  }

  /**
   * Replaces the configuration, and re-applies it if the field is running.
   *
   * Returns the message a bad expression produced, so the panel can show it
   * beside the box it was typed into rather than in the status line at the
   * bottom. The configuration is stored either way: an expression that does not
   * compile yet is still what the user is in the middle of writing, and
   * throwing it away on every keystroke would make the editor unusable.
   */
  setFieldConfig(config: AudioFieldConfig): string | undefined {
    const normalized = normalizeAudioFieldConfig(config);
    // Once the components stop matching the preset they came from — from either
    // list — the field is the user's rather than the preset's, and the chooser
    // says so.
    normalized.presetId = identifyPreset(normalized);
    this.cachedFieldConfig = normalized;
    this.plugin.setSetting("fieldConfig", JSON.stringify(normalized));
    const error = this.field.isRunning
      ? this.field.start(normalized)
      : compileOnly(normalized);
    this.changed();
    return error;
  }

  /**
   * Loads a starting point wholesale: components, ripples, pointer and look.
   *
   * Takes an id from either list. A gallery field arrives with a loudness term
   * written into both of its components and its clock rescaled in place — both
   * visible in the boxes, both editable, and both explained in `field/gallery`.
   */
  loadFieldPreset(id: string) {
    const gallery = galleryPresetFromConfigId(id);
    if (gallery !== undefined) {
      this.setFieldConfig(configFromGalleryPreset(gallery));
      this.status(`Loaded ${gallery.name}. ${gallery.blurb}`);
      return;
    }
    const preset = AUDIO_FIELD_PRESETS.find((item) => item.id === id);
    if (preset === undefined) return;
    this.setFieldConfig(configFromPreset(id));
    this.status(`Loaded the ${preset.name} field.`);
  }

  /** Drops a ripple in the middle of the view, for trying one out. */
  dropRipple() {
    if (!this.field.isRunning) {
      this.status("Show the audio field first.", true);
      return;
    }
    this.field.dropRippleAtCentre();
  }

  // ----------------------------------------------------------------- spotify

  async signIn() {
    this.status("Opening Spotify sign-in…");
    try {
      const profile = await this.spotifyRequest("sign-in");
      this.setSignedIn((profile as SpotifyProfile | undefined)?.name);
      this.status("Spotify connected successfully.");
      await this.refreshPlayback();
    } catch (error) {
      this.setSignedIn();
      this.status(
        error instanceof Error ? error.message : "Spotify sign-in failed.",
        true
      );
    }
  }

  async signOut() {
    try {
      await this.spotifyRequest("sign-out");
      this.setSignedIn();
      this.status("Signed out of Spotify.");
    } catch (error) {
      this.status(
        error instanceof Error ? error.message : "Spotify sign-out failed.",
        true
      );
    }
  }

  async openSpotify() {
    try {
      await this.spotifyRequest("open");
    } catch (error) {
      this.status(
        error instanceof Error ? error.message : "Could not open Spotify.",
        true
      );
    }
  }

  async playLink(raw: string) {
    const uri = spotifyUri(raw);
    if (uri === undefined) {
      this.status("Paste a valid Spotify link.", true);
      return;
    }
    this.plugin.setSetting("spotifyUrl", raw.trim());
    try {
      await this.spotifyRequest("play", uri);
      this.status("Spotify playback started.");
      await this.refreshPlayback();
    } catch (error) {
      this.status(
        error instanceof Error ? error.message : "Spotify playback failed.",
        true
      );
    }
  }

  get isSpotifyPlaying() {
    return this.spotifyPlaying;
  }

  async runPlaybackCommand(action: "pause" | "resume" | "next" | "previous") {
    try {
      await this.spotifyRequest(action);
      await new Promise((resolve) => setTimeout(resolve, 250));
      await this.refreshPlayback();
    } catch (error) {
      this.status(
        error instanceof Error ? error.message : "Playback command failed.",
        true
      );
    }
  }

  private async spotifyRequest(action: SpotifyAction, uri?: string) {
    const requestId = crypto.randomUUID();
    return await new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (!this.spotifyResponses.delete(requestId)) return;
        reject(
          new Error("Spotify did not respond. Reload the extension and retry.")
        );
      }, 120_000);
      this.spotifyResponses.set(requestId, { resolve, reject, timeout });
      postMessageUp({
        type: "audio-lab-spotify",
        requestId,
        action,
        ...(uri === undefined ? {} : { uri }),
      });
    });
  }

  private async refreshSpotifyStatus() {
    try {
      const profile = await this.spotifyRequest("status");
      this.setSignedIn((profile as SpotifyProfile | undefined)?.name);
      await this.refreshPlayback();
    } catch {
      this.setSignedIn();
    }
  }

  private setSignedIn(name?: string) {
    this.signedInName = name;
    if (name === undefined) this.lastPlayback = { active: false };
    this.view?.onAccount(name);
    if (name === undefined) this.view?.onPlayback(this.lastPlayback);
  }

  private async refreshPlayback() {
    if (this.signedInName === undefined) return;
    try {
      const playback = (await this.spotifyRequest(
        "playback-state"
      )) as SpotifyPlayback;
      this.spotifyPlaying = playback.isPlaying ?? false;
      this.lastPlayback = playback;
      this.view?.onPlayback(playback);
    } catch {
      // A transient status poll should not replace a useful user-facing message.
    }
  }

  // ------------------------------------------------------------------- audio

  private setupContext() {
    this.context ??= new AudioContext();
    if (this.context.state === "suspended") void this.context.resume();
    if (this.analyser === undefined) {
      this.analyser = this.context.createAnalyser();
      this.configureAnalyser();
    }
    this.syncLoop();
  }

  private ensureAudioElementGraph() {
    this.setupContext();
    if (this.sourceMode === "local") return;
    this.source?.disconnect();
    this.analyser!.disconnect();
    this.localSource ??= this.context!.createMediaElementSource(this.audio);
    this.source = this.localSource;
    this.sourceMode = "local";
    this.source.connect(this.analyser!);
    this.analyser!.connect(this.context!.destination);
    this.syncLoop();
  }

  private configureAnalyser() {
    if (this.analyser === undefined) return;
    const profile = RESPONSE[this.response];
    this.analyser.fftSize = profile.fftSize;
    // The analyser's own smoothing is an exponential average across frames, so
    // it is delay in the most literal sense: at 0.72 a bin is roughly three
    // frames behind the sound. The engine smooths again afterwards, against a
    // real elapsed time, which is the smoothing worth keeping — it is the one
    // that behaves the same on every monitor.
    this.analyser.smoothingTimeConstant = profile.analyserSmoothing;
    this.timeData = new Float32Array(this.analyser.fftSize);
    this.frequencyData = new Float32Array(this.analyser.frequencyBinCount);
  }

  // -------------------------------------------------------------------- loop

  /**
   * Whether anything is currently waiting on a measurement.
   *
   * The loop runs for the field, for the graph, or for an open panel, and stops
   * when none of the three wants it. A plugin left enabled with nothing turned
   * on should cost nothing at all.
   */
  private get wanted() {
    if (this.destroyed || this.analyser === undefined) return false;
    return (
      this.graph.isInstalled || this.field.isRunning || this.view !== undefined
    );
  }

  private syncLoop() {
    if (this.wanted) this.startLoop();
    else this.stopLoop();
  }

  private startLoop() {
    this.frame ??= requestAnimationFrame(this.tick);
  }

  private stopLoop() {
    if (this.frame !== undefined) cancelAnimationFrame(this.frame);
    this.frame = undefined;
    this.lastFrame = 0;
  }

  /**
   * One animation frame: measure once, then let each output take what it needs
   * on its own schedule.
   *
   * The graph adapter is called every one of these and decides for itself how
   * many to act on — twelve a second for scalars, eight for lists — which is
   * what keeps the expression list from becoming a video renderer. The panel,
   * when there is one, gets every frame.
   */
  private readonly tick = (timestamp: number) => {
    this.frame = undefined;
    if (!this.wanted) return;
    this.frame = requestAnimationFrame(this.tick);
    if (timestamp - this.lastFrame < RESPONSE[this.response].intervalMs) return;
    const elapsed =
      this.lastFrame === 0 ? 0 : (timestamp - this.lastFrame) / 1000;
    this.lastFrame = timestamp;

    const analyser = this.analyser!;
    analyser.getFloatTimeDomainData(this.timeData);
    analyser.getFloatFrequencyData(this.frequencyData);
    const rate = this.context?.sampleRate ?? 0;
    const frame = this.engine.update(
      this.timeData,
      this.frequencyData,
      rate,
      analyser.fftSize,
      elapsed
    );

    this.view?.onFrame(frame);

    if (!this.graph.isInstalled) return;
    // Nothing is reduced unless the adapter is going to send it. Reducing the
    // spectrum to display points and finding the strongest components are each
    // a walk over every bin, and they were being paid for on every animation
    // frame to feed a write that happens eight times a second — seven frames in
    // eight of that work was computed, handed over, and dropped.
    //
    // The adapter itself is still called on every frame, and still decides for
    // itself what to send. It has to be: it integrates the representative
    // wave's phase from the frame clock, and a phase integrated only on the
    // frames that happen to carry a write is a coarser animation for no gain.
    const sendingLists = this.graph.dueForLists(timestamp);

    // Only the additive mode reads the components, and finding them means a
    // pass over every bin. There is no reason to pay for it in the other two.
    this.components =
      sendingLists && this.waveMode === "additive"
        ? strongestComponents(
            this.engine.spectrum as Float32Array,
            rate,
            analyser.fftSize,
            MAX_COMPONENTS
          )
        : [];
    this.graph.update(
      frame,
      sendingLists ? downsample(this.timeData, WAVEFORM_POINTS) : EMPTY_NUMBERS,
      sendingLists
        ? spectrumPoints(
            this.engine.spectrum as Float32Array,
            rate,
            analyser.fftSize,
            SPECTRUM_POINTS
          )
        : EMPTY_COMPONENTS,
      this.components,
      timestamp
    );
  };

  // ------------------------------------------------------------------ notify

  private status(message: string, error = false) {
    this.lastStatus = { message, error };
    this.view?.onStatus(message, error);
  }

  private changed() {
    this.view?.onStateChange();
  }

  /** A frame to show before any measurement has happened. */
  static readonly emptyFrame = SILENT_FRAME;
}
