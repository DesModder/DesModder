import { fakeCanvas, fakeGL } from "./glTestDouble";
import {
  DEFAULT_FLOW_OPTIONS,
  FlowRenderer,
  hexToUnitRGB,
  particleCapacityFor,
  particleResolutionFor,
  trailReprojection,
  type FlowOptions,
} from "./FlowRenderer";

describe("Vector Tools flow particle capacity", () => {
  it("never allocates below the floor", () => {
    expect(particleCapacityFor(1)).toBe(512);
    expect(particleCapacityFor(0)).toBe(512);
    expect(particleCapacityFor(-5)).toBe(512);
    expect(particleCapacityFor(Number.NaN)).toBe(512);
  });

  it("rounds a count up to a power of two", () => {
    expect(particleCapacityFor(513)).toBe(1024);
    expect(particleCapacityFor(16_000)).toBe(16_384);
    expect(particleCapacityFor(400_000)).toBe(524_288);
  });

  it("leaves an exact power of two alone", () => {
    for (let capacity = 512; capacity <= 2 ** 20; capacity *= 2) {
      expect(particleCapacityFor(capacity)).toBe(capacity);
    }
  });

  it("gives a square that holds the whole capacity", () => {
    for (let capacity = 512; capacity <= 2 ** 20; capacity *= 2) {
      const resolution = particleResolutionFor(capacity);
      expect(resolution * resolution).toBeGreaterThanOrEqual(capacity);
      expect((resolution - 1) * (resolution - 1)).toBeLessThan(capacity);
    }
  });
});

describe("Vector Tools flow renderer allocation", () => {
  /**
   * Dragging the count slider fires one `setOptions` per pointermove. Before
   * capacity was split from count, each of those deleted and recreated both
   * float textures and the index buffer — a multi-megabyte reallocation per
   * frame at the top of the range.
   */
  it("does not reallocate while the count sweeps its whole range", () => {
    const gl = fakeGL();
    const renderer = new FlowRenderer(fakeCanvas(gl));
    renderer.setField({ kind: "components", p: "p.x", q: "p.y" });
    const allocationsAtStart = gl.counts.createTexture;

    for (let position = 0; position <= 1000; position++) {
      renderer.setOptions(optionsWithCount(sweptCount(position)));
    }

    // 500 to 400,000 crosses ten power-of-two boundaries, and each one
    // allocates a read and a write texture.
    const allocations = gl.counts.createTexture - allocationsAtStart;
    expect(allocations).toBeLessThanOrEqual(2 * 12);
    expect(gl.counts.deleteTexture).toBeLessThanOrEqual(allocations + 2);
  });

  it("reallocates nothing at all when the count shrinks within capacity", () => {
    const gl = fakeGL();
    const renderer = new FlowRenderer(fakeCanvas(gl));
    renderer.setField({ kind: "components", p: "p.x", q: "p.y" });
    renderer.setOptions(optionsWithCount(400_000));
    const allocationsAtStart = gl.counts.createTexture;

    // A quarter of the capacity is the shrink threshold, so everything above
    // it reuses the textures already on the GPU.
    for (let count = 400_000; count > 524_288 / 4; count -= 100) {
      renderer.setOptions(optionsWithCount(count));
    }

    expect(gl.counts.createTexture).toBe(allocationsAtStart);
  });

  it("hands memory back once the count falls well below capacity", () => {
    const gl = fakeGL();
    const renderer = new FlowRenderer(fakeCanvas(gl));
    renderer.setField({ kind: "components", p: "p.x", q: "p.y" });
    renderer.setOptions(optionsWithCount(400_000));
    const allocationsAtStart = gl.counts.createTexture;

    renderer.setOptions(optionsWithCount(1_000));

    expect(gl.counts.createTexture).toBe(allocationsAtStart + 2);
  });

  it("draws exactly the requested count", () => {
    const gl = fakeGL();
    const renderer = new FlowRenderer(fakeCanvas(gl));
    renderer.setField({ kind: "components", p: "p.x", q: "p.y" });
    renderer.resize(400, 300, 1);

    for (const count of [500, 1_000, 16_000, 120_000, 400_000, 2_000]) {
      renderer.setOptions(optionsWithCount(count));
      gl.counts.pointsDrawn = 0;
      renderer.frame();
      expect(gl.counts.pointsDrawn).toBe(count);
    }
  });

  it("steps only the texture rows that hold live particles", () => {
    const gl = fakeGL();
    const renderer = new FlowRenderer(fakeCanvas(gl));
    renderer.setField({ kind: "components", p: "p.x", q: "p.y" });
    renderer.resize(400, 300, 1);
    // 1,000 particles allocates a 1,024 capacity in a 32x32 texture; dropping
    // to 600 keeps that texture, so only the first 19 rows are still live.
    renderer.setOptions(optionsWithCount(1_000));
    renderer.setOptions(optionsWithCount(600));
    gl.counts.viewports = [];
    renderer.frame();

    const resolution = particleResolutionFor(particleCapacityFor(1_000));
    expect(resolution).toBe(32);
    // The step pass runs first, so its viewport is the first one of the frame.
    expect(gl.counts.viewports[0]).toEqual([
      0,
      0,
      resolution,
      Math.ceil(600 / resolution),
    ]);
  });
});

describe("Vector Tools flow fixed color", () => {
  it("reads both hex lengths and falls back on nonsense", () => {
    expect(hexToUnitRGB("#ffffff")).toEqual([1, 1, 1]);
    expect(hexToUnitRGB("#000")).toEqual([0, 0, 0]);
    expect(hexToUnitRGB("nope")).toEqual([0.4, 0.3, 0.7]);
  });
});

function optionsWithCount(particleCount: number): FlowOptions {
  return { ...DEFAULT_FLOW_OPTIONS, particleCount };
}

/** The panel's logarithmic slider, at 1,001 positions across its track. */
function sweptCount(position: number) {
  const t = position / 1000;
  return Math.round(
    Math.exp(Math.log(500) + t * (Math.log(400_000) - Math.log(500)))
  );
}

describe("Vector Tools flow trail reprojection", () => {
  const view = (xMin: number, xMax: number, yMin: number, yMax: number) => ({
    xMin,
    xMax,
    yMin,
    yMax,
  });

  it("leaves an unchanged view exactly where it is", () => {
    // The identity has to be exact, or every frame of a stationary graph would
    // resample the trail and blur it away.
    expect(
      trailReprojection(view(-10, 10, -6, 6), view(-10, 10, -6, 6))
    ).toEqual({ scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0 });
  });

  it("shifts by the fraction of the view that was panned", () => {
    // Panning right by a quarter of the width means each new texel reads a
    // quarter of a screen further along the old one.
    const mapping = trailReprojection(view(0, 20, 0, 10), view(5, 25, 0, 10))!;
    expect(mapping.offsetX).toBeCloseTo(0.25);
    expect(mapping.offsetY).toBe(0);
    expect(mapping.scaleX).toBe(1);
  });

  it("spreads the old view across the new one when zooming out", () => {
    // Twice the width in view means the old trail covers half of it.
    const mapping = trailReprojection(
      view(-10, 10, -6, 6),
      view(-20, 20, -12, 12)
    )!;
    expect(mapping.scaleX).toBe(2);
    expect(mapping.scaleY).toBe(2);
    expect(mapping.offsetX).toBeCloseTo(-0.5);
    expect(mapping.offsetY).toBeCloseTo(-0.5);
  });

  it("refuses bounds with no extent, which carry nothing", () => {
    expect(
      trailReprojection(view(3, 3, 0, 10), view(0, 10, 0, 10))
    ).toBeUndefined();
    expect(
      trailReprojection(view(0, 10, 4, 4), view(0, 10, 0, 10))
    ).toBeUndefined();
    expect(
      trailReprojection(view(0, Number.NaN, 0, 10), view(0, 10, 0, 10))
    ).toBeUndefined();
  });
});
