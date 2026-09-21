/**
 * Where the cursor is on the graph, in graph coordinates.
 *
 * Every listener here is passive and none of them calls `preventDefault` or
 * `stopPropagation`. That is not politeness, it is the whole constraint: Desmos
 * owns panning, zooming, selecting an expression and dragging a point on this
 * same element, and a field that watched the pointer by intercepting its events
 * would break all four. This only ever reads.
 *
 * Coordinates are converted through the calculator's own reported bounds rather
 * than through a conversion of our own, so the cursor lines up with the field
 * at any pan or zoom without this having to track either.
 */
import type { Calc } from "#globals";

const GRAPH_CONTAINER_SELECTOR = ".dcg-graph-outer";

export interface PointerSample {
  /** Graph coordinates. */
  x: number;
  y: number;
  /** Whether the cursor is over the graph at all. */
  present: boolean;
  /** Whether a button is held, which is what a drag means here. */
  pressed: boolean;
}

export interface PointerTrackerCallbacks {
  /** A press that was not part of a drag, in graph coordinates. */
  onTap?: (x: number, y: number) => void;
}

/** Pixels of travel that stop a press from counting as a tap. */
const TAP_SLOP = 6;

export class PointerTracker {
  private element?: HTMLElement;
  /**
   * The graph's box on screen, cached.
   *
   * `getBoundingClientRect` forces the browser to settle layout before it can
   * answer, and a pointer moving across a 120 Hz display asks a great many
   * times a second. The box only changes when the window or the panel does, so
   * it is measured on those events instead and reused in between.
   */
  private box?: DOMRect;
  private resizeObserver?: ResizeObserver;
  private readonly remeasure = () => {
    this.box = this.element?.getBoundingClientRect();
  };
  private readonly sample: PointerSample = {
    x: 0,
    y: 0,
    present: false,
    pressed: false,
  };
  private pressX = 0;
  private pressY = 0;
  private moved = false;

  private readonly onMove = (event: PointerEvent) => {
    this.read(event);
    if (this.sample.pressed && !this.moved) {
      const travel = Math.hypot(
        event.clientX - this.pressX,
        event.clientY - this.pressY
      );
      if (travel > TAP_SLOP) this.moved = true;
    }
  };

  private readonly onDown = (event: PointerEvent) => {
    this.read(event);
    this.sample.pressed = true;
    this.pressX = event.clientX;
    this.pressY = event.clientY;
    this.moved = false;
  };

  private readonly onUp = (event: PointerEvent) => {
    this.read(event);
    const wasPressed = this.sample.pressed;
    this.sample.pressed = false;
    // A drag is how Desmos pans, and panning the graph is not a request to drop
    // a ripple where the gesture happened to end.
    if (wasPressed && !this.moved)
      this.callbacks.onTap?.(this.sample.x, this.sample.y);
  };

  private readonly onLeave = () => {
    this.sample.present = false;
    this.sample.pressed = false;
  };

  constructor(
    private readonly calc: Calc,
    private readonly callbacks: PointerTrackerCallbacks = {}
  ) {}

  /** The latest position. Read, do not keep — it is updated in place. */
  get current(): Readonly<PointerSample> {
    return this.sample;
  }

  start() {
    if (this.element !== undefined) return;
    const element = document.querySelector<HTMLElement>(
      GRAPH_CONTAINER_SELECTOR
    );
    if (element === null) return;
    this.element = element;
    // Passive, and on the container rather than on the canvas: the canvas the
    // field draws into takes no pointer events at all, by design.
    element.addEventListener("pointermove", this.onMove, { passive: true });
    element.addEventListener("pointerdown", this.onDown, { passive: true });
    element.addEventListener("pointerup", this.onUp, { passive: true });
    element.addEventListener("pointercancel", this.onLeave, { passive: true });
    element.addEventListener("pointerleave", this.onLeave, { passive: true });
    this.remeasure();
    this.resizeObserver = new ResizeObserver(this.remeasure);
    this.resizeObserver.observe(element);
    // A scroll moves the box without resizing it, and the graph may well be
    // inside a scrolling page rather than filling the window.
    window.addEventListener("scroll", this.remeasure, { passive: true });
    window.addEventListener("resize", this.remeasure, { passive: true });
  }

  stop() {
    const { element } = this;
    this.element = undefined;
    this.box = undefined;
    this.sample.present = false;
    this.sample.pressed = false;
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    window.removeEventListener("scroll", this.remeasure);
    window.removeEventListener("resize", this.remeasure);
    if (element === undefined) return;
    element.removeEventListener("pointermove", this.onMove);
    element.removeEventListener("pointerdown", this.onDown);
    element.removeEventListener("pointerup", this.onUp);
    element.removeEventListener("pointercancel", this.onLeave);
    element.removeEventListener("pointerleave", this.onLeave);
  }

  private read(event: PointerEvent) {
    if (this.element === undefined) return;
    const { box } = this;
    if (box === undefined || box.width <= 0 || box.height <= 0) return;
    const math = this.calc.graphpaperBounds.mathCoordinates;
    const across = (event.clientX - box.left) / box.width;
    // Screen y grows downward and graph y grows upward.
    const up = 1 - (event.clientY - box.top) / box.height;
    this.sample.x = math.left + (math.right - math.left) * across;
    this.sample.y = math.bottom + (math.top - math.bottom) * up;
    this.sample.present = across >= 0 && across <= 1 && up >= 0 && up <= 1;
  }
}
