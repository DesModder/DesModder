import type AudioLab from ".";
import { listenToMessageDown, postMessageUp } from "#utils/messages.ts";
import { downsample, spotifyUri } from "./dsp";
import { AudioAnalysisEngine } from "./audio/AudioAnalysisEngine";
import {
  DEFAULT_SPEED_OF_SOUND,
  spectrumPoints,
  strongestComponents,
  type SpectralComponent,
} from "./audio/features";
import { DesmosAudioAdapter } from "./desmos/DesmosAudioAdapter";
import {
  MAX_COMPONENTS,
  SPECTRUM_POINTS,
  WAVEFORM_POINTS,
  type WaveFunctionMode,
} from "./desmos/manifest";
import { AudioFieldOverlay } from "./fieldplay/AudioFieldOverlay";
import { PRESETS, presetById, type PresetId } from "./fieldplay/presets";

const QUALITY = {
  performance: { fftSize: 1024, interval: 1000 / 24 },
  balanced: { fftSize: 2048, interval: 1000 / 40 },
  quality: { fftSize: 4096, interval: 1000 / 60 },
} as const;

type Quality = keyof typeof QUALITY;
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

interface SpotifyPlayback {
  active: boolean;
  isPlaying?: boolean;
  progressMs?: number;
  durationMs?: number;
  track?: string;
  artist?: string;
  device?: string;
}

export default class AudioLabRuntime {
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
  private quality: Quality = "balanced";
  private spotifyPlaying = false;
  private readonly engine = new AudioAnalysisEngine();
  private readonly graph: DesmosAudioAdapter;
  private readonly field: AudioFieldOverlay;
  private fieldPreset: PresetId = "pulse";
  private waveMode: WaveFunctionMode = "representative";
  private speedOfSound = DEFAULT_SPEED_OF_SOUND;
  /** Reused across frames so the steady loop allocates nothing. */
  private components: SpectralComponent[] = [];
  private readonly playbackPoll: ReturnType<typeof setInterval>;
  private readonly messageListener: (event: MessageEvent) => void;
  private readonly audio: HTMLAudioElement;
  private readonly wave: HTMLCanvasElement;
  private readonly spectrum: HTMLCanvasElement;
  private readonly spotifyResponses = new Map<
    string,
    {
      resolve: (value?: unknown) => void;
      reject: (error: Error) => void;
      timeout: ReturnType<typeof setTimeout>;
    }
  >();

  constructor(
    private readonly plugin: AudioLab,
    private readonly root: HTMLElement
  ) {
    this.graph = new DesmosAudioAdapter(plugin.calc);
    // The field reads the latest frame on its own animation clock. It never
    // drives the analysis and the analysis never waits for it, which is what
    // lets either be switched off without changing what the other sees.
    this.field = new AudioFieldOverlay(plugin.calc, {
      onError: (message) => {
        this.showFieldState();
        this.status(message, true);
      },
      getFeatures: () => this.engine.latest,
    });
    this.hydrateMediaElements();
    this.audio = this.find<HTMLAudioElement>("audio");
    this.wave = this.find<HTMLCanvasElement>("wave");
    this.spectrum = this.find<HTMLCanvasElement>("spectrum");
    this.bind();
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
    this.frame = requestAnimationFrame(this.draw);
    void this.refreshSpotifyStatus();
    this.playbackPoll = setInterval(() => {
      void this.refreshPlayback();
    }, 2500);
  }

  private hydrateMediaElements() {
    const replace = (name: string, element: HTMLElement) => {
      element.dataset.audioLab = name;
      this.root
        .querySelector(`[data-audio-lab-placeholder="${name}"]`)
        ?.replaceWith(element);
    };
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    replace("audio", audio);
    for (const name of ["wave", "spectrum"]) {
      const canvas = document.createElement("canvas");
      canvas.className = "dsm-audio-lab-canvas";
      replace(name, canvas);
    }
  }

  destroy() {
    // The expressions stay. Closing a panel is not a request to delete graph
    // content, and "Remove from graph" is right there when it is.
    this.graph.stop();
    this.field.stop();
    if (this.frame !== undefined) cancelAnimationFrame(this.frame);
    window.removeEventListener("message", this.messageListener, false);
    if (this.playbackPoll !== undefined) clearInterval(this.playbackPoll);
    for (const pending of this.spotifyResponses.values()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Audio Lab closed."));
    }
    this.spotifyResponses.clear();
    this.capture?.getTracks().forEach((track) => track.stop());
    this.source?.disconnect();
    void this.context?.close();
    if (this.objectUrl !== undefined) URL.revokeObjectURL(this.objectUrl);
  }

  private find<T extends Element>(name: string) {
    const element = this.root.querySelector<T>(`[data-audio-lab="${name}"]`);
    if (element === null) throw new Error(`Missing Audio Lab element: ${name}`);
    return element;
  }

  private bind() {
    const url = this.find<HTMLInputElement>("spotify-url");
    url.value = this.plugin.spotifyUrl;
    this.find<HTMLButtonElement>("sign-in").addEventListener("click", () => {
      void this.signIn();
    });
    this.find<HTMLButtonElement>("sign-out").addEventListener("click", () => {
      void this.signOut();
    });
    this.find<HTMLButtonElement>("open-spotify").addEventListener(
      "click",
      () => {
        void this.spotifyRequest("open").catch((error: unknown) =>
          this.status(
            error instanceof Error ? error.message : "Could not open Spotify.",
            true
          )
        );
      }
    );
    this.find<HTMLButtonElement>("spotify-load").addEventListener(
      "click",
      () => {
        const uri = spotifyUri(url.value);
        if (uri === undefined) {
          this.status("Paste a valid Spotify link.", true);
          return;
        }
        this.plugin.setSpotifyUrl(url.value.trim());
        void this.spotifyRequest("play", uri).then(
          () => {
            this.status("Spotify playback started.");
            void this.refreshPlayback();
          },
          (error: unknown) =>
            this.status(
              error instanceof Error
                ? error.message
                : "Spotify playback failed.",
              true
            )
        );
      }
    );
    this.find<HTMLButtonElement>("spotify-toggle").addEventListener(
      "click",
      () => {
        this.runPlaybackCommand(this.spotifyPlaying ? "pause" : "resume").catch(
          () => undefined
        );
      }
    );
    // A click handler returns nothing, so the promise is voided here rather
    // than handed back to the listener — the same shape as the `analyze`
    // handler below.
    this.find<HTMLButtonElement>("previous").addEventListener("click", () => {
      void this.runPlaybackCommand("previous").catch(() => undefined);
    });
    this.find<HTMLButtonElement>("next").addEventListener("click", () => {
      void this.runPlaybackCommand("next").catch(() => undefined);
    });
    this.find<HTMLButtonElement>("analyze").addEventListener("click", () => {
      if (this.capture === undefined) void this.analyzeTab();
      else this.stopTabAnalysis();
    });
    const file = this.find<HTMLInputElement>("file");
    file.addEventListener("change", () => this.loadFile(file.files?.[0]));
    this.audio.addEventListener("play", () => this.ensureAudioElementGraph());
    this.find<HTMLButtonElement>("play").addEventListener("click", () => {
      if (this.audio.paused) void this.audio.play();
      else this.audio.pause();
    });
    this.find<HTMLInputElement>("volume").addEventListener("input", (event) => {
      this.audio.volume = Number((event.target as HTMLInputElement).value);
    });
    this.find<HTMLSelectElement>("quality").addEventListener(
      "change",
      (event) => {
        this.quality = (event.target as HTMLSelectElement).value as Quality;
        this.configureAnalyser();
      }
    );
    this.find<HTMLButtonElement>("graph-toggle").addEventListener("click", () =>
      this.toggleGraph()
    );
    this.find<HTMLButtonElement>("graph-remove").addEventListener("click", () =>
      this.removeGraph()
    );
    this.find<HTMLSelectElement>("wave-mode").addEventListener(
      "change",
      (event) => {
        this.waveMode = (event.target as HTMLSelectElement)
          .value as WaveFunctionMode;
        this.graph.setFunctionMode(this.waveMode);
        this.showWaveModeHint();
      }
    );
    const speed = this.find<HTMLInputElement>("speed");
    speed.value = String(this.speedOfSound);
    speed.addEventListener("change", () => {
      const value = Number(speed.value);
      if (!Number.isFinite(value) || value <= 0) {
        speed.value = String(this.speedOfSound);
        this.status("The speed of sound has to be a positive number.", true);
        return;
      }
      this.speedOfSound = value;
      this.engine.setSpeedOfSound(value);
      this.graph.setSpeedOfSound(value);
    });
    this.find<HTMLButtonElement>("field-toggle").addEventListener("click", () =>
      this.toggleField()
    );
    const preset = this.find<HTMLSelectElement>("field-preset");
    // Built from the registry rather than written out in the panel, so adding
    // a preset cannot leave the picker one option short of the presets.
    preset.replaceChildren(
      ...PRESETS.map((item) => {
        const option = document.createElement("option");
        option.value = item.id;
        option.textContent = item.name;
        return option;
      })
    );
    preset.value = this.fieldPreset;
    preset.addEventListener("change", () => {
      this.fieldPreset = preset.value as PresetId;
      // Switching a running field swaps to that preset's already-compiled
      // programs; switching a stopped one just remembers the choice.
      if (this.field.isRunning) this.field.start(this.fieldPreset);
      this.showFieldState();
    });

    this.showWaveModeHint();
    this.showGraphState();
    this.showFieldState();
  }

  private toggleField() {
    if (this.field.isRunning) {
      this.field.stop();
      this.status("The audio field is off.");
    } else {
      this.field.start(this.fieldPreset);
      if (this.field.isRunning)
        this.status("The audio field is drawing behind the graph.");
    }
    this.showFieldState();
  }

  private showFieldState() {
    this.find<HTMLButtonElement>("field-toggle").textContent = this.field
      .isRunning
      ? "Hide audio field"
      : "Show audio field";
    this.find<HTMLElement>("field-hint").textContent = presetById(
      this.fieldPreset
    ).description;
  }

  /**
   * Says what `W_audio(x)` currently means.
   *
   * The three modes are genuinely different objects and the panel has to say
   * so. A representative sinusoid at the dominant frequency is not the recent
   * waveform, and neither of them is the sound.
   */
  private showWaveModeHint() {
    const hints: Record<WaveFunctionMode, string> = {
      representative:
        "A single sine at the dominant frequency. Useful for wavelength and pitch, and not the shape of the sound.",
      recent:
        "Interpolated through the most recent samples. This is the real waveform, redrawn a few times a second.",
      additive: `A sum of the strongest ${MAX_COMPONENTS} components. An approximation for Fourier work, not a copy of the track.`,
    };
    this.find<HTMLElement>("wave-mode-hint").textContent = hints[this.waveMode];
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

  private async signIn() {
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

  private async signOut() {
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

  private setSignedIn(name?: string) {
    const signedIn = name !== undefined;
    this.find<HTMLElement>("account").textContent = signedIn
      ? `Signed in as ${name}`
      : "Not signed in";
    this.find<HTMLButtonElement>("sign-in").hidden = signedIn;
    this.find<HTMLButtonElement>("sign-out").hidden = !signedIn;
    this.find<HTMLButtonElement>("spotify-load").disabled = !signedIn;
    if (!signedIn) this.showPlayback({ active: false });
  }

  private async runPlaybackCommand(
    action: "pause" | "resume" | "next" | "previous"
  ) {
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

  private async refreshPlayback() {
    if (!this.find<HTMLButtonElement>("sign-in").hidden) return;
    try {
      const playback = (await this.spotifyRequest(
        "playback-state"
      )) as SpotifyPlayback;
      this.showPlayback(playback);
    } catch {
      // A transient status poll should not replace a useful user-facing message.
    }
  }

  private showPlayback(playback: SpotifyPlayback) {
    this.spotifyPlaying = playback.isPlaying ?? false;
    this.find<HTMLElement>("track").textContent = playback.active
      ? (playback.track ?? "Unknown track")
      : "No active Spotify player";
    this.find<HTMLElement>("artist").textContent = playback.active
      ? [playback.artist, playback.device].filter(Boolean).join(" · ")
      : "Open Spotify and play anything once.";
    this.find<HTMLElement>("playback-time").textContent = `${this.formatTime(
      (playback.progressMs ?? 0) / 1000
    )} / ${this.formatTime((playback.durationMs ?? 0) / 1000)}`;
    const toggle = this.find<HTMLButtonElement>("spotify-toggle");
    toggle.textContent = this.spotifyPlaying ? "Pause" : "Play";
    for (const name of ["spotify-toggle", "previous", "next"])
      this.find<HTMLButtonElement>(name).disabled = !playback.active;
  }

  private formatTime(seconds: number) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const whole = Math.floor(seconds);
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
  }

  private async analyzeTab() {
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
      this.find<HTMLButtonElement>("analyze").textContent = "Stop tab analysis";
      this.status("Live waveform and spectrum analysis is active.");
    } catch (error) {
      this.status(
        error instanceof Error ? error.message : "Tab analysis was cancelled.",
        true
      );
    }
  }

  private stopTabAnalysis() {
    const { capture } = this;
    this.capture = undefined;
    capture?.getTracks().forEach((track) => track.stop());
    if (this.sourceMode === "capture") {
      this.source?.disconnect();
      this.source = undefined;
      this.sourceMode = undefined;
    }
    this.find<HTMLButtonElement>("analyze").textContent = "Analyze tab audio";
    this.status("Tab analysis stopped.");
  }

  private loadFile(file?: File) {
    if (!file?.type.startsWith("audio/")) {
      this.status("Choose a supported audio file.", true);
      return;
    }
    if (this.objectUrl !== undefined) URL.revokeObjectURL(this.objectUrl);
    this.stopTabAnalysis();
    this.objectUrl = URL.createObjectURL(file);
    this.audio.src = this.objectUrl;
    this.find<HTMLButtonElement>("play").disabled = false;
    this.engine.reset();
    this.find<HTMLElement>("filename").textContent = file.name;
    this.status("Audio ready.");
  }

  private setupContext() {
    this.context ??= new AudioContext();
    if (this.context.state === "suspended") void this.context.resume();
    if (this.analyser === undefined) {
      this.analyser = this.context.createAnalyser();
      this.configureAnalyser();
    }
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
  }

  private configureAnalyser() {
    if (this.analyser === undefined) return;
    this.analyser.fftSize = QUALITY[this.quality].fftSize;
    this.analyser.smoothingTimeConstant = 0.72;
    this.timeData = new Float32Array(this.analyser.fftSize);
    this.frequencyData = new Float32Array(this.analyser.frequencyBinCount);
  }

  /**
   * One animation frame: measure once, then let each output take what it needs
   * on its own schedule.
   *
   * The panel's own canvases and the analysis run at the quality preset's rate.
   * The graph adapter is called every one of those frames and decides for
   * itself how many to act on — twelve a second for scalars, eight for lists —
   * which is what keeps the expression list from becoming a video renderer.
   */
  private readonly draw = (timestamp: number) => {
    this.frame = requestAnimationFrame(this.draw);
    if (
      this.analyser === undefined ||
      timestamp - this.lastFrame < QUALITY[this.quality].interval
    )
      return;
    const elapsed =
      this.lastFrame === 0 ? 0 : (timestamp - this.lastFrame) / 1000;
    this.lastFrame = timestamp;

    this.analyser.getFloatTimeDomainData(this.timeData);
    this.analyser.getFloatFrequencyData(this.frequencyData);
    const rate = this.context?.sampleRate ?? 0;
    const frame = this.engine.update(
      this.timeData,
      this.frequencyData,
      rate,
      this.analyser.fftSize,
      elapsed
    );

    this.drawWaveform();
    this.drawSpectrum();
    this.showMetrics(frame);

    if (!this.graph.isInstalled) return;
    // Only the additive mode reads the components, and finding them means a
    // pass over every bin. There is no reason to pay for it in the other two.
    this.components =
      this.waveMode === "additive"
        ? strongestComponents(
            this.engine.spectrum as Float32Array,
            rate,
            this.analyser.fftSize,
            MAX_COMPONENTS
          )
        : [];
    this.graph.update(
      frame,
      downsample(this.timeData, WAVEFORM_POINTS),
      spectrumPoints(
        this.engine.spectrum as Float32Array,
        rate,
        this.analyser.fftSize,
        SPECTRUM_POINTS
      ),
      this.components,
      timestamp
    );
  };

  /**
   * The readouts beside the canvases.
   *
   * A frequency the analyser is not confident about shows as an em dash rather
   * than as a number: a polyphonic frame does not have "a" frequency, and
   * printing the loudest bin anyway is how a readout becomes a lie.
   */
  private showMetrics(frame: ReturnType<AudioAnalysisEngine["update"]>) {
    const confident =
      Number.isFinite(frame.dominantHz) && frame.confidence > 0.2;
    this.find<HTMLElement>("peak").textContent = confident
      ? `${Math.round(frame.dominantHz)} Hz`
      : "—";
    this.find<HTMLElement>("wavelength").textContent = confident
      ? `${frame.wavelength.toFixed(2)} m`
      : "—";
    this.find<HTMLElement>("confidence").textContent = confident
      ? `${Math.round(frame.confidence * 100)}%`
      : "—";
    this.find<HTMLElement>("rms").textContent = frame.rms.toFixed(3);
    this.find<HTMLElement>("bands").textContent = `${Math.round(
      frame.bass * 100
    )} / ${Math.round(frame.mid * 100)} / ${Math.round(frame.treble * 100)}`;
  }

  private prepareCanvas(canvas: HTMLCanvasElement) {
    const ratio = Math.min(devicePixelRatio, 2);
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width * ratio));
    const height = Math.max(1, Math.round(rect.height * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const context = canvas.getContext("2d")!;
    context.clearRect(0, 0, width, height);
    return { context, width, height };
  }

  private drawWaveform() {
    const { context, width, height } = this.prepareCanvas(this.wave);
    context.strokeStyle = "#2d70b3";
    context.lineWidth = Math.max(1, devicePixelRatio);
    context.beginPath();
    for (let i = 0; i < this.timeData.length; i++) {
      const x = (i / (this.timeData.length - 1)) * width;
      const y = (0.5 - this.timeData[i] * 0.45) * height;
      if (i === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.stroke();
  }

  private drawSpectrum() {
    const { context, width, height } = this.prepareCanvas(this.spectrum);
    const values = downsample(this.frequencyData, 128);
    context.fillStyle = "#2d70b3";
    values.forEach((value, index) => {
      const normalized = Math.max(0, Math.min(1, (value + 100) / 100));
      const barWidth = width / values.length;
      context.fillRect(
        index * barWidth,
        height * (1 - normalized),
        Math.max(1, barWidth - 1),
        height * normalized
      );
    });
  }

  /**
   * Creates the managed folder, or stops writing to it.
   *
   * Stopping leaves the expressions in place. They are the user's graph content
   * now — they may have written their own work against `A_audio` — so taking
   * them away is a separate, explicit button.
   */
  private toggleGraph() {
    if (this.graph.isInstalled) {
      this.graph.stop();
      this.showGraphState();
      this.status(
        "The Audio Lab variables are still in your graph; they have stopped updating."
      );
      return;
    }
    try {
      this.graph.install({
        mode: this.waveMode,
        speedOfSound: this.speedOfSound,
      });
      this.showGraphState();
      this.status("The Audio Lab folder is live in the expression list.");
    } catch (error) {
      this.status(
        error instanceof Error
          ? error.message
          : "The Audio Lab folder could not be created.",
        true
      );
    }
  }

  private removeGraph() {
    this.graph.remove();
    this.showGraphState();
    this.status("Removed the Audio Lab folder. Nothing else was touched.");
  }

  private showGraphState() {
    const live = this.graph.isInstalled;
    this.find<HTMLButtonElement>("graph-toggle").textContent = live
      ? "Stop updating the graph"
      : "Start live graph";
    this.find<HTMLButtonElement>("graph-remove").disabled = !this.graph.exists;
  }

  private status(message: string, error = false) {
    const status = this.find<HTMLElement>("status");
    status.textContent = message;
    status.classList.toggle("dsm-audio-lab-error", error);
  }
}
