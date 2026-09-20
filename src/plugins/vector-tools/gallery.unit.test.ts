/**
 * The gallery is eight pairs of hand-written LaTeX, several of them long enough
 * that a missing brace is easy to write and impossible to spot. A broken one
 * fails at the point somebody clicks it, as a field that draws nothing — so the
 * check that matters is that every one of them compiles, and it belongs here
 * rather than in a browser.
 */
import {
  colorsFromGallery,
  configFromGallery,
  FIELD_GALLERY,
  galleryPreset,
} from "./gallery";
import { compileFieldComponentToGLSL } from "../../field-rendering/latexToGLSL";
import { cloneDefaultConfig } from "./model";
import { PALETTE_IDS } from "../../field-rendering/palettes";

describe("every gallery field compiles", () => {
  test.each(FIELD_GALLERY.map((preset) => [preset.name, preset] as const))(
    "%s",
    (_name, preset) => {
      for (const latex of [preset.xLatex, preset.yLatex]) {
        const result = compileFieldComponentToGLSL(latex);
        // The message is worth surfacing: "unexpected end of input" names the
        // problem, and `ok: false` does not.
        expect(result.ok ? "" : result.error).toBe("");
        expect(result.ok).toBe(true);
      }
    }
  );

  test("the ones that move actually read the clock", () => {
    // A preset with a time speed that never mentions `t` is a preset whose
    // animation setting does nothing, which is worse than not having one.
    for (const preset of FIELD_GALLERY) {
      if (preset.timeSpeed === undefined) continue;
      const uses = `${preset.xLatex}${preset.yLatex}`.includes("t");
      expect(`${preset.name}: ${uses}`).toBe(`${preset.name}: true`);
    }
  });

  test("their palettes exist", () => {
    for (const preset of FIELD_GALLERY) {
      expect(PALETTE_IDS).toContain(preset.palette);
    }
  });

  test("ids are unique, since one addresses a preset", () => {
    const ids = FIELD_GALLERY.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("loading one", () => {
  test("brings its look, and turns the arrows off", () => {
    const preset = galleryPreset("spiral-galaxy")!;
    const config = configFromGallery(preset);
    expect(config.name).toBe("Spiral galaxy");
    expect(config.components.xLatex).toBe(preset.xLatex);
    // These are flow pictures: an arrow grid is how you read a field, not how
    // you watch one.
    expect(config.arrowMode).toBe("off");
    expect(config.flow.palette).toBe("nebula");
    expect(config.color.palette).toBe("nebula");
    // The backdrop is what keeps a near-black palette from disappearing into
    // white graph paper.
    expect(config.flow.backdropEnabled).toBe(true);
    expect(config.domain.x.min).toBe(-10);
    expect(config.domain.y.max).toBe(10);
  });

  test("keeps everything it does not mention", () => {
    // A preset is a set of changes from the ordinary field, not a second place
    // where every setting has to be maintained.
    const base = cloneDefaultConfig();
    base.curve.enabled = true;
    base.zeroVectorMode = "point";
    const config = configFromGallery(galleryPreset("dipole")!, base);
    expect(config.curve.enabled).toBe(true);
    expect(config.zeroVectorMode).toBe("point");
  });

  test("the light touch takes the colours and leaves the rest alone", () => {
    // What somebody has set up is usually the part they spent time on, and a
    // gallery that throws it away is one they stop clicking.
    const base = cloneDefaultConfig();
    base.domain.x = { ...base.domain.x, min: -3, max: 3, count: 9 };
    base.arrowMode = "live";
    base.flow = { ...base.flow, particleCount: 4_000, pointSize: 5 };

    const config = colorsFromGallery(galleryPreset("black-hole")!, base);

    // Taken: the formula, the name and the colours.
    expect(config.components.xLatex).toBe(galleryPreset("black-hole")!.xLatex);
    expect(config.name).toBe("Black hole");
    expect(config.flow.palette).toBe("ember");
    // The backdrop comes with the palette rather than separately: a ramp that
    // starts near black is not separable from the dark it is drawn on.
    expect(config.flow.backdropEnabled).toBe(true);

    // Left alone: everything that was somebody's own setting.
    expect(config.domain.x.min).toBe(-3);
    expect(config.domain.x.count).toBe(9);
    expect(config.arrowMode).toBe("live");
    expect(config.flow.particleCount).toBe(4_000);
    expect(config.flow.pointSize).toBe(5);
  });

  test("an unknown id is nothing rather than a guess", () => {
    expect(galleryPreset("no-such-field")).toBeUndefined();
  });
});
