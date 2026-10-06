import type { Camera3D } from "./camera3d";
import type { Field3D } from "./field3d";
import {
  autoFlowParticles3D,
  DEFAULT_FLOW_3D_OPTIONS,
  Flow3DRenderer,
  MAX_FLOW_PARTICLES_3D,
} from "./Flow3DRenderer";
import { fakeCanvas, fakeGL } from "./glTestDouble";

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
const swirl: Field3D = {
  p: "-p.y",
  q: "p.x",
  r: "0.3",
  helpers: [],
  params: [],
  usesTime: false,
};

/** Lets the renderer's real-time step see time pass between frames. */
function advance(ms: number) {
  const now = performance.now();
  jest.spyOn(performance, "now").mockReturnValue(now + ms);
}

afterEach(() => jest.restoreAllMocks());

describe("the 3D flow", () => {
  test("Auto fills the box by its size on screen, within bounds", () => {
    expect(autoFlowParticles3D(570)).toBe(10_830);
    expect(autoFlowParticles3D(50)).toBe(4_000);
    expect(autoFlowParticles3D(5000)).toBe(40_000);
  });

  test("draws one trail and one head per particle, and never more than 200,000", () => {
    const gl = fakeGL();
    const renderer = new Flow3DRenderer(fakeCanvas(gl));
    renderer.setField(swirl);
    renderer.resize(800, 600, 1);
    renderer.setOptions({ ...DEFAULT_FLOW_3D_OPTIONS, particles: 5000 });
    renderer.draw(flat, box);
    expect(gl.counts.instancesDrawn).toBe(5000);
    // 5,000 heads, and the colour scale's 1,000-sample measurement.
    expect(gl.counts.pointsDrawn).toBe(5000 + 1000);
    renderer.setOptions({ ...DEFAULT_FLOW_3D_OPTIONS, particles: 999_999 });
    renderer.draw(flat, box);
    expect(renderer.last?.particles).toBe(MAX_FLOW_PARTICLES_3D);
  });

  test("steps by real time: a second draw in the same instant does not step again", () => {
    const renderer = new Flow3DRenderer(fakeCanvas(fakeGL()));
    renderer.setField(swirl);
    renderer.resize(800, 600, 1);
    renderer.setOptions({ ...DEFAULT_FLOW_3D_OPTIONS, particles: 100 });
    renderer.draw(flat, box);
    const first = renderer.last!.steps;
    // Desmos's redraw and the animation loop landing together.
    renderer.draw(flat, box);
    expect(renderer.last!.steps).toBe(first);
    advance(16);
    renderer.draw(flat, box);
    expect(renderer.last!.steps).toBe(first + 1);
  });

  test("a flow is always animating, so the overlay keeps drawing it", () => {
    expect(new Flow3DRenderer(fakeCanvas(fakeGL())).animating).toBe(true);
  });

  test("a longer trail is a new ring, a slider drag of the count is not", () => {
    const gl = fakeGL();
    const renderer = new Flow3DRenderer(fakeCanvas(gl));
    renderer.setField(swirl);
    renderer.resize(800, 600, 1);
    renderer.setOptions({ ...DEFAULT_FLOW_3D_OPTIONS, particles: 1000 });
    renderer.draw(flat, box);
    const textures = gl.counts.createTexture;
    // 1000 and 1010 share a power-of-two state texture.
    renderer.setOptions({ ...DEFAULT_FLOW_3D_OPTIONS, particles: 1010 });
    renderer.draw(flat, box);
    expect(gl.counts.createTexture).toBe(textures);
    renderer.setOptions({
      ...DEFAULT_FLOW_3D_OPTIONS,
      particles: 1010,
      trail: 40,
    });
    renderer.draw(flat, box);
    expect(gl.counts.createTexture).toBeGreaterThan(textures);
  });
});
