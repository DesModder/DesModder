import { Overlay3D, boxOf, type Overlay3DRenderer } from "./Overlay3D";
import type { Calc } from "#globals";

/** A DOMRect, which jsdom does not provide. */
function rect(x: number, y: number, width: number, height: number) {
  const r: DOMRect = {
    x,
    y,
    left: x,
    top: y,
    width,
    height,
    right: x + width,
    bottom: y + height,
    toJSON: () => ({}),
  };
  return r;
}

/**
 * A stand-in for the part of Desmos 3D the overlay touches: the 3D canvas, a
 * later sibling of the 2D graph canvas inside `.dcg-grapher-3d`, and the
 * grapher's redraw hook and viewport. The shape is the one the probe of the
 * real page found, so a test here fails where the page would.
 */
function fakeDesmos3D() {
  const grapherDiv = document.createElement("div");
  grapherDiv.className = "dcg-grapher dcg-grapher-3d";
  const outer = document.createElement("div");
  outer.className = "dcg-graph-outer";
  const graph2d = document.createElement("canvas");
  graph2d.className = "dcg-graph-inner";
  outer.appendChild(graph2d);
  const webglCanvas = document.createElement("canvas");
  webglCanvas.className = "dcg-webgl-canvas";
  grapherDiv.append(outer, webglCanvas);
  document.body.appendChild(grapherDiv);
  // jsdom lays nothing out; give the two the rectangles the real page had.
  grapherDiv.getBoundingClientRect = () => rect(400, 46, 800, 754);
  webglCanvas.getBoundingClientRect = () => rect(400, 46, 800, 754);

  const painted: unknown[] = [];
  const grapher = {
    webglCanvas,
    redrawResult: undefined as unknown,
    viewportController: {
      getViewport: () => ({
        xmin: -5,
        xmax: 5,
        ymin: -2,
        ymax: 4,
        zmin: -1,
        zmax: 3,
      }),
    },
    onRedraw3dResults(result: unknown) {
      // What Desmos does with a redraw: keep it, and paint.
      this.redrawResult = result;
      painted.push(result);
    },
  };
  const calc = { controller: { grapher3d: grapher } } as unknown as Calc;
  return { calc, grapher, grapherDiv, webglCanvas, graph2d, painted };
}

const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function redrawResult(tag: number) {
  return {
    camera: {
      worldMatrixWorld: identity.map((v, i) => (i === 12 ? tag : v)),
      cameraMatrixWorldInverse: identity,
      cameraProjectionMatrix: identity,
      cameraType: "PerspectiveCamera",
    },
    screen: { width: 800, height: 754 },
  };
}

function recordingRenderer() {
  const draws: { tag: number; boxMin: readonly number[] }[] = [];
  const renderer: Overlay3DRenderer & { draws: typeof draws } = {
    draws,
    draw: (camera, box) =>
      draws.push({ tag: camera.world[12], boxMin: box.min }),
    resize: () => {},
    destroy: () => {},
    isContextLost: false,
    animating: false,
  };
  return renderer;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("Overlay3D", () => {
  test("mounts straight after Desmos's 3D canvas, covering it", () => {
    // Beside the 2D graph canvas, where the 2D overlays go, Desmos's 3D
    // canvas paints over it: the overlay would draw and never be seen.
    const page = fakeDesmos3D();
    const overlay = new Overlay3D(
      page.calc,
      { onError: fail, onRecovered: () => {} },
      recordingRenderer
    );
    overlay.start();
    const canvas = overlay.canvasElement!;
    expect(canvas.previousElementSibling).toBe(page.webglCanvas);
    expect(canvas.parentElement).toBe(page.grapherDiv);
    expect(canvas.style.pointerEvents).toBe("none");
    expect(canvas.getAttribute("aria-hidden")).toBe("true");
    // From the rectangles: the 3D canvas is at the grapher's own origin.
    expect([canvas.style.left, canvas.style.top]).toEqual(["0px", "0px"]);
    expect([canvas.style.width, canvas.style.height]).toEqual([
      "800px",
      "754px",
    ]);
    overlay.stop();
  });

  test("draws each redraw from its own camera, and Desmos still paints it", () => {
    const page = fakeDesmos3D();
    const renderer = recordingRenderer();
    const overlay = new Overlay3D(
      page.calc,
      { onError: fail, onRecovered: () => {} },
      () => renderer
    );
    overlay.start();
    page.grapher.redrawResult = redrawResult(1);
    page.grapher.onRedraw3dResults(redrawResult(2));
    // The argument's camera (2), not the one the grapher still holds (1):
    // the hook runs before Desmos stores the new frame.
    expect(renderer.draws.map((d) => d.tag)).toEqual([2]);
    expect(renderer.draws[0].boxMin).toEqual([-5, -2, -1]);
    expect(page.painted).toHaveLength(1);
    expect(overlay.redraws).toBe(1);
    overlay.stop();
  });

  test("a redraw without a camera paints but draws nothing", () => {
    const page = fakeDesmos3D();
    const renderer = recordingRenderer();
    const overlay = new Overlay3D(
      page.calc,
      { onError: fail, onRecovered: () => {} },
      () => renderer
    );
    overlay.start();
    page.grapher.onRedraw3dResults({ screen: { width: 1, height: 1 } });
    expect(renderer.draws).toHaveLength(0);
    expect(page.painted).toHaveLength(1);
    overlay.stop();
  });

  test("stopping removes the canvas and stops drawing, and Desmos goes on", () => {
    const page = fakeDesmos3D();
    const renderer = recordingRenderer();
    let destroyed = false;
    renderer.destroy = () => (destroyed = true);
    const overlay = new Overlay3D(
      page.calc,
      { onError: fail, onRecovered: () => {} },
      () => renderer
    );
    overlay.start();
    overlay.stop();
    page.grapher.onRedraw3dResults(redrawResult(3));
    expect(renderer.draws).toHaveLength(0);
    expect(page.painted).toHaveLength(1);
    expect(document.getElementById("dsm-vector-tools-3d-canvas")).toBeNull();
    expect(destroyed).toBe(true);
    expect(overlay.isRunning).toBe(false);
  });

  test("a renderer that throws is reported and the overlay stops", () => {
    const page = fakeDesmos3D();
    const renderer = recordingRenderer();
    renderer.draw = () => {
      throw new Error("shader exploded");
    };
    const errors: string[] = [];
    const overlay = new Overlay3D(
      page.calc,
      { onError: (m) => errors.push(m), onRecovered: () => {} },
      () => renderer
    );
    overlay.start();
    page.grapher.onRedraw3dResults(redrawResult(4));
    expect(errors).toEqual(["shader exploded"]);
    expect(overlay.isRunning).toBe(false);
    // Desmos's own redraw is never the casualty.
    expect(page.painted).toHaveLength(1);
  });

  test("without a 3D canvas it reports rather than drawing nowhere", () => {
    const calc = { controller: { grapher3d: undefined } } as unknown as Calc;
    const errors: string[] = [];
    const overlay = new Overlay3D(
      calc,
      { onError: (m) => errors.push(m), onRecovered: () => {} },
      recordingRenderer
    );
    overlay.start();
    expect(errors[0]).toContain("Desmos 3D graph");
    expect(overlay.isRunning).toBe(false);
  });
});

describe("boxOf", () => {
  test("reads the six numbers, and refuses a box that is not one", () => {
    const grapher = (v: object): Parameters<typeof boxOf>[0] => {
      const g: unknown = { viewportController: { getViewport: () => v } };
      return g as Parameters<typeof boxOf>[0];
    };
    expect(
      boxOf(
        grapher({ xmin: -1, xmax: 1, ymin: -2, ymax: 2, zmin: -3, zmax: 3 })
      )
    ).toEqual({
      min: [-1, -2, -3],
      max: [1, 2, 3],
    });
    expect(
      boxOf(grapher({ xmin: 1, xmax: 1, ymin: -2, ymax: 2, zmin: -3, zmax: 3 }))
    ).toBeUndefined();
    expect(
      boxOf(
        grapher({ xmin: NaN, xmax: 1, ymin: -2, ymax: 2, zmin: -3, zmax: 3 })
      )
    ).toBeUndefined();
    expect(boxOf(undefined)).toBeUndefined();
  });
});

function fail(message: string): never {
  throw new Error(`unexpected error: ${message}`);
}
