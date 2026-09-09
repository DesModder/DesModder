/**
 * Owns the canvas the audio field draws on, and keeps it lined up with the
 * graph paper underneath.
 *
 * The canvas goes immediately after Desmos's own graph canvas, so Desmos's
 * label and interaction layers stay on top of it, and it never takes pointer
 * events. Panning, zooming, the keypad, and clicking an expression all behave
 * exactly as they do with the field switched off — which is the specification's
 * requirement that no Audio Lab control overlap Desmos UI, met by not being a
 * control at all.
 */
import { AudioFieldError, AudioFieldRenderer } from "./AudioFieldRenderer";
import type { PresetId } from "./presets";
import type { AudioFeatureFrame } from "../audio/features";
import type { Calc } from "#globals";

const CANVAS_ID = "dsm-audio-lab-field-canvas";
const GRAPH_CANVAS_SELECTOR = "canvas.dcg-graph-inner";
/** Namespaced so unobserving cannot detach another plugin's handler. */
const BOUNDS_OBSERVER_KEY = "graphpaperBounds.dsm-audio-lab";

export interface AudioFieldCallbacks {
  readonly onError: (message: string) => void;
  readonly getFeatures: () => AudioFeatureFrame;
}

export class AudioFieldOverlay {
  private canvas?: HTMLCanvasElement;
  private renderer?: AudioFieldRenderer;
  private animationFrame?: number;
  private resizeObserver?: ResizeObserver;
  private visibilityObserver?: IntersectionObserver;
  private unobserveBounds?: () => void;
  private preset: PresetId = "pulse";
  private lastTimestamp = 0;
  private onScreen = true;
  private contextLost = false;
  /**
   * A rolling average of recent frame costs.
   *
   * Quality decisions are made against this rather than a single frame, because
   * one slow frame is usually the browser doing something else and dropping the
   * whole field for it would be visible and wrong.
   */
  private averageFrameMs = 0;

  private readonly onContextLost = (event: Event) => {
    // Without this the browser never offers the context back at all.
    event.preventDefault();
    this.contextLost = true;
    if (this.animationFrame !== undefined) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = undefined;
    }
    this.renderer?.destroy();
    this.renderer = undefined;
    this.callbacks.onError(
      "The browser took the graphics context away from the audio field. It will come back on its own."
    );
  };

  private readonly onContextRestored = () => {
    this.contextLost = false;
    if (this.canvas === undefined) return;
    try {
      this.renderer = new AudioFieldRenderer(this.canvas);
      this.renderer.setPreset(this.preset);
      this.syncBounds();
      this.resizeToBox();
      this.schedule();
    } catch (error) {
      this.stop();
      this.callbacks.onError(describe(error));
    }
  };

  constructor(
    private readonly calc: Calc,
    private readonly callbacks: AudioFieldCallbacks
  ) {}

  get isRunning() {
    return this.canvas !== undefined;
  }

  get activePreset() {
    return this.preset;
  }

  /** Starts the field, or switches preset if it is already running. */
  start(preset: PresetId) {
    this.preset = preset;
    try {
      // A remount is the manual way back from a lost context: the browser may
      // never restore one it took, and a fresh canvas gets a fresh context.
      if (this.contextLost) this.stop();
      if (this.renderer === undefined) this.mount();
      this.renderer!.setPreset(preset);
      this.syncBounds();
      this.resizeToBox();
      this.schedule();
    } catch (error) {
      this.stop();
      this.callbacks.onError(describe(error));
    }
  }

  stop() {
    if (this.animationFrame !== undefined) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = undefined;
    }
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    this.visibilityObserver?.disconnect();
    this.visibilityObserver = undefined;
    this.unobserveBounds?.();
    this.unobserveBounds = undefined;
    this.renderer?.destroy();
    this.renderer = undefined;
    this.canvas?.removeEventListener("webglcontextlost", this.onContextLost);
    this.canvas?.removeEventListener(
      "webglcontextrestored",
      this.onContextRestored
    );
    this.canvas?.remove();
    this.canvas = undefined;
    this.contextLost = false;
    this.onScreen = true;
    this.lastTimestamp = 0;
    this.averageFrameMs = 0;
  }

  private mount() {
    const graphCanvas = document.querySelector(GRAPH_CANVAS_SELECTOR);
    const parent = graphCanvas?.parentElement;
    if (graphCanvas == null || parent == null)
      throw new AudioFieldError(
        "Could not find the Desmos graph paper to draw the audio field on."
      );
    document.getElementById(CANVAS_ID)?.remove();

    const canvas = document.createElement("canvas");
    canvas.id = CANVAS_ID;
    // Nothing here is content, and a screen reader announcing a particle field
    // would be noise where the graph's own description should be.
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.position = "absolute";
    canvas.style.left = "0";
    canvas.style.top = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.pointerEvents = "none";
    parent.insertBefore(canvas, graphCanvas.nextSibling);
    canvas.addEventListener("webglcontextlost", this.onContextLost);
    canvas.addEventListener("webglcontextrestored", this.onContextRestored);
    this.canvas = canvas;
    this.renderer = new AudioFieldRenderer(canvas);

    this.resizeObserver = new ResizeObserver(() => this.resizeToBox());
    this.resizeObserver.observe(parent);

    // requestAnimationFrame already stops for a hidden tab, but not for a graph
    // scrolled out of view in an article — a whole GPU's worth of work nobody
    // can see.
    this.visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        this.onScreen = entry?.isIntersecting ?? true;
      },
      { threshold: 0 }
    );
    this.visibilityObserver.observe(canvas);

    // Pan and zoom move the coordinate mapping, which is a uniform. No buffer
    // is rebuilt and no program is recompiled for either.
    this.calc.observe(BOUNDS_OBSERVER_KEY, () => this.syncBounds());
    this.unobserveBounds = () => this.calc.unobserve(BOUNDS_OBSERVER_KEY);
  }

  private syncBounds() {
    const math = this.calc.graphpaperBounds.mathCoordinates;
    this.renderer?.setBounds({
      xMin: math.left,
      xMax: math.right,
      yMin: math.bottom,
      yMax: math.top,
    });
  }

  private resizeToBox() {
    if (this.canvas === undefined || this.renderer === undefined) return;
    const rect = this.canvas.getBoundingClientRect();
    this.renderer.resize(rect.width, rect.height, window.devicePixelRatio || 1);
  }

  private schedule() {
    if (this.animationFrame !== undefined) return;
    const step = (timestamp: number) => {
      this.animationFrame = undefined;
      const { renderer } = this;
      if (renderer === undefined || renderer.isContextLost) return;

      const delta =
        this.lastTimestamp === 0 ? 0 : (timestamp - this.lastTimestamp) / 1000;
      this.lastTimestamp = timestamp;

      if (this.onScreen) {
        const started = performance.now();
        try {
          renderer.frame(this.callbacks.getFeatures(), delta);
        } catch (error) {
          // A context lost mid-frame is not a failure to report; its own
          // handler has already said so and is waiting for it back.
          if (this.contextLost) return;
          this.stop();
          this.callbacks.onError(describe(error));
          return;
        }
        const cost = performance.now() - started;
        this.averageFrameMs =
          this.averageFrameMs === 0
            ? cost
            : this.averageFrameMs * 0.9 + cost * 0.1;
        if (renderer.recordFrameTime(this.averageFrameMs)) {
          this.resizeToBox();
          // The new level is a guess; let it prove itself before judging again.
          this.averageFrameMs = 0;
        }
      }
      this.animationFrame = requestAnimationFrame(step);
    };
    this.animationFrame = requestAnimationFrame(step);
  }
}

function describe(error: unknown) {
  return error instanceof AudioFieldError
    ? error.message
    : error instanceof Error
      ? error.message
      : "The audio field stopped.";
}
