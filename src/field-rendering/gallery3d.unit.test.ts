import { FIELD_GALLERY } from "./gallery";
import { compileFieldComponentToGLSL, EMPTY_ENVIRONMENT } from "./latexToGLSL";

describe("every gallery preset has a 3D form", () => {
  const space = { ...EMPTY_ENVIRONMENT, dimensions: 3 as const };

  test.each(FIELD_GALLERY.map((preset) => [preset.id, preset] as const))(
    "%s compiles in 3D, and its R is not 0 unless the field really is flat",
    (_id, preset) => {
      for (const latex of [
        preset.space.xLatex,
        preset.space.yLatex,
        preset.space.zLatex,
      ]) {
        const result = compileFieldComponentToGLSL(latex, space);
        expect([latex, result.ok]).toEqual([latex, true]);
      }
      // The Taylor–Green vortex is the one whose standard 3D form has w = 0;
      // anything else lying flat is a preset that was never given its depth.
      if (preset.id !== "cellular") expect(preset.space.zLatex).not.toBe("0");
      expect(preset.space.blurb.length).toBeGreaterThan(20);
    }
  );
});

describe("every gallery preset says where its matter is, in a form that compiles", () => {
  const plane = EMPTY_ENVIRONMENT;
  const space = { ...EMPTY_ENVIRONMENT, dimensions: 3 as const };

  test.each(FIELD_GALLERY.map((preset) => [preset.id, preset] as const))(
    "%s: its 2D field and seed compile in 2D, its 3D seed in 3D",
    (_id, preset) => {
      for (const latex of [preset.xLatex, preset.yLatex, preset.seedLatex]) {
        if (latex === undefined) continue;
        const result = compileFieldComponentToGLSL(latex, plane);
        expect([latex, result.ok]).toEqual([latex, true]);
      }
      if (preset.space.seedLatex !== undefined) {
        const result = compileFieldComponentToGLSL(
          preset.space.seedLatex,
          space
        );
        expect([preset.space.seedLatex, result.ok]).toEqual([
          preset.space.seedLatex,
          true,
        ]);
      }
    }
  );

  test("the black hole is a black hole in both: it has a horizon", () => {
    const hole = FIELD_GALLERY.find((preset) => preset.id === "black-hole")!;
    expect(hole.lensHorizon).toBeGreaterThan(0);
    expect(hole.space.lensHorizon).toBeGreaterThan(0);
    expect(hole.space.seedLatex).toBeDefined();
  });
});
