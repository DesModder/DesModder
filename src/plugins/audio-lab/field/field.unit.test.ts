/**
 * The audio field: what compiles, what a ripple does, and what round-trips.
 *
 * Nothing here runs a shader. The renderer's own tests cover the GL, and the
 * fake WebGL they use never compiles anything — so these check the two things
 * a test can actually settle: that a configuration survives being stored, and
 * that what is handed to the GPU is the right shape and describes the right
 * ripples.
 */
import { compileAudioField, flowOptionsFor } from "./compile";
import {
  AUDIO_FIELD_PRESETS,
  RIPPLE_SLOTS,
  cloneAudioFieldConfig,
  configFromPreset,
  matchesPreset,
  normalizeAudioFieldConfig,
} from "./model";
import { RippleEmitter } from "./RippleEmitter";
import { AUDIO_VARIABLES } from "./variables";
import { SILENT_FRAME, type AudioFeatureFrame } from "../audio/features";
import { RIPPLE_STRIDE } from "../../../field-rendering/FlowRenderer";
import { fieldFunctions } from "../../../field-rendering/field";

const VIEW = { xMin: -10, xMax: 10, yMin: -6, yMax: 6 };

function frame(over: Partial<AudioFeatureFrame> = {}): AudioFeatureFrame {
  return { ...SILENT_FRAME, ...over };
}

describe("the presets", () => {
  test.each(AUDIO_FIELD_PRESETS.map((preset) => [preset.id, preset] as const))(
    "%s compiles",
    (_id, preset) => {
      const compiled = compileAudioField(configFromPreset(preset.id));
      expect(compiled.ok ? "" : compiled.error).toBe("");
      expect(compiled.ok).toBe(true);
    }
  );

  test("each one is its own field rather than a variation of the last", () => {
    const components = AUDIO_FIELD_PRESETS.map(
      (preset) => `${preset.config.p}|${preset.config.q}`
    );
    expect(new Set(components).size).toBe(components.length);
  });

  test("a preset loaded and not touched still says it is that preset", () => {
    for (const preset of AUDIO_FIELD_PRESETS)
      expect(matchesPreset(configFromPreset(preset.id))).toBe(true);
  });

  test("editing a component makes it stop matching", () => {
    const config = configFromPreset("stream");
    config.p = "2x";
    expect(matchesPreset(config)).toBe(false);
  });
});

describe("what a field expression may reference", () => {
  test.each(AUDIO_VARIABLES.map((variable) => [variable.latex] as const))(
    "%s compiles to a uniform",
    (latex) => {
      const config = configFromPreset("still");
      config.p = latex;
      const compiled = compileAudioField(config);
      expect(compiled.ok).toBe(true);
      if (!compiled.ok) return;
      // As a uniform rather than a literal: a value baked into the source would
      // relink two programs on every frame of music.
      expect(compiled.field.params?.length).toBe(1);
    }
  );

  test("a name the plugin cannot supply is refused by name", () => {
    const config = configFromPreset("still");
    config.p = "Z_{unknown}";
    const compiled = compileAudioField(config);
    expect(compiled.ok).toBe(false);
    if (compiled.ok) return;
    expect(compiled.which).toBe("P");
    expect(compiled.error).toContain("Z_unknown");
  });

  test("the component that failed is named, so the panel can point at it", () => {
    const config = configFromPreset("still");
    config.q = "\\frac{}{}";
    const compiled = compileAudioField(config);
    expect(compiled.ok).toBe(false);
    if (!compiled.ok) expect(compiled.which).toBe("Q");
  });

  test("ripples turned off ask the shader for no slots at all", () => {
    const config = configFromPreset("stream");
    config.ripples.source = "off";
    const compiled = compileAudioField(config);
    expect(compiled.ok && compiled.field.disturbances?.ripples).toBe(0);
  });

  test("every ripple source that is not off asks for the same slots", () => {
    // The slot count is a uniform array length, so it is part of the shader.
    // A count that varied with a setting would relink two programs whenever
    // that setting moved.
    for (const source of ["onset", "beat"] as const) {
      const config = configFromPreset("stream");
      config.ripples.source = source;
      const compiled = compileAudioField(config);
      expect(compiled.ok && compiled.field.disturbances?.ripples).toBe(
        RIPPLE_SLOTS
      );
    }
  });
});

describe("the generated shader", () => {
  test("a field with ripples declares the clock even without t in it", () => {
    const config = configFromPreset("still");
    config.p = "1";
    config.q = "0";
    const compiled = compileAudioField(config);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    expect(compiled.field.usesTime).toBe(false);
    // A ripple's whole appearance is its age, so it reads the clock whether or
    // not the expression does. Declaring it is what stops the shader reading an
    // uninitialised float and ageing every ripple to infinity.
    const source = fieldFunctions(compiled.field);
    expect(source).toContain("uniform float u_time;");
    expect(source).toContain(`u_ripples[${RIPPLE_SLOTS}]`);
  });

  test("a field with no disturbances is the source it always was", () => {
    const plain = { kind: "components", p: "1.0", q: "0.0" } as const;
    const source = fieldFunctions(plain);
    expect(source).not.toContain("u_ripples");
    expect(source).not.toContain("u_pointer");
    expect(source).not.toContain("vtRipples");
  });

  test("the cursor term appears only when the cursor does something", () => {
    const off = configFromPreset("still");
    off.pointer.mode = "off";
    const compiledOff = compileAudioField(off);
    expect(compiledOff.ok).toBe(true);
    if (compiledOff.ok)
      expect(fieldFunctions(compiledOff.field)).not.toContain("vtPointer");

    const on = configFromPreset("still");
    on.pointer.mode = "swirl";
    const compiledOn = compileAudioField(on);
    if (compiledOn.ok)
      expect(fieldFunctions(compiledOn.field)).toContain("vtPointer(p)");
  });
});

describe("the ripple emitter", () => {
  test("its buffer is exactly the length the uniform array expects", () => {
    expect(new RippleEmitter().packed.length).toBe(
      RIPPLE_SLOTS * RIPPLE_STRIDE
    );
  });

  test("one onset makes one ripple, however often the frame is read", () => {
    const emitter = new RippleEmitter();
    const config = configFromPreset("still").ripples;
    // The first onset seen on start is not owed a ring: the field may have been
    // switched on mid-song.
    emitter.pump(frame({ onsetCount: 0 }), config, VIEW, 0);
    expect(emitter.activeCount).toBe(0);

    const hit = frame({ onsetCount: 1, onset: 1, rms: 0.5 });
    // The field draws faster than the analysis measures, so the same frame is
    // read several times over. A rising-edge test on the impulse would emit a
    // ring on each of them.
    for (let i = 0; i < 5; i++) emitter.pump(hit, config, VIEW, 0.01 * i);
    expect(emitter.activeCount).toBe(1);

    emitter.pump(frame({ onsetCount: 2, onset: 1, rms: 0.5 }), config, VIEW, 1);
    expect(emitter.activeCount).toBe(2);
  });

  test("a ripple is retired once its lifetime is up", () => {
    const emitter = new RippleEmitter();
    const config = { ...configFromPreset("still").ripples, lifetime: 2 };
    emitter.pump(frame({ onsetCount: 1, rms: 1 }), config, VIEW, 0);
    expect(emitter.activeCount).toBe(1);
    emitter.pump(frame({ onsetCount: 1, rms: 1 }), config, VIEW, 1.9);
    expect(emitter.activeCount).toBe(1);
    emitter.pump(frame({ onsetCount: 1, rms: 1 }), config, VIEW, 2.1);
    expect(emitter.activeCount).toBe(0);
  });

  test("more ripples than there are slots reuses the oldest", () => {
    const emitter = new RippleEmitter();
    const config = { ...configFromPreset("still").ripples, lifetime: 1000 };
    for (let i = 1; i <= RIPPLE_SLOTS + 10; i++)
      emitter.pump(frame({ onsetCount: i, rms: 1 }), config, VIEW, i * 0.01);
    expect(emitter.activeCount).toBe(RIPPLE_SLOTS);
  });

  test("the beat source fires when the phase wraps, not on every frame", () => {
    const emitter = new RippleEmitter();
    const config = {
      ...configFromPreset("still").ripples,
      source: "beat" as const,
    };
    const at = (beatPhase: number, time: number) =>
      emitter.pump(frame({ beatPhase, bpm: 120, rms: 1 }), config, VIEW, time);
    at(0.2, 0);
    at(0.6, 0.1);
    at(0.9, 0.2);
    expect(emitter.activeCount).toBe(0);
    at(0.1, 0.3);
    expect(emitter.activeCount).toBe(1);
    at(0.4, 0.4);
    expect(emitter.activeCount).toBe(1);
  });

  test("a tempo that has not been worked out yet fires nothing", () => {
    const emitter = new RippleEmitter();
    const config = {
      ...configFromPreset("still").ripples,
      source: "beat" as const,
    };
    emitter.pump(frame({ beatPhase: 0.9, bpm: NaN }), config, VIEW, 0);
    emitter.pump(frame({ beatPhase: 0.1, bpm: NaN }), config, VIEW, 0.1);
    expect(emitter.activeCount).toBe(0);
  });

  test("source off fires nothing at all", () => {
    const emitter = new RippleEmitter();
    const config = {
      ...configFromPreset("still").ripples,
      source: "off" as const,
    };
    emitter.pump(frame({ onsetCount: 3, rms: 1 }), config, VIEW, 0);
    expect(emitter.activeCount).toBe(0);
  });

  test("the origin modes land where they say they do", () => {
    const emitter = new RippleEmitter();
    const read = () => ({
      x: emitter.packed[0],
      y: emitter.packed[1],
    });

    const centre = {
      ...configFromPreset("still").ripples,
      origin: "centre" as const,
    };
    emitter.pump(frame({ onsetCount: 1, rms: 1 }), centre, VIEW, 0);
    expect(read()).toEqual({ x: 0, y: 0 });

    emitter.clear();
    emitter.setPointer(3, -2);
    const pointer = {
      ...configFromPreset("still").ripples,
      origin: "pointer" as const,
    };
    emitter.pump(frame({ onsetCount: 1, rms: 1 }), pointer, VIEW, 0);
    expect(read()).toEqual({ x: 3, y: -2 });

    // With the cursor gone there is no answer to "where the pointer is", and
    // rings arriving at where it was last seen would read as a bug.
    emitter.clear();
    emitter.forgetPointer();
    emitter.pump(frame({ onsetCount: 1, rms: 1 }), pointer, VIEW, 0);
    expect(read()).toEqual({ x: 0, y: 0 });
  });

  test("the spectrum origin puts a bright sound right and a loud one high", () => {
    const emitter = new RippleEmitter();
    const config = {
      ...configFromPreset("still").ripples,
      origin: "spectrum" as const,
    };
    emitter.pump(
      frame({ onsetCount: 1, centroid: 0.9, rms: 0.9 }),
      config,
      VIEW,
      0
    );
    const bright = { x: emitter.packed[0], y: emitter.packed[1] };
    emitter.clear();
    emitter.pump(
      frame({ onsetCount: 1, centroid: 0.1, rms: 0.1 }),
      config,
      VIEW,
      0
    );
    const dark = { x: emitter.packed[0], y: emitter.packed[1] };
    expect(bright.x).toBeGreaterThan(dark.x);
    expect(bright.y).toBeGreaterThan(dark.y);
  });

  test("a ripple asked for by hand is written whatever the music is doing", () => {
    const emitter = new RippleEmitter();
    emitter.emit(1, 2, 3, 10);
    expect([...emitter.packed.slice(0, 4)]).toEqual([1, 2, 10, 3]);
  });

  test("a ripple with no strength is refused rather than filling a slot", () => {
    const emitter = new RippleEmitter();
    emitter.emit(1, 2, 0, 0);
    emitter.emit(NaN, 2, 5, 0);
    expect(emitter.activeCount).toBe(0);
  });
});

describe("the stored configuration", () => {
  test("normalizing settles, so starting up does not rewrite the setting", () => {
    // The plugin compares the serialised configuration against what is stored
    // every time it starts; one that does not round-trip writes on every load.
    for (const preset of AUDIO_FIELD_PRESETS) {
      const once = normalizeAudioFieldConfig(configFromPreset(preset.id));
      const twice = normalizeAudioFieldConfig(cloneAudioFieldConfig(once));
      expect(twice).toEqual(once);
    }
  });

  test("nonsense in any field falls back rather than half-applying", () => {
    const config = normalizeAudioFieldConfig({
      presetId: 42,
      p: "",
      ripples: { source: "explode", speed: "fast", lifetime: -3 },
      pointer: { mode: null, radius: Infinity },
      look: { palette: "not-a-palette", particleCount: 1e9, opacity: 0 },
    });
    const base = configFromPreset("stream");
    expect(config.presetId).toBe(base.presetId);
    expect(config.p).toBe(base.p);
    expect(config.ripples.source).toBe(base.ripples.source);
    expect(config.ripples.speed).toBe(base.ripples.speed);
    expect(config.pointer.mode).toBe(base.pointer.mode);
    expect(config.look.palette).toBe(base.look.palette);
    // Clamped rather than rejected, since a number in range is what was meant.
    expect(config.look.particleCount).toBe(120_000);
    expect(config.look.opacity).toBe(0.02);
  });

  test("a configuration from nothing at all is the default", () => {
    expect(normalizeAudioFieldConfig(undefined)).toEqual(
      configFromPreset("stream")
    );
    expect(normalizeAudioFieldConfig("garbage")).toEqual(
      configFromPreset("stream")
    );
  });

  test("the look reaches the renderer unchanged", () => {
    const config = configFromPreset("vortex");
    const options = flowOptionsFor(config);
    expect(options.particleCount).toBe(config.look.particleCount);
    expect(options.trailPersistence).toBe(config.look.trailPersistence);
    expect(options.palette).toBe(config.look.palette);
  });
});
