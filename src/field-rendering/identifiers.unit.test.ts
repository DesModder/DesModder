import {
  canonicalIdentifier,
  identifierNames,
  mentions,
  renameIdentifier,
} from "./identifiers";

describe("Vector Tools identifier scanning", () => {
  test("does not mistake the letters of a command for variables", () => {
    // The whole reason this is a scanner and not a search. Every one of these
    // contains the letter t, and none of them mentions the variable t.
    for (const latex of [
      "\\tan\\left(x\\right)",
      "\\cot x",
      "\\operatorname{sort}\\left(x\\right)",
      "\\operatorname{total}\\left(x\\right)",
      "v_{tfdp}\\left(x,y\\right)",
      "a_{t}x",
    ]) {
      expect([latex, mentions(latex, "t")]).toEqual([latex, false]);
    }
  });

  test("finds a variable that really is there", () => {
    for (const latex of [
      "t",
      "\\sin\\left(t\\right)",
      "x+t",
      "\\frac{t}{2}",
      "\\tan\\left(t\\right)",
    ]) {
      expect([latex, mentions(latex, "t")]).toEqual([latex, true]);
    }
  });

  test("reads a subscript as part of one name", () => {
    expect(identifierNames("a_{1}x+b_2y")).toEqual(
      new Set(["a_1", "x", "b_2", "y"])
    );
    expect(canonicalIdentifier("a_{1}")).toBe("a_1");
  });

  test("renames only the variable, leaving commands and subscripts alone", () => {
    expect(renameIdentifier("\\sin\\left(y+t\\right)", "t", "v_{tfdt}")).toBe(
      "\\sin\\left(y+v_{tfdt}\\right)"
    );
    // `\tan` and the `t` inside `v_{tfdp}` must survive untouched.
    expect(
      renameIdentifier("\\tan\\left(t\\right)+v_{tfdp}", "t", "v_{tfdt}")
    ).toBe("\\tan\\left(v_{tfdt}\\right)+v_{tfdp}");
    // A name that is not there is not a rewrite.
    expect(renameIdentifier("x+y", "t", "v_{tfdt}")).toBe("x+y");
  });

  test("renames every occurrence, not just the first", () => {
    expect(renameIdentifier("t+t\\cdot t", "t", "s")).toBe("s+s\\cdot s");
  });

  test("survives the LaTeX MathQuill actually produces", () => {
    // Escaped braces and spaces must not throw the walker off by a character,
    // which would corrupt every name after them.
    const latex = "\\left\\{t>0\\right\\}\\ t";
    expect(mentions(latex, "t")).toBe(true);
    expect(renameIdentifier(latex, "t", "s")).toBe(
      "\\left\\{s>0\\right\\}\\ s"
    );
  });
});
