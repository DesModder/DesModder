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
