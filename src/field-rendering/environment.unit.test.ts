import { environmentsDiffer, scanDefinitions } from "./environment";
import { compileFieldComponentToGLSL } from "./latexToGLSL";

const expr = (latex: string, id?: string) => ({
  type: "expression",
  latex,
  id,
});

describe("Vector Tools expression-list scan", () => {
  test("finds values and functions, in both paren spellings", () => {
    const env = scanDefinitions([
      expr("a=3"),
      expr("k_{1}=-2.5"),
      expr("f\\left(u\\right)=u^2"),
      expr("g(u,v)=u+v"),
    ]);
    expect([...env.scalars].sort()).toEqual(["a", "k_1"]);
    expect([...env.functions.keys()].sort()).toEqual(["f", "g"]);
    expect(env.functions.get("g")).toEqual({
      params: ["u", "v"],
      latex: "u+v",
    });
  });

  test("leaves the things that only look like definitions alone", () => {
    const env = scanDefinitions([
      // Curves, not definitions: these names already mean a coordinate.
      expr("x=3"),
      expr("y=x^2"),
      expr("r=\\theta"),
      // Not an equation at all.
      expr("a>1"),
      // An action, not a definition.
      expr("b\\to b+1"),
      // Nothing on the right.
      expr("c="),
      // A table column or other non-expression item.
      { type: "table", latex: "d=5" },
    ]);
    expect([...env.scalars]).toEqual([]);
    expect(env.functions.size).toBe(0);
  });

  test("skips the generated field's own helpers", () => {
    // Those helpers are built *from* the component, so a component referencing
    // one would be circular.
    const env = scanDefinitions(
      [
        expr("v_{tfdp}\\left(x,y\\right)=-y", "vector_tools_vf_default_p"),
        expr("m=4", "some_other_expression"),
      ],
      "vector_tools_vf_default"
    );
    expect(env.functions.size).toBe(0);
    expect([...env.scalars]).toEqual(["m"]);
  });

  test("a name cannot be both a value and a function", () => {
    // A graph containing both is already broken; what matters is that the
    // environment never claims both, because the compiler branches on it.
    const both = scanDefinitions([expr("f=2"), expr("f\\left(u\\right)=u")]);
    expect(both.functions.has("f")).toBe(true);
    expect(both.scalars.has("f")).toBe(false);

    const reversed = scanDefinitions([
      expr("f\\left(u\\right)=u"),
      expr("f=2"),
    ]);
    expect(reversed.functions.has("f")).toBe(true);
    expect(reversed.scalars.has("f")).toBe(false);
  });

  test("refuses a repeated parameter rather than guessing", () => {
    const env = scanDefinitions([expr("f\\left(u,u\\right)=u")]);
    expect(env.functions.size).toBe(0);
  });

  test("what it finds is what the compiler can use", () => {
    // The two halves have to agree on names, so this is the seam worth testing
    // directly rather than through two separate assertions about spelling.
    const env = scanDefinitions([
      expr("a_{1}=2"),
      expr("f\\left(u\\right)=a_{1}u"),
    ]);
    const result = compileFieldComponentToGLSL("f\\left(x\\right)+y", env);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.params).toEqual(["a_1"]);
    expect(result.helpers.map((helper) => helper.name)).toEqual(["f"]);
  });
});

describe("Vector Tools environment change detection", () => {
  test("a value changing its number is not a change here", () => {
    // Values are uniforms, so a slider moving must not relink a shader. This
    // scan only ever sees the name, which is what makes that true by
    // construction rather than by remembering to check.
    const before = scanDefinitions([expr("a=1")]);
    const after = scanDefinitions([expr("a=999")]);
    expect(environmentsDiffer(before, after)).toBe(false);
  });

  test("a definition's body changing is a change", () => {
    const before = scanDefinitions([expr("f\\left(u\\right)=u")]);
    const after = scanDefinitions([expr("f\\left(u\\right)=u^2")]);
    expect(environmentsDiffer(before, after)).toBe(true);
  });

  test("adding, removing or renaming is a change", () => {
    const base = scanDefinitions([expr("a=1")]);
    expect(environmentsDiffer(base, scanDefinitions([]))).toBe(true);
    expect(
      environmentsDiffer(base, scanDefinitions([expr("a=1"), expr("b=2")]))
    ).toBe(true);
    expect(environmentsDiffer(base, scanDefinitions([expr("b=1")]))).toBe(true);
  });

  test("a parameter being renamed is a change", () => {
    const before = scanDefinitions([expr("f\\left(u\\right)=1")]);
    const after = scanDefinitions([expr("f\\left(v\\right)=1")]);
    expect(environmentsDiffer(before, after)).toBe(true);
  });
});
