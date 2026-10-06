/**
 * Owns a canvas laid exactly over the Desmos 3D graph, and redraws whatever is
 * on it in step with the frames Desmos draws.
 *
 * The 3D counterpart of `ArrowOverlay`, and different from it in the two ways
 * the probe of the real page established (`docs/VECTOR_TOOLS_3D_BUILD_PLAN.md`
 * §1):
 *
 * - **Where the canvas goes.** Desmos 3D draws on its own WebGL canvas,
 *   `grapher3d.webglCanvas`, an absolutely positioned later sibling of the 2D
 *   graph canvas, and it paints over anything placed beside the 2D one — where
 *   the 2D overlays go. This canvas goes straight after the 3D one instead,
 *   and is placed from the two elements' rectangles: the 3D canvas's
 *   `offsetLeft`/`offsetTop` are measured from a different ancestor and put an
 *   overlay 400 px right and 377 px down of the picture.
 * - **When it draws.** Not on bounds changes, which mean nothing in 3D, but in
 *   Desmos's own `onRedraw3dResults`, once per redraw, from the camera in that
 *   call's argument. DesModder's `hookIntoFunction` runs before the original,
 *   while `grapher3d.redrawResult` still holds the previous frame, so the
 *   camera is read from the argument and never from the grapher. Drawn in the
 *   same task as Desmos's paint, the two land in the same displayed frame:
 *   measured 0.28 px median, 0.49 px at the 90th percentile, through a
 *   continuous rotation.
 *
 * What is drawn is the renderer's business. One overlay serves arrows,
 * streamlines and the glow cloud alike, so a page never holds more than one
 * WebGL context of ours on top of Desmos's own.
 */
import {
  cameraFromRedrawResult,
  readCamera3D,
  type Camera3D,
} from "./camera3d";
import { FlowRendererError } from "./FlowRenderer";
import type { Calc, Grapher3d } from "#globals";
import { hookIntoFunction } from "#utils/listenerHelpers.ts";

/** The 3D box, in math coordinates. */
export interface Box3D {
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
}

/** What draws on the overlay. */
export interface Overlay3DRenderer {
  /** Draws one frame for the camera Desmos drew with, over this box. */
  draw: (camera: Camera3D, box: Box3D, timeSeconds: number) => void;
  /** The canvas's CSS size and the device pixel ratio. */
  resize: (width: number, height: number, pixelRatio: number) => void;
  destroy: () => void;
  readonly isContextLost: boolean;
  /**
   * Whether the picture changes with time on its own — animated streamlines —
   * and so needs frames between Desmos's redraws. Read every frame.
   */
  readonly animating: boolean;
}

export interface Overlay3DCallbacks {
  onError: (message: string) => void;
  /** The overlay is drawing again after having reported a failure. */
  onRecovered: () => void;
  /** Overrides the canvas id, for a second overlay on the same page. */
  canvasId?: string;
  /**
   * Where this canvas sits among the other 3D overlays, all of which go
   * straight after Desmos's canvas: lower is nearer Desmos, so drawn under.
   * The flow is 1 and the arrows 2, as in 2D, where arrows are read over the
   * particles; without an order, whichever mounted last would decide.
   */
  order?: number;
}

const DEFAULT_CANVAS_ID = "dsm-vector-tools-3d-canvas";
const WEBGL_CANVAS_SELECTOR = "canvas.dcg-webgl-canvas";

export class Overlay3D {
  private canvas?: HTMLCanvasElement;
  private renderer?: Overlay3DRenderer;
  private unhook?: () => void;
  private frame?: number;
  private resizeObserver?: ResizeObserver;
  /** The camera of the last frame Desmos drew, for redraws between its own. */
  private camera?: Camera3D;
  private contextLost = false;
  private readonly startedAt = performance.now();
  /** Redraws seen since mounting; for tests and the panel's diagnostics. */
  redraws = 0;

  private readonly onContextLost = (event: Event) => {
    // Without this the browser never restores the context at all.
    event.preventDefault();
    this.contextLost = true;
    this.cancelFrame();
    this.renderer = undefined;
    this.callbacks.onError(
      "The browser took the graphics context away from the 3D field. It will come back on its own."
    );
  };

  private readonly onContextRestored = () => {
    this.contextLost = false;
    if (this.canvas === undefined) return;
    try {
      this.renderer = this.createRenderer(this.canvas);
      this.resizeToGraph();
      this.callbacks.onRecovered();
      this.requestFrame();
    } catch (error) {
      this.stop();
      this.callbacks.onError(messageOf(error));
    }
  };

  /**
   * @param createRenderer builds the renderer on a canvas: once on start, and
   * again when the browser restores a lost context, which takes the old
   * renderer and everything it had uploaded with it. The caller owns what the
   * renderer draws, so it is the one that can rebuild it.
   */
  constructor(
    private readonly calc: Calc,
    private readonly callbacks: Overlay3DCallbacks,
    private readonly createRenderer: (
      canvas: HTMLCanvasElement
    ) => Overlay3DRenderer
  ) {}

  private get canvasId() {
    return this.callbacks.canvasId ?? DEFAULT_CANVAS_ID;
  }

  private get grapher(): Grapher3d | undefined {
    return this.calc.controller.grapher3d;
  }

  /** Mounted, which is the canvas, not the renderer; see `ArrowOverlay`. */
  get isRunning() {
    return this.canvas !== undefined;
  }

  get canvasElement() {
    return this.canvas;
  }

  /** Mounts the overlay if it is not, and draws. */
  start() {
    try {
      if (this.contextLost) this.stop();
      if (this.canvas === undefined) this.mount();
      this.requestFrame();
    } catch (error) {
      this.stop();
      this.callbacks.onError(messageOf(error));
    }
  }

  /**
   * Draws again with the last camera: for a change of field or setting, which
   * Desmos does not redraw for.
   */
  requestFrame() {
    if (this.frame !== undefined || this.renderer === undefined) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = undefined;
      this.draw(this.camera ?? readCamera3D(this.grapher));
    });
  }

  stop() {
    this.cancelFrame();
    this.unhook?.();
    this.unhook = undefined;
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    this.renderer?.destroy();
    this.renderer = undefined;
    this.canvas?.removeEventListener("webglcontextlost", this.onContextLost);
    this.canvas?.removeEventListener(
      "webglcontextrestored",
      this.onContextRestored
    );
    this.canvas?.remove();
    this.canvas = undefined;
    this.camera = undefined;
    this.contextLost = false;
  }

  private mount() {
    const { grapher } = this;
    const graphCanvas = webglCanvasOf(grapher);
    if (grapher === undefined || graphCanvas?.parentElement == null) {
      throw new FlowRendererError(
        "Could not find the Desmos 3D graph to draw on."
      );
    }
    document.getElementById(this.canvasId)?.remove();
    const canvas = document.createElement("canvas");
    canvas.id = this.canvasId;
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.position = "absolute";
    canvas.style.pointerEvents = "none";
    this.canvas = canvas;
    this.placeCanvas();
    canvas.addEventListener("webglcontextlost", this.onContextLost);
    canvas.addEventListener("webglcontextrestored", this.onContextRestored);
    this.renderer = this.createRenderer(canvas);
    this.resizeToGraph();

    const unhook = hookIntoFunction(
      grapher,
      "onRedraw3dResults",
      `${this.canvasId}-redraw`,
      0,
      (_stop, result: unknown) => {
        this.redraws++;
        const camera = cameraFromRedrawResult(result);
        if (camera === undefined) return;
        this.camera = camera;
        // Now, not on the next animation frame: this task is the one in which
        // Desmos paints the same redraw, and drawing here puts both pictures
        // in the same displayed frame.
        this.cancelFrame();
        this.draw(camera);
      }
    );
    this.unhook = unhook ?? undefined;

    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => {
        this.placeCanvas();
        this.resizeToGraph();
        this.requestFrame();
      });
      this.resizeObserver.observe(graphCanvas);
    }
  }

  /**
   * Puts the canvas straight after Desmos's 3D canvas, covering it exactly.
   * Idempotent, and re-run on resize, because Desmos may rebuild its canvas.
   */
  private placeCanvas() {
    const { canvas } = this;
    const graphCanvas = webglCanvasOf(this.grapher);
    const parent = graphCanvas?.parentElement;
    if (canvas === undefined || graphCanvas == null || parent == null) return;
    // After Desmos's canvas and after any of ours that sit lower.
    const order = this.callbacks.order ?? 0;
    canvas.dataset.dsmOverlayOrder = String(order);
    let after: Element = graphCanvas;
    for (
      let next = graphCanvas.nextElementSibling;
      next !== null &&
      next !== canvas &&
      next instanceof HTMLCanvasElement &&
      next.dataset.dsmOverlayOrder !== undefined &&
      Number(next.dataset.dsmOverlayOrder) <= order;
      next = next.nextElementSibling
    ) {
      after = next;
    }
    if (
      canvas.parentElement !== parent ||
      canvas.previousElementSibling !== after
    ) {
      parent.insertBefore(canvas, after.nextSibling);
    }
    const at = graphCanvas.getBoundingClientRect();
    const origin = parent.getBoundingClientRect();
    canvas.style.left = `${at.left - origin.left}px`;
    canvas.style.top = `${at.top - origin.top}px`;
    canvas.style.width = `${at.width}px`;
    canvas.style.height = `${at.height}px`;
  }

  private resizeToGraph() {
    const graphCanvas = webglCanvasOf(this.grapher);
    if (this.renderer === undefined || graphCanvas == null) return;
    const { width, height } = graphCanvas.getBoundingClientRect();
    this.renderer.resize(width, height, window.devicePixelRatio || 1);
  }

  private draw(camera: Camera3D | undefined) {
    const { renderer } = this;
    const box = boxOf(this.grapher);
    if (renderer === undefined || camera === undefined || box === undefined)
      return;
    if (renderer.isContextLost) return;
    try {
      renderer.draw(camera, box, (performance.now() - this.startedAt) / 1000);
      // An animated picture keeps itself going between Desmos's redraws.
      if (renderer.animating) this.requestFrame();
    } catch (error) {
      if (this.contextLost) return;
      this.stop();
      this.callbacks.onError(messageOf(error));
    }
  }

  private cancelFrame() {
    if (this.frame !== undefined) cancelAnimationFrame(this.frame);
    this.frame = undefined;
  }
}

function webglCanvasOf(grapher: Grapher3d | undefined) {
  return (
    grapher?.webglCanvas ??
    document.querySelector<HTMLCanvasElement>(WEBGL_CANVAS_SELECTOR) ??
    undefined
  );
}

/** The box Desmos is showing, or undefined if it is not a real one. */
export function boxOf(grapher: Grapher3d | undefined): Box3D | undefined {
  const v = grapher?.viewportController?.getViewport?.();
  if (v === undefined) return undefined;
  const min = [v.xmin, v.ymin, v.zmin] as const;
  const max = [v.xmax, v.ymax, v.zmax] as const;
  for (let i = 0; i < 3; i++) {
    if (!Number.isFinite(min[i]) || !Number.isFinite(max[i])) return undefined;
    if (!(max[i] > min[i])) return undefined;
  }
  return { min, max };
}

function messageOf(error: unknown) {
  return error instanceof FlowRendererError || error instanceof Error
    ? error.message
    : "The 3D field could not be drawn.";
}
