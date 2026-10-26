import { Grapher3d } from "#globals";
import { PluginController } from "../PluginController";

type ExtendedGrapher3d = Grapher3d & {
  controls: {
    isLocked(): boolean;
    state: number;
    lastWheelEventTime: number;
    updateViewport(param: any): any;
  };
  startZoom(): any;
  getZoomScrollWheelPickResult(): {
    point: { x: number; y: number; z: number };
  };
  getProjection(): {
    viewport: {
      xmin: number;
      xmax: number;
      ymin: number;
      ymax: number;
      zmin: number;
      zmax: number;
    };
  };
};

export default class BetterZooming extends PluginController {
  static id = "better-zooming" as const;
  static enabledByDefault = false;

  installSpringZoom(options: SpringZoomOptions = {}) {
    const {
      wheelRate = Math.log(1.1) / 100,
      scrollRate = 0.005,
      pinchRate = 0.01,
      maxTrackpadDelta = 100,
      frequency = 50,
      dampingRatio = 1.1,
    } = options;

    /* calc controller has setGrapher2d so maybe
		 it could be replaced???
		 probably don't need to make this a func but
		 no real reason not to */
    /** the grapher that's showing: 3d in Calculator3D, 2d otherwise */
    const grapher = () => {
      const g3 = this.cc.grapher3d;
      if (g3) return { is3d: true, g: g3 } as const;
      const g2 = this.cc.getGrapher();
      if (g2) return { is3d: false, g: g2 } as const;
    };

    const graphPaper = () => {
      const active = grapher();
      return active?.is3d
        ? document.querySelector(".dcg-grapher.dcg-grapher-3d")
        : document.querySelector(".dcg-grapher.dcg-grapher-2d");
    };

    /** pixel pos relative to graphpaper if its over it, otherwise undefined */
    const graphPoint = (e: {
      clientX: number;
      clientY: number;
      target: EventTarget | null;
    }) => {
      const elt = graphPaper();
      if (!elt || !(e.target instanceof Node) || !elt.contains(e.target))
        return;
      const rect = elt.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    /** scale about pixel by factor (>1 zoom in <1 zoom out)
     * 	returns false if a zoom limit or lock stopped it */
    const zoomAt = (point: { x: number; y: number }, factor: number) => {
      const active = grapher();
      if (!active) return false;
      return active.is3d
        ? zoom3d(
            active.g as unknown as Parameters<typeof zoom3d>[0], // this might be frowned upon here but the types I need are not defined on this
            factor
          )
        : zoom2d(
            active.g as unknown as Parameters<typeof zoom2d>[0], // this might be frowned upon here but the types I need are not defined on this
            point,
            factor
          );
    };

    const zoom2d = (
      g: {
        scaleAxis: string;
        debounceUserRequestedViewportChange(): any;
        viewportController: {
          getTransformedViewport(transform: any): any;
          tooBig(param: any): boolean;
          tooSmall(param: any): boolean;
          transformViewport(transform: any): any;
          isViewportLocked(): boolean;
          getProjection(): {
            mathToPixels: {
              mapPoint(point: { x: number; y: number }): {
                x: number;
                y: number;
              };
            };
          };
        };
      },
      point: { x: number; y: number },
      factor: number
    ) => {
      const vc = g.viewportController;
      if (vc.isViewportLocked()) return false;

      // zooming in near the origin snaps zoom point to origin
      const origin = vc.getProjection().mathToPixels.mapPoint({ x: 0, y: 0 });
      if (
        factor > 1 &&
        Math.abs(point.x - origin.x) < 50 &&
        Math.abs(point.y - origin.y) < 50
      )
        point = origin;

      // allowing zooming just one axis
      const sx = g.scaleAxis === "y" ? 1 : factor;
      const sy = g.scaleAxis === "x" ? 1 : factor;
      const transform = {
        mapRect: (r: {
          left: number;
          right: number;
          top: number;
          bottom: number;
        }) => ({
          left: point.x + (r.left - point.x) * sx,
          right: point.x + (r.right - point.x) * sx,
          top: point.y + (r.top - point.y) * sy,
          bottom: point.y + (r.bottom - point.y) * sy,
        }),
      };
      const next = vc.getTransformedViewport(transform);
      if (factor < 1 ? vc.tooBig(next) : vc.tooSmall(next)) return false;
      vc.transformViewport(transform);
      g.debounceUserRequestedViewportChange();
      return true;
    };

    /* 3d zooms the box about a point in math space instead of a pixel.
     like desmos it's the point under the mouse when zooming in, otherwise the
     origin if it's in the box, otherwise the middle of the box (undefined).
     it's picked when a zoom starts or the mouse moves */
    let center3d: { x: number; y: number; z: number } | undefined;

    const pickCenter3d = (g: ExtendedGrapher3d, zoomIn: boolean) => {
      const hit = zoomIn ? g.getZoomScrollWheelPickResult()?.point : undefined;
      if (hit) return { x: hit.x, y: hit.y, z: hit.z };
      const v = g.getProjection().viewport;
      const hasOrigin =
        v.xmin <= 0 &&
        v.xmax >= 0 &&
        v.ymin <= 0 &&
        v.ymax >= 0 &&
        v.zmin! <= 0 &&
        v.zmax! >= 0;
      return hasOrigin ? { x: 0, y: 0, z: 0 } : undefined;
    };

    const zoom3d = (g: ExtendedGrapher3d, factor: number) => {
      const { controls } = g;
      // locked, or rotating with the mouse
      if (controls.isLocked() || controls.state !== -1) return false;
      const v = g.getProjection().viewport;
      // z is always set in 3d
      const axes = {
        x: [v.xmin, v.xmax],
        y: [v.ymin, v.ymax],
        z: [v.zmin!, v.zmax!],
      };
      const next = { xmin: 0, xmax: 0, ymin: 0, ymax: 0, zmin: 0, zmax: 0 };
      for (const axis of ["x", "y", "z"] as const) {
        const [min, max] = axes[axis];
        const c = center3d?.[axis] ?? (min + max) / 2;
        const lo = c + (min - c) / factor;
        const hi = c + (max - c) / factor;
        // desmos' 3d limits, setCurrentViewport would clamp instead
        const width = hi - lo;
        if (
          width < 1.34e-4 * Math.max(1, Math.abs(lo), Math.abs(hi)) ||
          width > 134000
        )
          return false;
        if (Math.abs(lo) > 67000 || Math.abs(hi) > 67000) return false;
        next[`${axis}min`] = lo;
        next[`${axis}max`] = hi;
      }
      // like desmos' wheel handler: pauses the evaluator if disableWorkerOnZoom is set, until 100ms after the last zoom
      if (controls.lastWheelEventTime === 0) g.startZoom();
      controls.lastWheelEventTime = performance.now();
      controls.updateViewport(next);
      this.cc.dispatch({ type: "render" });
      return true;
    };

    // spring
    let position = 0;
    let velocity = 0;
    let target = 0;
    let anchor: { x: number; y: number } = { x: 0, y: 0 };
    let frame = 0;
    let lastTime = 0;

    const step = (time: number) => {
      // integrate in 1ms steps so its stable at any fps
      const dt = Math.max(0, Math.min(time - lastTime, 50)) / 1000;
      lastTime = time;
      const before = position;
      for (let t = 0; t < dt; t += 0.001) {
        const h = Math.min(0.001, dt - t);
        const accel =
          frequency * frequency * (target - position) -
          2 * dampingRatio * frequency * velocity;
        velocity += accel * h;
        position += velocity * h;
      }
      const atRest =
        Math.abs(target - position) < 1e-4 && Math.abs(velocity) < 1e-3;
      if (atRest) position = target;

      // if zoom limit was reached just stop
      const blocked =
        position !== before && !zoomAt(anchor, Math.exp(position - before));
      // dt can be 0 on the first frame (its timestamp can be earlier than the event
      // that started it), so stopping cant with just velocity
      if (atRest || blocked) {
        position = target = velocity = 0;
        frame = 0;
      } else {
        frame = requestAnimationFrame(step);
      }
    };

    const moveTarget = (point: { x: number; y: number }, logZoom: number) => {
      const active = grapher();
      if (
        active?.is3d &&
        (!frame || point.x !== anchor.x || point.y !== anchor.y)
      ) {
        center3d = pickCenter3d(
          active.g as unknown as ExtendedGrapher3d,
          logZoom > 0
        );
      }
      target += logZoom;
      anchor = point;
      if (!frame) {
        lastTime = performance.now();
        frame = requestAnimationFrame(step);
      }
    };

    const pixels = (e: WheelEvent, delta: number) =>
      e.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? delta * 16
        : e.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? delta * (graphPaper()?.clientHeight ?? 800)
          : delta;

    /* theres no flag for mouse vs trackpad so a wheel 
	   notch is a whole number of at least 50px and
		 pinches and trackpad scrolls are mostly smaller
		 or fractional or move both axes. a trackpad scroll can
		 still start with a notch-like event, so a gesture becomes
		 trackpad as soon as any event looks like one and stays that
		 way until the events stop for 150ms */
    let gestureIsTrackpad = false;
    let lastWheelTime = 0;

    const looksLikeTrackpad = (e: WheelEvent) => {
      if (e.deltaMode !== WheelEvent.DOM_DELTA_PIXEL) return false;
      if (e.deltaX !== 0) return true;
      if (!Number.isInteger(e.deltaY) || Math.abs(e.deltaY) < 50) return true;
      // macOS trackpads can send large whole deltas, but with wheelDeltaY = -3 * deltaY (a wheel's is -1.2 * deltaY)
      const legacy = (e as WheelEvent & { wheelDeltaY?: number }).wheelDeltaY;
      return legacy === -3 * e.deltaY;
    };

    const onWheel = (e: WheelEvent) => {
      const point = graphPoint(e);
      if (!point) return;
      // take the event from desmos' handler on the graphpaper
      e.stopPropagation();
      e.preventDefault();
      if (e.timeStamp - lastWheelTime > 150) gestureIsTrackpad = false;
      gestureIsTrackpad ||= looksLikeTrackpad(e);
      lastWheelTime = e.timeStamp;

      let d = pixels(e, e.deltaY || e.deltaX);
      // fix for super fast scroll
      if (gestureIsTrackpad)
        d = Math.max(-maxTrackpadDelta, Math.min(maxTrackpadDelta, d));
      /* when you pinch chrome and firefox send it as a wheel event with ctrlKey: true
       ctrl+mouse wheel zooms like the normal wheel */
      const rate = !gestureIsTrackpad
        ? wheelRate
        : e.ctrlKey
          ? pinchRate
          : scrollRate;
      moveTarget(point, -d * rate);
    };

    // safari sends pinches as GestureEvent with a cumulative scale
    // theoretically this should work but i dont have a mac to test it
    let lastScale = 1;
    const onGestureStart = (e: Event) => {
      if (!graphPoint(e as GestureEvent)) return;
      e.preventDefault();
      lastScale = 1;
    };
    const onGestureChange = (e: Event) => {
      const ge = e as GestureEvent;
      const point = graphPoint(ge);
      if (!point) return;
      e.preventDefault();
      moveTarget(point, Math.log(ge.scale / lastScale));
      lastScale = ge.scale;
    };

    // capture on the calculators root element, runs before desmos' listeners on the graphpaper
    const container = document.querySelector(".dcg-dom-change-wrapper")!;
    container.addEventListener("wheel", onWheel as EventListener, {
      capture: true,
      passive: false,
    });
    container.addEventListener("gesturestart", onGestureStart, {
      capture: true,
      passive: false,
    });
    container.addEventListener("gesturechange", onGestureChange, {
      capture: true,
      passive: false,
    });

    return () => {
      cancelAnimationFrame(frame);
      container.removeEventListener("wheel", onWheel as EventListener, {
        capture: true,
      });
      container.removeEventListener("gesturestart", onGestureStart, {
        capture: true,
      });
      container.removeEventListener("gesturechange", onGestureChange, {
        capture: true,
      });
    };
  }

  uninstall: (() => void) | undefined;
  afterEnable() {
    this.uninstall = this.installSpringZoom();
  }

  afterDisable() {
    if (this.uninstall) this.uninstall();
  }
}

interface SpringZoomOptions {
  /** ln(zoom) per pixel of mouse wheel delta. default zooms 10% per 100px so it's usually 10% per wheel notch */
  wheelRate?: number;
  /** ln(zoom) per pixel of trackpad scroll which is handled differently so the sensitivity isn't weird */
  scrollRate?: number;
  /** ln(zoom) per pixel of pinch zoom, 0.01 matches chrome pinch events */
  pinchRate?: number;
  /** biggest delta a single trackpad event can have (fix for super fast scrolling) */
  maxTrackpadDelta?: number;
  /** natural frequency of the spring (radians / second), increase this to make spring snappier (follows target faster) */
  frequency?: number;
  /** 1 is critically damped and above 1 is overdamped, you probably dont want it to be underdamped bc it will bounce */
  dampingRatio?: number;
}

/** safari pinch events, need to define bc it's not standard */
interface GestureEvent extends UIEvent {
  scale: number;
  clientX: number;
  clientY: number;
}
