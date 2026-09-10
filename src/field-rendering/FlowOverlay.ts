/**
 * Owns the canvas that the flow visualizer draws into, and keeps it registered
 * with the Desmos graph paper underneath it.
 *
 * The canvas is inserted immediately after Desmos's own graph canvas, so
 * Desmos's label and interaction layers still sit on top, and it never accepts
 * pointer events — panning, zooming, and clicking expressions behave exactly as
 * they do without the overlay.
 */
import {
  DEFAULT_FLOW_OPTIONS,
  FlowRenderer,
  FlowRendererError,
  type FlowBounds,
  type FlowField,
  type FlowOptions,
} from "./FlowRenderer";
import type { Calc } from "#globals";

const CANVAS_ID = "dsm-vector-tools-flow-canvas";
const GRAPH_CANVAS_SELECTOR = "canvas.dcg-graph-inner";
const BOUNDS_OBSERVER_KEY = "graphpaperBounds.dsm-vector-tools";

export interface FlowOverlayCallbacks {
  onError: (message: string) => void;
  /** The overlay is drawing again after having reported a failure. */
  onRecovered: () => void;
}

export class FlowOverlay {
  private canvas?: HTMLCanvasElement;
  private renderer?: FlowRenderer;
  private animationFrame?: number;
  private resizeObserver?: ResizeObserver;
  private visibilityObserver?: IntersectionObserver;
  private unobserveBounds?: () => void;
  private options: FlowOptions = { ...DEFAULT_FLOW_OPTIONS };
  private lastBounds?: FlowBounds;
  /** Whether any of the canvas is on screen. Off screen, frames are skipped. */
  private onScreen = true;
  /**
   * The field the renderer was last given, kept because a lost WebGL context
   * takes the renderer with it and the restored one has to be handed the same
   * field back. Particles are reseeded either way — there is nothing in a lost
   * context to carry over.
   */
  private lastField?: FlowField;
  /** Kept so a remount after a lost context comes back with the same values. */
  private lastParameters: ReadonlyMap<string, number> = new Map();
  private lastTime = 0;
  /**
   * Whether to invert this canvas to cancel the graph's reverse contrast.
   *
   * Desmos inverts an ancestor of this canvas, so the field inverts with it
   * unless it is inverted a second time here. Kept so a remount after a lost
   * context comes back looking the same.
   */
  private counteractInvert = false;
  private contextLost = false;
  private readonly onContextLost = (event: Event) => {
    // Without this the browser never restores the context at all.
    event.preventDefault();
    this.contextLost = true;
    if (this.animationFrame !== undefined) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = undefined;
    }
    this.renderer = undefined;
    this.callbacks.onError(
      "The browser took the graphics context away from the flow. It will come back on its own."
    );
  };
  private readonly onContextRestored = () => {
    this.contextLost = false;
    const { canvas } = this;
    if (canvas === undefined || this.lastField === undefined) return;
    try {
      this.renderer = new FlowRenderer(canvas);
      this.renderer.setOptions(this.options);
      this.renderer.setField(this.lastField);
      this.resizeToBox();
      this.lastBounds = undefined;
      this.syncBounds(true);
      this.callbacks.onRecovered();
      this.scheduleFrame();
    } catch (error) {
      this.stop();
      this.callbacks.onError(
        error instanceof FlowRendererError
          ? error.message
          : "The flow visualizer could not restart after the graphics context came back."
      );
    }
  };

  constructor(
    private readonly calc: Calc,
    private readonly callbacks: FlowOverlayCallbacks
  ) {}

  /**
   * Whether the overlay is mounted — which is the canvas, not the renderer. A
   * lost context leaves a mounted overlay drawing nothing for a moment, and
   * calling that "stopped" would have the button offer to start something that
   * is already on its way back.
   */
  get isRunning() {
    return this.canvas !== undefined;
  }

  /**
   * Starts the overlay, or swaps the field if it is already running. Reports
   * failures through `onError` instead of throwing, because every caller is a
   * UI event handler.
   */
  start(field: FlowField, options: FlowOptions) {
    this.options = { ...options };
    this.lastField = field;
    try {
      // A remount while the context is lost is the manual way back: the browser
      // may never restore one it took, and a fresh canvas gets a fresh context.
      if (this.contextLost) this.stop();
      if (this.renderer === undefined) this.mount();
      this.renderer!.setOptions(this.options);
      this.renderer!.setField(field);
      this.renderer!.setParameters(this.lastParameters);
      this.renderer!.setTime(this.lastTime);
      this.applyContrast();
      this.syncBounds(true);
      this.scheduleFrame();
    } catch (error) {
      this.stop();
      this.callbacks.onError(
        error instanceof FlowRendererError
          ? error.message
          : "The flow visualizer could not start."
      );
    }
  }

  setOptions(options: FlowOptions) {
    const scaleChanged = options.renderScale !== this.options.renderScale;
    this.options = { ...options };
    this.renderer?.setOptions(this.options);
    // Render scale is the one option that changes the size of the drawing
    // buffer, and nothing else will notice on its own — no element resized.
    if (scaleChanged) this.resizeToBox();
  }

  /**
   * The values behind the names the field reads.
   *
   * Kept off `start` because these move whenever a slider does, and the flow is
   * already redrawing every frame — it only needs the new number, not a new
   * pair of programs.
   */
  setParameters(values: ReadonlyMap<string, number>) {
    this.lastParameters = values;
    this.renderer?.setParameters(values);
  }

  /** Cancels, or stops cancelling, the graph's reverse contrast. */
  setCounteractInvert(counteract: boolean) {
    if (this.counteractInvert === counteract) return;
    this.counteractInvert = counteract;
    this.applyContrast();
  }

  private applyContrast() {
    const canvas = document.getElementById(CANVAS_ID);
    if (canvas === null) return;
    canvas.style.filter = this.counteractInvert ? "invert(1)" : "";
  }

  /** The flow is already redrawing every frame; this only changes what it reads. */
  setTime(seconds: number) {
    this.lastTime = seconds;
    this.renderer?.setTime(seconds);
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
    this.onScreen = true;
    this.unobserveBounds?.();
    this.unobserveBounds = undefined;
    this.renderer?.destroy();
    this.renderer = undefined;
    this.canvas?.removeEventListener("webglcontextlost", this.onContextLost);
    this.canvas?.removeEventListener(
      "webglcontextrestored",
      this.onContextRestored
    );
    this.contextLost = false;
    this.canvas?.remove();
    this.canvas = undefined;
    this.lastBounds = undefined;
  }

  private mount() {
    const graphCanvas = document.querySelector(GRAPH_CANVAS_SELECTOR);
    const parent = graphCanvas?.parentElement;
    if (graphCanvas == null || parent == null) {
      throw new FlowRendererError(
        "Could not find the Desmos graph paper to draw on."
      );
    }
    document.getElementById(CANVAS_ID)?.remove();

    const canvas = document.createElement("canvas");
    canvas.id = CANVAS_ID;
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

    this.renderer = new FlowRenderer(canvas);
    this.resizeToBox();

    this.resizeObserver = new ResizeObserver(() => this.resizeToBox());
    this.resizeObserver.observe(parent);

    // requestAnimationFrame already stops for a hidden tab, but not for a graph
    // that has been scrolled out of view in an article or a notebook, which is
    // a whole GPU's worth of work nobody can see.
    this.visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        this.onScreen = entry?.isIntersecting ?? true;
      },
      { threshold: 0 }
    );
    this.visibilityObserver.observe(canvas);

    // Desmos reports pan/zoom through this observable; the trail texture is in
    // screen space, so it has to be dropped whenever the mapping changes. The
    // key is namespaced so unobserving cannot detach another plugin's handler.
    this.calc.observe(BOUNDS_OBSERVER_KEY, () => this.syncBounds(false));
    this.unobserveBounds = () => this.calc.unobserve(BOUNDS_OBSERVER_KEY);
  }

  private resizeToBox() {
    if (this.canvas === undefined || this.renderer === undefined) return;
    const rect = this.canvas.getBoundingClientRect();
    const changed = this.renderer.resize(
      rect.width,
      rect.height,
      (window.devicePixelRatio || 1) * this.options.renderScale
    );
    if (changed) this.renderer.clearTrails();
  }

  private syncBounds(force: boolean) {
    if (this.renderer === undefined) return;
    const math = this.calc.graphpaperBounds.mathCoordinates;
    const bounds: FlowBounds = {
      xMin: math.left,
      xMax: math.right,
      yMin: math.bottom,
      yMax: math.top,
    };
    if (
      !force &&
      this.lastBounds !== undefined &&
      boundsAreEqual(this.lastBounds, bounds)
    ) {
      return;
    }
    this.lastBounds = bounds;
    // A forced sync is a fresh start, where there is nothing worth carrying
    // over. Every other one is a pan or zoom, and the trails move with it.
    if (force) this.renderer.resetBounds(bounds);
    else this.renderer.setBounds(bounds);
  }

  private scheduleFrame() {
    if (this.animationFrame !== undefined) return;
    const step = () => {
      this.animationFrame = undefined;
      if (this.renderer === undefined || this.renderer.isContextLost) return;
      try {
        if (this.onScreen) this.renderer.frame();
      } catch (error) {
        // A context lost mid-frame is not a failure to report and tear down;
        // its own handler has already said so and is waiting for it back.
        if (this.contextLost) return;
        const message =
          error instanceof Error
            ? error.message
            : "The flow visualizer stopped.";
        this.stop();
        this.callbacks.onError(message);
        return;
      }
      this.animationFrame = requestAnimationFrame(step);
    };
    this.animationFrame = requestAnimationFrame(step);
  }
}

function boundsAreEqual(a: FlowBounds, b: FlowBounds) {
  return (
    a.xMin === b.xMin &&
    a.xMax === b.xMax &&
    a.yMin === b.yMin &&
    a.yMax === b.yMax
  );
}
