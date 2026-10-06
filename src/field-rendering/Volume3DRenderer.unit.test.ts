import type { Camera3D } from "./camera3d";
import type { Field3D } from "./field3d";
import { fakeCanvas, fakeGL } from "./glTestDouble";
import {
  autoLines3D,
  autoPoints3D,
  DEFAULT_VOLUME_3D_OPTIONS,
  Volume3DRenderer,
} from "./Volume3DRenderer";

const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const flat: Camera3D = {
  world: identity,
  view: identity,
  projection: identity,
  orthographic: true,
  width: 800,
  height: 600,
};
const box = { min: [-5, -5, -5], max: [5, 5, 5] } as const;
const field: Field3D = {
  p: "-p.y",
  q: "p.x",
  r: "0.0",
  helpers: [],
  params: [],
  usesTime: false,
};

describe("Auto counts for the volume looks", () => {
  test("follow the box's size on screen, within bounds", () => {
    expect(autoLines3D(570)).toBe(4011);
    expect(autoLines3D(10)).toBe(800);
    expect(autoLines3D(5000)).toBe(6000);
    expect(autoPoints3D(570)).toBe(162_450);
    expect(autoPoints3D(10)).toBe(40_000);
  });
});

describe("Volume3DRenderer", () => {
  test("streamlines: one instanced line strip per line, traced once until something changes", () => {
    const gl = fakeGL();
    const renderer = new Volume3DRenderer(fakeCanvas(gl));
    renderer.setField(field);
    renderer.setOptions({
      ...DEFAULT_VOLUME_3D_OPTIONS,
      lines: 500,
      steps: 32,
    });
    renderer.resize(800, 600, 1);
    renderer.draw(flat, box, 0);
    expect(gl.counts.instancesDrawn).toBe(500);
    // Turning the view does not retrace: the trace never depends on it.
    const textures = gl.counts.createTexture;
    renderer.draw(flat, box, 1);
    expect(gl.counts.createTexture).toBe(textures);
    expect(renderer.last).toMatchObject({
      look: "streamlines",
      count: 500,
      vertices: 16_000,
    });
  });

  test("animated streamlines ask for frames between Desmos's redraws; still ones do not", () => {
    const renderer = new Volume3DRenderer(fakeCanvas(fakeGL()));
    renderer.setOptions({ ...DEFAULT_VOLUME_3D_OPTIONS, animate: true });
    expect(renderer.animating).toBe(true);
    renderer.setOptions({ ...DEFAULT_VOLUME_3D_OPTIONS, animate: false });
    expect(renderer.animating).toBe(false);
    renderer.setOptions({ ...DEFAULT_VOLUME_3D_OPTIONS, look: "cloud" });
    expect(renderer.animating).toBe(false);
  });

  test("the cloud draws one point per point tried", () => {
    const gl = fakeGL();
    const renderer = new Volume3DRenderer(fakeCanvas(gl));
    renderer.setField(field);
    renderer.setOptions({
      ...DEFAULT_VOLUME_3D_OPTIONS,
      look: "cloud",
      points: 12_345,
    });
    renderer.resize(800, 600, 1);
    renderer.draw(flat, box, 0);
    expect(gl.counts.pointsDrawn).toBeGreaterThanOrEqual(12_345);
    expect(renderer.last).toMatchObject({ look: "cloud", count: 12_345 });
  });

  test("links once per field", () => {
    const gl = fakeGL();
    const renderer = new Volume3DRenderer(fakeCanvas(gl));
    renderer.setField(field);
    const linked = gl.counts.linkProgram;
    renderer.setField({ ...field });
    expect(gl.counts.linkProgram).toBe(linked);
  });
});
