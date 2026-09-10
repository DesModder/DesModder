import {
  ArrowRenderer,
  DEFAULT_ARROW_OPTIONS,
  visibleGridSpan,
  type ArrowOptions,
} from "./ArrowRenderer";
import { fakeCanvas, fakeGL } from "./glTestDouble";
import type { FlowBounds } from "./FlowRenderer";

const FIELD = { kind: "components", p: "-p.y", q: "p.x" } as const;

describe("Vector Tools arrow program reuse", () => {
  /**
   * Every settings change goes through `start`, which hands the renderer the
   * same field again. Linking a program is the most expensive thing here, and
   * a drag on a slider fires one change per pointermove — so this used to
   * compile and link a shader sixty times a second while nothing about the
   * field had changed at all.
   */
  it("links nothing when the field is set again unchanged", () => {
    const gl = fakeGL();
    const renderer = new ArrowRenderer(fakeCanvas(gl));
    renderer.setField(FIELD);
    const linksAtStart = gl.counts.linkProgram;

    for (let i = 0; i < 200; i++) {
      renderer.setOptions({
        ...DEFAULT_ARROW_OPTIONS,
        headSize: 0.1 + i / 500,
      });
      renderer.setField(FIELD);
    }

    expect(gl.counts.linkProgram).toBe(linksAtStart);
  });

  it("links again once the field actually changes", () => {
    const gl = fakeGL();
    const renderer = new ArrowRenderer(fakeCanvas(gl));
    renderer.setField(FIELD);
    const linksAtStart = gl.counts.linkProgram;

    renderer.setField({ kind: "components", p: "p.y", q: "-p.x" });

    expect(gl.counts.linkProgram).toBe(linksAtStart + 1);
  });
});

describe("Vector Tools arrow culling", () => {
  const view = (
    xMin: number,
    xMax: number,
    yMin: number,
    yMax: number
  ): FlowBounds => ({ xMin, xMax, yMin, yMax });

  const grid = (columns: number, rows: number, domain: FlowBounds) => ({
    columns,
    rows,
    domain,
  });

  it("draws the whole grid when the view covers the domain", () => {
    const span = visibleGridSpan(
      grid(21, 13, view(-10, 10, -6, 6)),
      view(-12, 12, -8, 8)
    );
    expect(span).toEqual({ column: 0, row: 0, columns: 21, rows: 13 });
  });

  /**
   * The case this exists for: a domain matched to a zoomed-out viewport, then
   * zoomed back in. Every one of those arrows used to run a vertex shader that
   * evaluated the field before the clipper threw it away.
   */
  it("drops the columns and rows a zoomed-in view cannot reach", () => {
    const span = visibleGridSpan(
      grid(201, 201, view(-100, 100, -100, 100)),
      view(-5, 5, -5, 5)
    );
    // A 10-wide view carries a 1.5 margin either side, so the grid points from
    // -6 to 6 survive: thirteen columns of the two hundred and one.
    expect(span.columns).toBe(13);
    expect(span.rows).toBe(13);
    expect(span.column).toBe(94);
    expect(span.row).toBe(94);
  });

  /**
   * The shader caps an arrow at 0.12 of the view's width, so a grid point
   * that far outside can still put a head on screen. Culling it would take
   * arrows off the edge of the view, which reads as a rendering bug rather
   * than as an optimization.
   */
  it("keeps a margin wider than the longest arrow the shader will draw", () => {
    const span = visibleGridSpan(
      grid(2001, 3, view(-1000, 1000, -1, 1)),
      view(0, 100, -1, 1)
    );
    const step = 1;
    const firstDrawn = -1000 + span.column * step;
    const lastDrawn = firstDrawn + (span.columns - 1) * step;
    expect(firstDrawn).toBeLessThanOrEqual(0 - 0.12 * 100);
    expect(lastDrawn).toBeGreaterThanOrEqual(100 + 0.12 * 100);
  });

  it("draws nothing when the domain is entirely off screen", () => {
    const span = visibleGridSpan(
      grid(21, 13, view(-10, 10, -6, 6)),
      view(500, 520, 500, 520)
    );
    expect(span.columns * span.rows).toBe(0);
  });

  it("falls back to the whole grid rather than guess at nonsense", () => {
    const span = visibleGridSpan(
      grid(21, 13, view(-10, 10, -6, 6)),
      view(Number.NaN, 10, -6, 6)
    );
    expect(span).toEqual({ column: 0, row: 0, columns: 21, rows: 13 });
  });

  it("instances only what it decided was visible", () => {
    const gl = fakeGL();
    const renderer = new ArrowRenderer(fakeCanvas(gl));
    renderer.setField(FIELD);
    renderer.resize(400, 300, 1);
    renderer.setOptions({
      ...DEFAULT_ARROW_OPTIONS,
      columns: 201,
      rows: 201,
      domain: view(-100, 100, -100, 100),
    } satisfies ArrowOptions);
    renderer.setBounds(view(-5, 5, -5, 5));

    gl.counts.instancesDrawn = 0;
    renderer.frame();

    expect(gl.counts.instancesDrawn).toBe(13 * 13);
    expect(renderer.drawnArrowCount).toBe(13 * 13);
    // The count the panel reports is still the field's, not the frame's — a
    // status line that changed with every pan would be reporting the wrong
    // thing.
    expect(renderer.arrowCount).toBe(201 * 201);
  });
});
