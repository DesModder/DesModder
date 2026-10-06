import {
  Arrow3DRenderer,
  arrowInstances3D,
  autoArrowCount3D,
  autoArrowShape3D,
  boxScale3D,
  boxScreenSize,
  DEFAULT_ARROW_3D_OPTIONS,
  verticesPerArrow3D,
} from "./Arrow3DRenderer";
import type { Camera3D } from "./camera3d";
import type { Field3D } from "./field3d";
import { fakeCanvas, fakeGL } from "./glTestDouble";
import { cutUniforms } from "./glsl3d";

const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
/** Math straight to clip, orthographic: x and y in −1..1 fill the canvas. */
const flat: Camera3D = {
  world: identity,
  view: identity,
  projection: identity,
  orthographic: true,
  width: 800,
  height: 600,
};
const box = { min: [-5, -5, -5], max: [5, 5, 5] } as const;
const charge: Field3D = {
  p: "x",
  q: "y",
  r: "p.z",
  helpers: [],
  params: [],
  usesTime: false,
};

describe("Auto rules for 3D arrows", () => {
  test("the count follows the box's size on screen, within bounds", () => {
    expect(autoArrowCount3D("jitter", 600)).toBe(8);
    expect(autoArrowCount3D("grid", 50)).toBe(4);
    expect(autoArrowCount3D("grid", 5000)).toBe(12);
    // A slice or a surface is two-dimensional, so it can be denser.
    expect(autoArrowCount3D("slice", 600)).toBe(18);
    expect(autoArrowCount3D("surface", 5000)).toBe(32);
  });

  test("shaded glyphs until the field is dense, flat past that", () => {
    expect(autoArrowShape3D(3000)).toBe("solid");
    expect(autoArrowShape3D(3001)).toBe("flat");
  });

  test("a volume asks for count³ arrows, a slice count²", () => {
    expect(arrowInstances3D("jitter", 8)).toBe(512);
    expect(arrowInstances3D("slice", 8)).toBe(64);
  });

  test("each shape's vertex cost", () => {
    expect(verticesPerArrow3D("lines")).toBe(6);
    expect(verticesPerArrow3D("flat")).toBe(9);
    expect(verticesPerArrow3D("solid")).toBe(120);
  });

  test("the box rule is a third of the mean width, as 2D's is of the view", () => {
    expect(boxScale3D({ min: [-5, -2, -1], max: [5, 4, 3] })).toBeCloseTo(
      20 / 9
    );
  });

  test("the box's size on screen is its outline's diagonal", () => {
    const half = { min: [-0.5, -0.5, -0.5], max: [0.5, 0.5, 0.5] } as const;
    // x −0.5..0.5 is 200..600 px of 800; y is 150..450 of 600.
    expect(boxScreenSize(flat, half)).toBeCloseTo(Math.hypot(400, 300));
  });
});

describe("the cutaway's uniforms", () => {
  test("a slice facing the viewer points at the camera, a fixed one where it was put", () => {
    // Looking down −z in view space with math = view: the camera is along +z,
    // which has no direction round z; turn the view so it looks along −x.
    const turned = [0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 0, 1];
    const facing = cutUniforms(turned, box, {
      cutaway: "wedge",
      angle: Math.PI / 2,
      turn: undefined,
    });
    expect(facing.mode).toBe(2);
    // View z is −math x here, so the camera sits out along +x: azimuth 0.
    expect(facing.azimuth).toBeCloseTo(0);
    const fixed = cutUniforms(turned, box, {
      cutaway: "wedge",
      angle: Math.PI / 2,
      turn: 1.2,
    });
    expect(fixed.azimuth).toBe(1.2);
    expect(fixed.facing).toBeCloseTo(0);
  });
});

describe("Arrow3DRenderer", () => {
  test("links once per field, not per frame or per setting", () => {
    const gl = fakeGL();
    const renderer = new Arrow3DRenderer(fakeCanvas(gl));
    renderer.setField(charge);
    const linked = gl.counts.linkProgram;
    renderer.setField({ ...charge });
    renderer.setOptions({ ...DEFAULT_ARROW_3D_OPTIONS, widthPx: 5 });
    renderer.resize(800, 600, 1);
    renderer.draw(flat, box);
    renderer.draw(flat, box);
    expect(gl.counts.linkProgram).toBe(linked);
    renderer.setField({ ...charge, r: "0" });
    expect(gl.counts.linkProgram).toBeGreaterThan(linked);
  });

  test("one instanced draw, one instance per arrow", () => {
    const gl = fakeGL();
    const renderer = new Arrow3DRenderer(fakeCanvas(gl));
    renderer.setField(charge);
    renderer.setOptions({ ...DEFAULT_ARROW_3D_OPTIONS, count: 6 });
    renderer.resize(800, 600, 1);
    renderer.draw(flat, box);
    expect(gl.counts.instancesDrawn).toBe(216);
    expect(renderer.last).toMatchObject({
      count: 6,
      instances: 216,
      shape: "solid",
    });
  });

  test("a scale given outright is used; the field rule falls back to the box without a readback", () => {
    const gl = fakeGL();
    const renderer = new Arrow3DRenderer(fakeCanvas(gl));
    renderer.setField(charge);
    renderer.resize(800, 600, 1);
    renderer.setOptions({ ...DEFAULT_ARROW_3D_OPTIONS, scale: 0.25 });
    renderer.draw(flat, box);
    expect(renderer.last).toMatchObject({
      speedScale: 0.25,
      scaleSource: "manual",
    });
    // The double reads back zeros: no magnitudes, so no median.
    renderer.setOptions({ ...DEFAULT_ARROW_3D_OPTIONS, scale: "field" });
    renderer.draw(flat, box);
    expect(renderer.last?.scaleSource).toBe("box");
    expect(renderer.last?.speedScale).toBeCloseTo(30 / 9);
  });

  test("draws nothing, and does not throw, before it has a field", () => {
    const gl = fakeGL();
    const renderer = new Arrow3DRenderer(fakeCanvas(gl));
    renderer.resize(800, 600, 1);
    renderer.draw(flat, box);
    expect(gl.counts.instancesDrawn).toBe(0);
    expect(renderer.last).toBeUndefined();
  });
});
