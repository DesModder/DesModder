/**
 * Gates 5-6: the audio field responds through uniforms only, moves on elapsed
 * time, holds a frame budget by degrading, and survives every invalid input the
 * specification names.
 */
import { AudioFieldError, AudioFieldRenderer } from "./AudioFieldRenderer";
import {
  FIELD_UNIFORMS,
  PRESETS,
  QUALITY_LADDER,
  nextQualityLevel,
  presetById,
} from "./presets";
import {
  DRAW_FRAGMENT,
  SEED_FRAGMENT,
  drawVertexShader,
  updateFragmentShader,
} from "./shaders";
import { canvasWithoutWebGL2, fakeCanvas, fakeGL } from "./glTestDouble";
import { SILENT_FRAME, type AudioFeatureFrame } from "../audio/features";

function features(overrides: Partial<AudioFeatureFrame> = {}) {
  return {
    ...SILENT_FRAME,
    time: 1,
    rms: 0.5,
    bass: 0.6,
    mid: 0.3,
    treble: 0.2,
    centroid: 0.4,
    dominantHz: 440,
    silent: false,
    ...overrides,
  } satisfies AudioFeatureFrame;
}

function renderer(options?: { floatTextures?: boolean }) {
  const gl = fakeGL(options);
  return { gl, field: new AudioFieldRenderer(fakeCanvas(gl)) };
}

describe("presets", () => {
  test("there are four, with distinct ids", () => {
    expect(PRESETS).toHaveLength(4);
    expect(new Set(PRESETS.map((preset) => preset.id)).size).toBe(4);
  });

  test("every preset returns a vector and reads only declared uniforms", () => {
    const declared = new Set<string>(FIELD_UNIFORMS);
    for (const preset of PRESETS) {
      expect(preset.glsl).toContain("return");
      // Any u-prefixed identifier the preset mentions has to be one the
      // renderer actually uploads, or the field silently reads zero forever.
      for (const [name] of preset.glsl.matchAll(/\bu[A-Z]\w*/g))
        expect(declared.has(name)).toBe(true);
    }
  });

  test("an unknown preset id falls back rather than throwing", () => {
    expect(presetById("nonsense").id).toBe(PRESETS[0].id);
  });

  test("every preset's shaders declare each uniform exactly once", () => {
    for (const preset of PRESETS) {
      for (const source of [
        updateFragmentShader(preset),
        drawVertexShader(preset),
      ]) {
        for (const name of FIELD_UNIFORMS) {
          const declarations = source.match(
            new RegExp(`uniform float ${name};`, "g")
          );
          expect(declarations).toHaveLength(1);
        }
      }
    }
  });

  test("the shared shaders are valid-looking GLSL ES 3.00", () => {
    for (const source of [
      SEED_FRAGMENT,
      DRAW_FRAGMENT,
      updateFragmentShader(PRESETS[0]),
      drawVertexShader(PRESETS[0]),
    ]) {
      // The version directive has to be the very first thing in the source.
      expect(source.startsWith("#version 300 es")).toBe(true);
      expect(source).toContain("precision highp float;");
    }
  });
});

describe("the quality ladder", () => {
  test("descends and never runs off the end", () => {
    let level = 0;
    for (let i = 0; i < 20; i++) level = nextQualityLevel(level, 60);
    expect(level).toBe(QUALITY_LADDER.length - 1);
  });

  test("climbs back one rung at a time from a comfortable frame", () => {
    const level = nextQualityLevel(3, 5);
    expect(level).toBe(2);
  });

  test("holds still in the band between, so it cannot oscillate", () => {
    // Comfortably under the 33 ms floor but not under the climb-back margin.
    expect(nextQualityLevel(2, 20)).toBe(2);
  });

  test("an unmeasurable frame changes nothing", () => {
    expect(nextQualityLevel(2, NaN)).toBe(2);
  });

  test("every rung is a real reduction on the one before", () => {
    for (let i = 1; i < QUALITY_LADDER.length; i++) {
      const previous = QUALITY_LADDER[i - 1];
      const current = QUALITY_LADDER[i];
      const cost = (level: (typeof QUALITY_LADDER)[number]) =>
        level.particles * level.renderScale;
      expect(cost(current)).toBeLessThan(cost(previous));
    }
  });
});

describe("the renderer", () => {
  test("refuses clearly when the browser has no WebGL2", () => {
    expect(() => new AudioFieldRenderer(canvasWithoutWebGL2())).toThrow(
      AudioFieldError
    );
    // The message has to say the graph still works, because it does.
    expect(() => new AudioFieldRenderer(canvasWithoutWebGL2())).toThrow(
      /live graph still works/
    );
  });

  test("refuses clearly without float textures", () => {
    expect(() => renderer({ floatTextures: false })).toThrow(
      /floating-point textures/
    );
  });

  test("starts at the top of the ladder", () => {
    const { field } = renderer();
    expect(field.particleCount).toBe(QUALITY_LADDER[0].particles);
    field.destroy();
  });

  test("ordinary audio frames do not compile or link anything", () => {
    const { field } = renderer();
    field.setPreset("vortex");
    const linkedAfterSetup = field.programsLinked;

    for (let i = 0; i < 300; i++)
      field.frame(
        features({
          time: i / 60,
          rms: Math.abs(Math.sin(i / 9)),
          bass: Math.abs(Math.cos(i / 5)),
          onset: i % 30 === 0 ? 1 : 0,
        }),
        1 / 60
      );

    expect(field.programsLinked).toBe(linkedAfterSetup);
    field.destroy();
  });

  test("a preset compiles once and is free from then on", () => {
    const { field } = renderer();
    const before = field.programsLinked;
    field.setPreset("flow");
    const afterFirst = field.programsLinked;
    expect(afterFirst).toBeGreaterThan(before);

    field.setPreset("storm");
    field.setPreset("flow");
    field.setPreset("storm");
    // Two presets, two pairs. Returning to either costs nothing.
    expect(field.programsLinked).toBe(afterFirst + (afterFirst - before));
    field.destroy();
  });

  test("draws one point per particle", () => {
    const { gl, field } = renderer();
    field.frame(features(), 1 / 60);
    expect(gl.counts.pointsDrawn).toBe(field.particleCount);
    field.destroy();
  });

  test("a NaN in the features never reaches a uniform", () => {
    const { gl, field } = renderer();
    field.frame(
      features({
        rms: NaN,
        bass: Infinity,
        centroid: NaN,
        dominantHz: NaN,
        onset: -Infinity,
      }),
      1 / 60
    );
    // A NaN uniform reaches every particle position in one frame and the field
    // never recovers, because NaN survives everything done to it afterwards.
    for (const [name, values] of gl.uniforms)
      for (const value of values)
        expect(
          Number.isFinite(value) ||
            // Sampler bindings and the resolution are integers, still finite.
            name === "uParticles"
        ).toBe(true);
    field.destroy();
  });

  test("a silent frame still produces a finite dominant uniform", () => {
    const { gl, field } = renderer();
    field.frame({ ...SILENT_FRAME }, 1 / 60);
    expect(gl.uniforms.get("uDominant")?.[0]).toBe(0);
    field.destroy();
  });

  test("pitch maps logarithmically across the audible range", () => {
    const { gl, field } = renderer();
    const at = (hz: number) => {
      field.frame(features({ dominantHz: hz }), 1 / 60);
      return gl.uniforms.get("uDominant")![0];
    };
    const low = at(100);
    const middle = at(1000);
    const high = at(10000);
    expect(low).toBeLessThan(middle);
    expect(middle).toBeLessThan(high);
    // Three factors of ten apart should be roughly evenly spaced, which is the
    // whole point of the log mapping. A linear one would put 100 Hz and
    // 1000 Hz within a twentieth of each other.
    expect(middle - low).toBeCloseTo(high - middle, 1);
    field.destroy();
  });

  test("a stalled tab does not teleport the field", () => {
    const { gl, field } = renderer();
    field.frame(features(), 30);
    // Thirty seconds of elapsed time has to be clamped before it is integrated.
    expect(gl.uniforms.get("uDeltaTime")![0]).toBeLessThanOrEqual(1 / 20);
    field.destroy();
  });

  test("a negative delta cannot run the field backwards", () => {
    const { gl, field } = renderer();
    field.frame(features(), -5);
    expect(gl.uniforms.get("uDeltaTime")![0]).toBe(0);
    field.destroy();
  });

  test("dropping quality reallocates and reports it", () => {
    const { field } = renderer();
    const started = field.particleCount;
    // A 60 ms frame is well past the 30 FPS floor.
    expect(field.recordFrameTime(60)).toBe(true);
    expect(field.recordFrameTime(1)).toBe(true);
    expect(field.particleCount).toBeLessThanOrEqual(started);
    // A frame inside the band moves nothing.
    expect(field.recordFrameTime(20)).toBe(false);
    field.destroy();
  });

  test("resize is a no-op when the size has not changed", () => {
    const { field } = renderer();
    expect(field.resize(400, 300, 1)).toBe(true);
    expect(field.resize(400, 300, 1)).toBe(false);
    field.destroy();
  });

  test("destroy releases every texture it made, and is safe twice", () => {
    const { gl, field } = renderer();
    field.setPreset("vortex");
    field.setPreset("storm");
    field.frame(features(), 1 / 60);
    field.destroy();
    field.destroy();
    expect(gl.counts.deleteTexture).toBe(gl.counts.createTexture);
    expect(gl.counts.deleteProgram).toBe(gl.counts.createProgram);
  });

  test("a destroyed renderer draws nothing more", () => {
    const { gl, field } = renderer();
    field.destroy();
    const drawn = gl.counts.pointsDrawn;
    field.frame(features(), 1 / 60);
    expect(gl.counts.pointsDrawn).toBe(drawn);
  });

  test("every preset runs a frame without throwing", () => {
    for (const preset of PRESETS) {
      const { field } = renderer();
      field.setPreset(preset.id);
      expect(() => {
        field.frame(features(), 1 / 60);
        field.frame({ ...SILENT_FRAME }, 1 / 60);
      }).not.toThrow();
      field.destroy();
    }
  });
});
