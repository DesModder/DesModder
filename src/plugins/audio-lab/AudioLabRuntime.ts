/**
 * Binds the panel's DOM to the session, and nothing else.
 *
 * This object lives exactly as long as the panel is open. It owns no audio, no
 * WebGL, and no expression — every control here asks the session to do
 * something, and every readout here is drawn from what the session reports.
 * Closing the panel destroys this and leaves all of that running.
 *
 * The consequence worth stating: there is no state in this file. On attach it
 * reads the session and renders whatever it finds, which is what makes
 * reopening the panel mid-song show the truth rather than a set of defaults.
 */
import type AudioLab from ".";
import type AudioLabSession from "./AudioLabSession";
import {
  QUALITY,
  type Quality,
  type SessionView,
  type SpotifyPlayback,
} from "./AudioLabSession";
import { downsample } from "./dsp";
import type { AudioFeatureFrame } from "./audio/features";
import { MAX_COMPONENTS, type WaveFunctionMode } from "./desmos/manifest";
import { PRESETS, presetById, type PresetId } from "./fieldplay/presets";

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

export default class AudioLabRuntime implements SessionView {
  private readonly session: AudioLabSession;
  private readonly wave: HTMLCanvasElement;
  private readonly spectrum: HTMLCanvasElement;

  constructor(
    private readonly plugin: AudioLab,
    private readonly root: HTMLElement
  ) {
    this.session = plugin.session;
    this.hydrateCanvases();
    this.wave = this.find<HTMLCanvasElement>("wave");
    this.spectrum = this.find<HTMLCanvasElement>("spectrum");
    this.bind();
    this.session.attach(this);
  }

  destroy() {
    // Detach, not stop. The capture, the field, and the graph updates were
    // turned on deliberately and are switched off the same way.
    this.session.detach();
  }

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

  private find<T extends Element>(name: string) {
    const element = this.root.querySelector<T>(`[data-audio-lab="${name}"]`);
    if (element === null) throw new Error(`Missing Audio Lab element: ${name}`);
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

  private bind() {
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

    const quality = this.on<HTMLSelectElement>(
      "quality",
      "change",
      (element) => {
        this.session.setQuality(element.value as Quality);
      }
    );
    quality.value = this.session.quality;
    // Built from the registry rather than written out in the panel, so adding
    // a quality level cannot leave the picker one option short.
    if (!(this.session.quality in QUALITY)) quality.selectedIndex = 0;

    this.on("graph-toggle", "click", () => this.session.toggleGraph());
    this.on("graph-remove", "click", () => this.session.removeGraph());

    const mode = this.on<HTMLSelectElement>(
      "wave-mode",
      "change",
      (element) => {
        this.session.setWaveMode(element.value as WaveFunctionMode);
      }
    );
    mode.value = this.session.waveMode;

    const speed = this.on<HTMLInputElement>("speed", "change", (element) => {
      // A rejected value is put back rather than left showing something the
      // session did not accept.
      if (!this.session.setSpeedOfSound(Number(element.value)))
        element.value = String(this.session.speedOfSound);
    });
    speed.value = String(this.session.speedOfSound);

    this.on("field-toggle", "click", () => this.session.toggleField());
    const preset = this.find<HTMLSelectElement>("field-preset");
    // Built from the registry, so adding a preset cannot leave the picker one
    // option short of the presets.
    preset.replaceChildren(
      ...PRESETS.map((item) => {
        const option = document.createElement("option");
        option.value = item.id;
        option.textContent = item.name;
        return option;
      })
    );
    preset.value = this.session.fieldPreset;
    preset.addEventListener("change", () => {
      this.session.setFieldPreset(preset.value as PresetId);
    });
  }

  // ------------------------------------------------------------ SessionView

  onStateChange() {
    this.find<HTMLButtonElement>("analyze").textContent = this.session
      .isCapturing
      ? "Stop tab analysis"
      : "Analyze tab audio";
    this.find<HTMLButtonElement>("graph-toggle").textContent = this.session
      .isGraphLive
      ? "Stop updating the graph"
      : "Start live graph";
    this.find<HTMLButtonElement>("graph-remove").disabled =
      !this.session.graphExists;
    this.find<HTMLButtonElement>("field-toggle").textContent = this.session
      .isFieldRunning
      ? "Hide audio field"
      : "Show audio field";
    this.find<HTMLElement>("field-hint").textContent = presetById(
      this.session.fieldPreset
    ).description;
    this.find<HTMLElement>("wave-mode-hint").textContent =
      WAVE_MODE_HINTS[this.session.waveMode];
    this.find<HTMLButtonElement>("play").disabled = !this.session.hasFile;
    this.find<HTMLElement>("filename").textContent =
      this.session.currentFileName;
  }

  onStatus(message: string, error: boolean) {
    const status = this.find<HTMLElement>("status");
    status.textContent = message;
    status.classList.toggle("dsm-audio-lab-error", error);
  }

  onAccount(name?: string) {
    const signedIn = name !== undefined;
    this.find<HTMLElement>("account").textContent = signedIn
      ? `Signed in as ${name}`
      : "Not signed in";
    this.find<HTMLButtonElement>("sign-in").hidden = signedIn;
    this.find<HTMLButtonElement>("sign-out").hidden = !signedIn;
    this.find<HTMLButtonElement>("spotify-load").disabled = !signedIn;
  }

  onPlayback(playback: SpotifyPlayback) {
    this.find<HTMLElement>("track").textContent = playback.active
      ? (playback.track ?? "Unknown track")
      : "No active Spotify player";
    this.find<HTMLElement>("artist").textContent = playback.active
      ? [playback.artist, playback.device].filter(Boolean).join(" · ")
      : "Open Spotify and play anything once.";
    this.find<HTMLElement>("playback-time").textContent = `${formatTime(
      (playback.progressMs ?? 0) / 1000
    )} / ${formatTime((playback.durationMs ?? 0) / 1000)}`;
    this.find<HTMLButtonElement>("spotify-toggle").textContent = this.session
      .isSpotifyPlaying
      ? "Pause"
      : "Play";
    for (const name of ["spotify-toggle", "previous", "next"])
      this.find<HTMLButtonElement>(name).disabled = !playback.active;
  }

  onFrame(frame: AudioFeatureFrame) {
    this.drawWaveform();
    this.drawSpectrum();
    this.showMetrics(frame);
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
    const samples = this.session.waveform;
    if (samples.length === 0) return;
    const { context, width, height } = this.prepareCanvas(this.wave);
    context.strokeStyle = "#2d70b3";
    context.lineWidth = Math.max(1, devicePixelRatio);
    context.beginPath();
    for (let i = 0; i < samples.length; i++) {
      const x = (i / (samples.length - 1)) * width;
      const y = (0.5 - samples[i] * 0.45) * height;
      if (i === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.stroke();
  }

  private drawSpectrum() {
    const bins = this.session.spectrum;
    if (bins.length === 0) return;
    const { context, width, height } = this.prepareCanvas(this.spectrum);
    const values = downsample(bins as Float32Array, 128);
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
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}
