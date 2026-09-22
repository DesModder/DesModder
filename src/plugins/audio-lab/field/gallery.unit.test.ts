/**
 * The shared gallery, as Audio Lab takes it.
 *
 * Two things are done to a gallery field on its way in — a loudness gain is
 * written into both components, and its clock speed is baked into the LaTeX —
 * and both are done by rewriting text that a person then reads and edits. That
 * makes them exactly the kind of change a test should hold still: a rewrite
 * that compiles but means something else is invisible until someone notices
 * the picture is wrong.
 */
import {
  FIELD_GALLERY,
  GALLERY_GAIN,
  configFromGalleryPreset,
  galleryChoices,
  galleryConfigId,
  galleryPresetFromConfigId,
  identifyPreset,
} from "./gallery";
import { compileAudioField } from "./compile";
import { cloneAudioFieldConfig, configFromPreset } from "./model";
import { mentions } from "../../../field-rendering/identifiers";

describe("every gallery field arrives usable", () => {
  test.each(FIELD_GALLERY.map((preset) => [preset.id, preset] as const))(
    "%s compiles once the gain is written into it",
    (_id, preset) => {
      const compiled = compileAudioField(configFromGalleryPreset(preset));
      expect(compiled.ok ? "" : compiled.error).toBe("");
    }
  );

  test.each(FIELD_GALLERY.map((preset) => [preset.id, preset] as const))(
    "%s reads loudness in both components",
    (_id, preset) => {
      const config = configFromGalleryPreset(preset);
      // Not a substring check on the gain: what matters is that the compiled
      // field actually takes A_audio as a uniform, which is the thing that
      // makes it move with the music.
      const compiled = compileAudioField(config);
      expect(compiled.ok).toBe(true);
      if (!compiled.ok) return;
      expect(compiled.field.params).toContain("A_audio");
      expect(mentions(config.p, "A_audio")).toBe(true);
      expect(mentions(config.q, "A_audio")).toBe(true);
    }
  );

  test("the gain is the same one everywhere, so it can be recognised", () => {
    for (const preset of FIELD_GALLERY) {
      const config = configFromGalleryPreset(preset);
      expect(config.p.startsWith(GALLERY_GAIN)).toBe(true);
      expect(config.q.startsWith(GALLERY_GAIN)).toBe(true);
    }
  });

  test("the gain cannot reach zero", () => {
    // A field that could be zero everywhere stalls every particle in it, and
    // the renderer respawns a stalled particle — which draws nothing at all.
    // See "Still water" in model.ts for what that looks like.
    expect(GALLERY_GAIN).toContain("0.55");
  });

  test("a preset's colours and look come across", () => {
    for (const preset of FIELD_GALLERY) {
      const config = configFromGalleryPreset(preset);
      expect(config.look.palette).toBe(preset.palette);
      // The backdrop is not optional for these: their ramps run from near-black
      // to near-white, and on white graph paper that is upside down.
      expect(config.look.backdrop).not.toBe("");
      if (preset.flow?.particleCount !== undefined)
        expect(config.look.particleCount).toBe(preset.flow.particleCount);
      if (preset.flow?.glow !== undefined)
        expect(config.look.glow).toBe(preset.flow.glow);
    }
  });

  test("ripples and the cursor are scaled to the field's own size", () => {
    const small = configFromGalleryPreset(
      FIELD_GALLERY.find((preset) => preset.extent === 6)!
    );
    const large = configFromGalleryPreset(
      FIELD_GALLERY.find((preset) => preset.extent === 10)!
    );
    // A ring 1.6 units across is most of a dipole and a detail in a galaxy.
    expect(large.ripples.wavelength).toBeGreaterThan(small.ripples.wavelength);
    expect(large.pointer.radius).toBeGreaterThan(small.pointer.radius);
  });
});

describe("the clock speed, baked in", () => {
  test("a preset that slows its clock says so in the expression", () => {
    const binary = FIELD_GALLERY.find((preset) => preset.id === "binary")!;
    expect(binary.timeSpeed).toBeLessThan(1);
    const config = configFromGalleryPreset(binary);
    // Bracketed, because `3\sin 0.45t` is ambiguous where `3\sin(0.45t)` is
    // not, and a preset should not depend on which reading a parser takes.
    expect(config.p).toContain(`\\left(${binary.timeSpeed}t\\right)`);
    expect(config.p).not.toMatch(/\\sin\s*0\.45t/);
  });

  test("a preset at normal speed is left exactly alone", () => {
    const lattice = FIELD_GALLERY.find((preset) => preset.id === "cellular")!;
    expect(lattice.timeSpeed).toBeUndefined();
    const config = configFromGalleryPreset(lattice);
    expect(config.p).toBe(`${GALLERY_GAIN}\\left(${lattice.xLatex}\\right)`);
  });

  test("rewriting the clock does not touch a t inside a function name", () => {
    // `\tan` and `\cot` contain a t, and so does a subscript belonging to
    // another name. This is why the rewrite walks the string as a lexer would
    // rather than doing a string replace.
    const config = configFromGalleryPreset({
      id: "probe",
      name: "Probe",
      blurb: "",
      xLatex: String.raw`\tan\left(t\right)+T_{audio}`,
      yLatex: String.raw`\cot\left(y\right)`,
      palette: "spectral",
      timeSpeed: 0.5,
    });
    expect(config.p).toContain("\\tan");
    expect(config.p).toContain("T_{audio}");
    expect(config.p).toContain("\\left(0.5t\\right)");
    expect(config.q).toContain("\\cot");
    expect(config.q).not.toContain("0.5t");
  });
});

describe("which preset a configuration is", () => {
  test("a gallery field, untouched, is still that gallery field", () => {
    for (const preset of FIELD_GALLERY) {
      const config = configFromGalleryPreset(preset);
      expect(identifyPreset(config)).toBe(galleryConfigId(preset.id));
    }
  });

  test("changing how it is drawn does not make it a different field", () => {
    const config = configFromGalleryPreset(FIELD_GALLERY[0]);
    config.look.palette = "turbo";
    config.ripples.strength = 9;
    expect(identifyPreset(config)).toBe(galleryConfigId(FIELD_GALLERY[0].id));
  });

  test("deleting the gain makes it yours", () => {
    // Which is the point of writing the gain into the box: taking it out is an
    // edit, and an edit is what makes a field the user's.
    const config = configFromGalleryPreset(FIELD_GALLERY[0]);
    config.p = FIELD_GALLERY[0].xLatex;
    expect(identifyPreset(config)).toBe("custom");
  });

  test("this plugin's own presets are still identified", () => {
    const config = configFromPreset("vortex");
    expect(identifyPreset(config)).toBe("vortex");
    const edited = cloneAudioFieldConfig(config);
    edited.q = "0";
    expect(identifyPreset(edited)).toBe("custom");
  });

  test("an id from neither list is nothing rather than a guess", () => {
    expect(galleryPresetFromConfigId("gallery:not-a-field")).toBeUndefined();
    expect(galleryPresetFromConfigId("vortex")).toBeUndefined();
  });

  test("the two lists cannot collide on an id", () => {
    const gallery = new Set(galleryChoices().map(([id]) => id));
    for (const id of gallery) expect(id.startsWith("gallery:")).toBe(true);
    expect(gallery.size).toBe(FIELD_GALLERY.length);
  });
});
