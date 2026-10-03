/**
 * Owns the canvas the live arrows are drawn on, and keeps it over the graph.
 *
 * A sibling of `FlowOverlay` rather than part of it. They want opposite things
 * from a frame: the flow advects particles sixty times a second and needs its
 * previous frame to fade from, while the arrows are a still picture that only
 * has to be redrawn when the view, the field or a setting changes. Sharing one
 * renderer would mean the arrows paying an animation loop's costs to sit still.
 *
 * Its own canvas, and so its own WebGL context, for the same reason: the two
 * are independently switchable, and neither should have to exist for the other
 * to work.
 */
import { FlowRendererError } from "./FlowRenderer";
import type { FlowBounds, FlowField } from "./FlowRenderer";
import { ArrowRenderer, type ArrowOptions } from "./ArrowRenderer";
import type { OverlayLayer } from "./types";
import type { Calc } from "#globals";

/**
 * The default canvas id, which is the one Vector Tools has always used.
 *
 * It is a default rather than a constant because two plugins now draw through
 * this overlay, and an id is unique to a document: two overlays mounted under
 * one id would each remove the other's canvas on start, and the second to draw
 * would silently erase the first. Anything mounting a second overlay passes its
 * own id.
 */
const DEFAULT_CANVAS_ID = "dsm-vector-tools-arrow-canvas";
const GRAPH_CANVAS_SELECTOR = "canvas.dcg-graph-inner";

export interface ArrowOverlayCallbacks {
  onError: (message: string) => void;
  /** The overlay is drawing again after having reported a failure. */
  onRecovered: () => void;
  /** Overrides the canvas id, for a second overlay on the same page. */
  canvasId?: string;
}

export class ArrowOverlay {
  private canvas?: HTMLCanvasElement;
  private renderer?: ArrowRenderer;
  private frame?: number;
  private resizeObserver?: ResizeObserver;
  private visibilityObserver?: IntersectionObserver;
  private unobserveBounds?: () => void;
  private onScreen = true;
  /**
   * The field and settings the renderer was last given.
   *
   * Kept because a lost WebGL context takes the renderer with it, and the
   * restored one has to be given the same field back — the overlay is the only
   * thing that still knows what was being drawn.
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
  /**
   * Which side of Desmos's graph canvas this one is drawn on.
   *
   * Kept rather than read back from the DOM because a remount after a lost
   * context has to put the canvas back where it was.
   */
  private layer: OverlayLayer = "over";
  private lastOptions?: ArrowOptions;
  private contextLost = false;
  private readonly onContextLost = (event: Event) => {
    // Without this the browser never restores the context at all.
    event.preventDefault();
    this.contextLost = true;
    if (this.frame !== undefined) cancelAnimationFrame(this.frame);
    this.frame = undefined;
    this.renderer = undefined;
    this.callbacks.onError(
      "The browser took the graphics context away from the arrows. They will come back on their own."
    );
  };
  private readonly onContextRestored = () => {
    this.contextLost = false;
    const { canvas } = this;
    if (canvas === undefined || this.lastField === undefined) return;
    try {
      this.renderer = new ArrowRenderer(canvas);
      if (this.lastOptions !== undefined)
        this.renderer.setOptions(this.lastOptions);
      this.renderer.setField(this.lastField);
      this.resizeToBox();
      this.callbacks.onRecovered();
      this.requestFrame();
    } catch (error) {
      this.stop();
      this.callbacks.onError(
        error instanceof FlowRendererError
          ? error.message
          : "The arrows could not be drawn again after the graphics context came back."
      );
    }
  };

  constructor(
    private readonly calc: Calc,
    private readonly callbacks: ArrowOverlayCallbacks
  ) {}

  private get canvasId() {
    return this.callbacks.canvasId ?? DEFAULT_CANVAS_ID;
  }

  /**
   * Keyed off the canvas id for the same reason: Desmos holds one observer per
   * key, so two overlays sharing a key would leave one of them never told that
   * the view moved.
   */
  private get boundsObserverKey() {
    return `graphpaperBounds.${this.canvasId}`;
  }

  /**
   * Whether the overlay is mounted — which is the canvas, not the renderer. A
   * lost context leaves a mounted overlay drawing nothing for a moment, and
   * calling that "stopped" would have the panel offer to start something that
   * is already on its way back.
   */
  get isRunning() {
    return this.canvas !== undefined;
  }

  get arrowCount() {
    return this.renderer?.arrowCount ?? 0;
  }

  /** What the last frame drew into, and what the canvas expected. */
  get drawnViewport() {
    if (this.renderer === undefined || this.canvas === undefined)
      return undefined;
    return {
      drawn: this.renderer.lastViewport,
      canvas: { width: this.canvas.width, height: this.canvas.height },
    };
  }

  /** Starts the overlay, or swaps the field and settings if already running. */
  start(field: FlowField, options: ArrowOptions) {
    this.lastField = field;
    this.lastOptions = options;
    try {
      // A remount while the context is lost is the manual way back: the browser
      // may never restore one it took, and a fresh canvas gets a fresh context.
      if (this.contextLost) this.stop();
      if (this.renderer === undefined) this.mount();
      this.renderer!.setOptions(options);
      this.renderer!.setField(field);
      this.renderer!.setParameters(this.lastParameters);
      this.renderer!.setTime(this.lastTime);
      this.applyContrast();
      this.requestFrame();
    } catch (error) {
      this.stop();
      this.callbacks.onError(
        error instanceof FlowRendererError
          ? error.message
          : "The arrows could not be drawn."
      );
    }
  }

  setOptions(options: ArrowOptions) {
    this.lastOptions = options;
    if (this.renderer === undefined) return;
    this.renderer.setOptions(options);
    this.requestFrame();
  }

  /**
   * The values behind the names the field reads.
   *
   * Kept off `start` because these move whenever a slider does, and the arrows
   * only have to redraw for that — not relink.
   */
  setParameters(values: ReadonlyMap<string, number>) {
    this.lastParameters = values;
    if (this.renderer === undefined) return;
    this.renderer.setParameters(values);
    this.requestFrame();
  }

  /**
   * Moves the canvas above or below Desmos's graph.
   *
   * A DOM move rather than a remount, so the WebGL context and the arrows
   * already on screen survive it.
   */
  setLayer(layer: OverlayLayer) {
    this.layer = layer;
    this.placeCanvas();
  }

  /**
   * Puts the canvas on the side of the graph canvas that `layer` asks for.
   *
   * The arrows take the *top* of whichever stack they are in — last child when
   * they are over the graph, immediately before the graph canvas when they are
   * under it — which is what keeps them readable over the flow's particles on
   * both sides. `FlowOverlay` takes the bottom of the same two stacks.
   *
   * Idempotent and re-run on every sync, because the two overlays mount
   * independently: whichever mounted second would otherwise decide the order.
   */
  private placeCanvas() {
    const { canvas } = this;
    if (canvas === undefined) return;
    const graphCanvas = document.querySelector(GRAPH_CANVAS_SELECTOR);
    const parent = graphCanvas?.parentElement;
    if (graphCanvas == null || parent == null) return;
    const reference = this.layer === "under" ? graphCanvas : null;
    // The parent check is not redundant: a canvas that has just been created
    // has no parent and a null `nextSibling`, which is exactly what "already
    // last child" looks like. Without it a fresh overlay in `over` mode is
    // never inserted at all, and draws into a canvas nobody can see.
    if (canvas.parentElement === parent && canvas.nextSibling === reference)
      return;
    parent.insertBefore(canvas, reference);
  }

  /** Cancels, or stops cancelling, the graph's reverse contrast. */
  setCounteractInvert(counteract: boolean) {
    if (this.counteractInvert === counteract) return;
    this.counteractInvert = counteract;
    this.applyContrast();
  }

  private applyContrast() {
    const canvas = document.getElementById(this.canvasId);
    if (canvas === null) return;
    canvas.style.filter = this.counteractInvert ? "invert(1)" : "";
  }

  /** Advances the clock and redraws. A still picture only while nothing reads it. */
  setTime(seconds: number) {
    this.lastTime = seconds;
    if (this.renderer === undefined) return;
    this.renderer.setTime(seconds);
    this.requestFrame();
  }

  stop() {
    if (this.frame !== undefined) cancelAnimationFrame(this.frame);
    this.frame = undefined;
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
  }

  private mount() {
    const graphCanvas = document.querySelector(GRAPH_CANVAS_SELECTOR);
    const parent = graphCanvas?.parentElement;
    if (graphCanvas == null || parent == null) {
      throw new FlowRendererError(
        "Could not find the Desmos graph paper to draw on."
      );
    }
    document.getElementById(this.canvasId)?.remove();

    const canvas = document.createElement("canvas");
    canvas.id = this.canvasId;
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.position = "absolute";
    canvas.style.left = "0";
    canvas.style.top = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.pointerEvents = "none";
    this.canvas = canvas;
    this.placeCanvas();
    canvas.addEventListener("webglcontextlost", this.onContextLost);
    canvas.addEventListener("webglcontextrestored", this.onContextRestored);
    this.renderer = new ArrowRenderer(canvas);
    this.resizeToBox();

    this.resizeObserver = new ResizeObserver(() => {
      this.resizeToBox();
      this.requestFrame();
    });
    this.resizeObserver.observe(parent);

    this.visibilityObserver = new IntersectionObserver(
      (entries) => {
        // The last entry, not the first: moving the canvas in the DOM (as
        // placing another overlay's canvas does) queues "out of view" and
        // then "in view" in one batch, and reading the first left the arrows
        // believing they were hidden, drawing nothing, for good.
        const entry = entries[entries.length - 1];
        const wasOffScreen = !this.onScreen;
        this.onScreen = entry?.isIntersecting ?? true;
        // Coming back into view means the canvas may have been resized while
        // nothing was drawing it, so it needs the frame it skipped.
        if (wasOffScreen && this.onScreen) this.requestFrame();
      },
      { threshold: 0 }
    );
    this.visibilityObserver.observe(canvas);

    const key = this.boundsObserverKey;
    this.calc.observe(key, () => this.requestFrame());
    this.unobserveBounds = () => this.calc.unobserve(key);
  }

  private resizeToBox() {
    if (this.canvas === undefined || this.renderer === undefined) return;
    const rect = this.canvas.getBoundingClientRect();
    this.renderer.resize(rect.width, rect.height, window.devicePixelRatio || 1);
  }

  private syncBounds() {
    if (this.renderer === undefined) return;
    const math = this.calc.graphpaperBounds.mathCoordinates;
    const bounds: FlowBounds = {
      xMin: math.left,
      xMax: math.right,
      yMin: math.bottom,
      yMax: math.top,
    };
    this.renderer.setBounds(bounds);
  }

  /**
   * Draws once on the next frame.
   *
   * Arrows do not animate, so this coalesces a burst of changes — a drag across
   * the graph paper reports bounds on every pointermove — into one redraw
   * rather than starting a loop that would keep running once the drag stopped.
   */
  private requestFrame() {
    if (this.frame !== undefined || this.renderer === undefined) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = undefined;
      if (this.renderer === undefined || !this.onScreen) return;
      if (this.renderer.isContextLost) return;
      try {
        this.resizeToBox();
        // Read the bounds now rather than trusting what the observer last
        // reported. Desmos adjusts what it was asked for to keep the pixels
        // square, and the corrected value does not always arrive as another
        // observation — so a cached copy can be a view the graph never had,
        // which draws the field offset from the paper under it.
        this.syncBounds();
        this.renderer.frame();
      } catch (error) {
        // A context lost mid-frame is not a failure to report and tear down;
        // its own handler has already said so and is waiting for it back.
        if (this.contextLost) return;
        const message =
          error instanceof Error ? error.message : "The arrows stopped.";
        this.stop();
        this.callbacks.onError(message);
      }
    });
  }
}
