/**
 * The audio field: one configuration, one overlay, one frame at a time.
 *
 * This is where the two halves meet. The analysis engine publishes a frame
 * whenever it measures one; the shared flow overlay draws whenever the browser
 * offers a frame. Neither waits for the other, and this reads the latest
 * measurement on the *drawing* clock rather than pushing measurements at the
 * renderer — which is what lets the particles stay at sixty frames a second
 * while the analysis runs at whatever rate the response setting asks for.
 *
 * Nothing here allocates per frame. The parameter map, the ripple buffer and
 * the disturbance record are each built once and written in place, because the
 * one thing a loop running sixty times a second must not do is give the
 * collector a reason to run in the middle of a song.
 */
import { compileAudioField, flowOptionsFor } from "./compile";
import { PointerTracker } from "./PointerTracker";
import { RippleEmitter } from "./RippleEmitter";
import { readAudioVariables } from "./variables";
import type { AudioFieldConfig, PointerMode } from "./model";
import { FlowOverlay } from "../../../field-rendering/FlowOverlay";
import { NO_DISTURBANCES } from "../../../field-rendering/FlowRenderer";
import type {
  DisturbanceState,
  FlowBounds,
} from "../../../field-rendering/FlowRenderer";
import type { AudioFeatureFrame } from "../audio/features";
import type { Calc } from "#globals";

/** Audio Lab's own canvas and observer, distinct from Vector Tools'. */
const AUDIO_FIELD_IDENTITY = {
  canvasId: "dsm-audio-lab-field-canvas",
  boundsObserverKey: "graphpaperBounds.dsm-audio-lab",
};

export interface AudioFieldCallbacks {
  readonly onError: (message: string) => void;
  /** Drawing again after a failure was reported. */
  readonly onRecovered: () => void;
  /** The latest measurement, read once per drawn frame. */
  readonly getFrame: () => AudioFeatureFrame;
  /** Whether Desmos is currently drawing the graph in reverse contrast. */
  readonly reversesContrast: () => boolean;
}

/**
 * How a pointer mode becomes the two numbers the shader takes.
 *
 * Two functions rather than one returning a pair, because this runs once per
 * drawn frame and a returned object literal is an allocation per frame. The
 * modes are resolved here rather than in GLSL so the innermost loop of the
 * field carries no branch on a setting that changes at most when a chip is
 * clicked.
 */
export function pointerRadial(mode: PointerMode, strength: number) {
  switch (mode) {
    case "push":
      return strength;
    case "pull":
      return -strength;
    // A little inward pull alongside the rotation, or particles orbit at a
    // fixed radius and the cursor reads as a hole rather than as a whirlpool.
    case "swirl":
      return -strength * 0.25;
    default:
      return 0;
  }
}

export function pointerSwirl(mode: PointerMode, strength: number) {
  return mode === "swirl" ? strength : 0;
}

export class AudioFieldController {
  private readonly overlay: FlowOverlay;
  private readonly ripples = new RippleEmitter();
  private readonly pointer: PointerTracker;
  /** Reused every frame; see the note at the top of the file. */
  private readonly parameters = new Map<string, number>();
  private readonly disturbances: DisturbanceState = {
    ...NO_DISTURBANCES,
    ripples: this.ripplesBuffer(),
  };
  private config?: AudioFieldConfig;
  private running = false;
  /**
   * The clock ripples are dated against.
   *
   * Wall time rather than analysis time, and the same clock the shader's
   * `u_time` gets, so a ring keeps expanding and fading after the music has
   * stopped instead of freezing part-way out.
   */
  private readonly startedAt = performance.now();

  constructor(
    private readonly calc: Calc,
    private readonly callbacks: AudioFieldCallbacks
  ) {
    this.overlay = new FlowOverlay(
      calc,
      {
        onError: callbacks.onError,
        onRecovered: callbacks.onRecovered,
        beforeFrame: () => this.publishFrame(),
      },
      AUDIO_FIELD_IDENTITY
    );
    this.pointer = new PointerTracker(calc, {
      onTap: (x, y) => this.tap(x, y),
    });
  }

  private ripplesBuffer() {
    return this.ripples.packed;
  }

  get isRunning() {
    return this.overlay.isRunning;
  }

  /**
   * Starts the field, or re-applies a changed configuration to a running one.
   *
   * Returns the compilation error rather than throwing, because every caller is
   * a control in the panel and an expression that does not compile is an
   * ordinary thing for someone editing one to type.
   */
  start(config: AudioFieldConfig): string | undefined {
    const compiled = compileAudioField(config);
    if (!compiled.ok)
      return `${compiled.which} could not be read. ${compiled.error}`;
    this.config = config;
    // A field switched on after a spell away would otherwise show every ripple
    // it was holding, all of them suddenly minutes old.
    if (!this.running) this.ripples.clear();
    this.running = true;
    this.overlay.start(compiled.field, flowOptionsFor(config));
    if (!this.overlay.isRunning) {
      this.running = false;
      return undefined;
    }
    if (config.pointer.mode !== "off" || config.pointer.clickRipples)
      this.pointer.start();
    else this.pointer.stop();
    return undefined;
  }

  stop() {
    this.running = false;
    this.pointer.stop();
    this.overlay.stop();
    this.ripples.clear();
  }

  /**
   * Drops one ripple in the middle of the view.
   *
   * There so that the ripple controls can be adjusted against a ring you asked
   * for, rather than by waiting for the music to produce one — which on a quiet
   * passage means adjusting a slider blind.
   */
  dropRippleAtCentre() {
    const { config } = this;
    if (config === undefined) return;
    const view = this.viewBounds();
    this.ripples.emit(
      (view.xMin + view.xMax) / 2,
      (view.yMin + view.yMax) / 2,
      config.ripples.strength === 0 ? 3 : config.ripples.strength,
      this.clock()
    );
  }

  /** A click on the graph, when click-to-ripple is on. */
  private tap(x: number, y: number) {
    const { config } = this;
    if (!config?.pointer.clickRipples) return;
    // Full strength regardless of the music: a ripple you asked for by hand
    // should not be quiet because the track happens to be.
    this.ripples.emit(
      x,
      y,
      config.ripples.strength === 0 ? 3 : config.ripples.strength,
      this.clock()
    );
  }

  private clock() {
    return (performance.now() - this.startedAt) / 1000;
  }

  /**
   * One drawn frame's worth of audio, run immediately before the renderer draws.
   *
   * Everything here is a write into an object that already exists.
   */
  private publishFrame() {
    const { config } = this;
    if (config === undefined) return;
    const frame = this.callbacks.getFrame();
    const now = this.clock();

    readAudioVariables(this.parameters, frame);
    this.overlay.setParameters(this.parameters);
    this.overlay.setTime(now);
    // Reverse contrast is a graph setting changed from somewhere else entirely,
    // and nothing tells this plugin about it. Comparing a boolean once a frame
    // is cheaper than any arrangement that would, and `setCounteractInvert`
    // does nothing at all when the answer has not changed.
    this.overlay.setCounteractInvert(this.callbacks.reversesContrast());

    const view = this.viewBounds();
    this.ripples.pump(frame, config.ripples, view, now);

    const { disturbances } = this;
    disturbances.ripples = this.ripples.packed;
    disturbances.rippleSpeed = config.ripples.speed;
    disturbances.rippleWavelength = config.ripples.wavelength;
    disturbances.rippleLifetime = config.ripples.lifetime;

    const cursor = this.pointer.current;
    // A held button drags harder, which is what makes the cursor feel like it
    // is pushing the water rather than hovering over it.
    const reach = config.pointer.strength * (cursor.pressed ? 1.8 : 1);
    const mode = cursor.present ? config.pointer.mode : "off";
    disturbances.pointerX = cursor.x;
    disturbances.pointerY = cursor.y;
    disturbances.pointerRadial = pointerRadial(mode, reach);
    disturbances.pointerSwirl = pointerSwirl(mode, reach);
    disturbances.pointerRadius = config.pointer.radius;
    if (cursor.present) this.ripples.setPointer(cursor.x, cursor.y);
    else this.ripples.forgetPointer();

    this.overlay.setDisturbances(disturbances);
  }

  /** Written in place, for the same reason everything else here is. */
  private readonly view: FlowBounds = {
    xMin: -10,
    xMax: 10,
    yMin: -6,
    yMax: 6,
  };

  private viewBounds(): FlowBounds {
    const math = this.calc.graphpaperBounds.mathCoordinates;
    this.view.xMin = math.left;
    this.view.xMax = math.right;
    this.view.yMin = math.bottom;
    this.view.yMax = math.top;
    return this.view;
  }
}
