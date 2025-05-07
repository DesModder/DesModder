import { fullReplacement } from "../../apply-replacements/applyReplacement";
import { replacements } from "./moduleReplacements";
import fs from "fs";

describe("Replacements", () => {
  test("Failing replacements", () => {
    const result = fullReplacement("abc", replacements);
    expect(result.newCode).toEqual("abc");
    expect(result.blockFailures.length).toBeGreaterThanOrEqual(20);
    expect(result.otherErrors.length).toBeGreaterThanOrEqual(2);
  });

  test("Successful replacements", async () => {
    // Relative to the DesModder repository.
    const filename = "node_modules/.cache/desmos/calculator_desktop.js";
    const code = fs.readFileSync(filename, { encoding: "utf-8" });
    const result = fullReplacement(code, replacements);
    expect(result.newCode.length).toBeGreaterThan(code.length + 1000);
    expect(result.blockFailures).toEqual([]);
    expect(result.otherErrors).toEqual([]);
  });
});
