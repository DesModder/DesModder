import { fullReplacement } from "../../apply-replacements/applyReplacement";
import { replacements } from "./moduleReplacements";

describe("Replacements", () => {
  test("Failing replacements", () => {
    const result = fullReplacement("abc", replacements);
    expect(result.newCode).toEqual("abc");
    expect(result.blockFailures.length).toBeGreaterThanOrEqual(20);
    expect(result.otherErrors.length).toBeGreaterThanOrEqual(2);
  });
});
