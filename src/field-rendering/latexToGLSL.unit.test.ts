import { compileFieldComponentToGLSL } from "./latexToGLSL";

/**
 * The compiled GLSL is only correct if it evaluates to the same numbers as the
 * LaTeX does, so the tests translate the GLSL back into JavaScript and compare
 * against a hand-written reference at several sample points. This catches
 * precedence and implicit-multiplication mistakes that a string comparison
 * would happily wave through.
 */
function evaluate(glsl: string, x: number, y: number): number {
  const js = glsl
    .replace(/\bp\.x\b/g, "(__x)")
    .replace(/\bp\.y\b/g, "(__y)")
    .replace(/\bvtDiv\(/g, "__div(")
    .replace(/\bvtPow\(/g, "__pow(")
    .replace(/\bvtCot\(/g, "__cot(")
    .replace(/\bvtSec\(/g, "__sec(")
    .replace(/\bvtCsc\(/g, "__csc(")
    .replace(/\bvtLog10\(/g, "__log10(")
    .replace(/\bvtMod\(/g, "__mod(")
    .replace(
      /\b(sin|cos|tan|asin|acos|atan|sinh|cosh|tanh|exp|log|sqrt|abs|sign|floor|ceil|min|max|mod)\(/g,
      "__$1("
    );
  const scope = {
    __div: (a: number, b: number) =>
      a / (Math.abs(b) < 1e-12 ? (b < 0 ? -1e-12 : 1e-12) : b),
    __pow: (a: number, b: number) => Math.pow(a, b),
    __cot: (a: number) => Math.cos(a) / Math.sin(a),
    __sec: (a: number) => 1 / Math.cos(a),
    __csc: (a: number) => 1 / Math.sin(a),
    __log10: (a: number) => Math.log10(a),
    __mod: (a: number, b: number) => (b === 0 ? 0 : ((a % b) + b) % b),
    __sin: Math.sin,
    __cos: Math.cos,
    __tan: Math.tan,
    __asin: Math.asin,
    __acos: Math.acos,
    __atan: (a: number, b?: number) =>
      b === undefined ? Math.atan(a) : Math.atan2(a, b),
    __sinh: Math.sinh,
    __cosh: Math.cosh,
    __tanh: Math.tanh,
    __exp: Math.exp,
    __log: Math.log,
    __sqrt: Math.sqrt,
    __abs: Math.abs,
    __sign: Math.sign,
    __floor: Math.floor,
    __ceil: Math.ceil,
    __min: Math.min,
    __max: Math.max,
    __mod2: (a: number, b: number) => a % b,
    __clamp: (v: number, lo: number, hi: number) =>
      Math.min(hi, Math.max(lo, v)),
  };
  const names = [...Object.keys(scope), "clamp", "__x", "__y"];
  const values = [...Object.values(scope), scope.__clamp, x, y];
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  return new Function(...names, `return (${js});`)(...values) as number;
}

function compiled(latex: string) {
  const result = compileFieldComponentToGLSL(latex);
  if (!result.ok) throw new Error(`expected success, got: ${result.error}`);
  return result.glsl;
}

const SAMPLES: readonly [number, number][] = [
  [1, 0],
  [0, 1],
  [-2, 3],
  [0.5, -1.25],
  [3, 4],
];

function expectMatches(
  latex: string,
  reference: (x: number, y: number) => number
) {
  const glsl = compiled(latex);
  for (const [x, y] of SAMPLES) {
    const expected = reference(x, y);
    // Singularities are deliberately clamped rather than propagated as
    // infinities, so there is nothing to compare there.
    if (!Number.isFinite(expected)) continue;
    expect(evaluate(glsl, x, y)).toBeCloseTo(expected, 6);
  }
}

describe("LaTeX to GLSL field compiler", () => {
  test("handles the built-in presets", () => {
    expectMatches("-y", (_x, y) => -y);
    expectMatches("x", (x) => x);
    expectMatches("\\sin\\left(y\\right)", (_x, y) => Math.sin(y));
    expectMatches("\\cos\\left(x\\right)", (x) => Math.cos(x));
    expectMatches(
      "-y/\\left(1+x^2+y^2\\right)",
      (x, y) => -y / (1 + x * x + y * y)
    );
    expectMatches("10x", (x) => 10 * x);
  });

  test("respects precedence, implicit multiplication, and unary minus", () => {
    expectMatches("2+3x", (x) => 2 + 3 * x);
    expectMatches("2x+3y", (x, y) => 2 * x + 3 * y);
    expectMatches("xy", (x, y) => x * y);
    expectMatches("-2xy", (x, y) => -2 * x * y);
    expectMatches("x-y", (x, y) => x - y);
    expectMatches("2\\cdot3x", (x) => 6 * x);
    expectMatches("x^2y", (x, y) => x * x * y);
    expectMatches("2\\left(x+y\\right)", (x, y) => 2 * (x + y));
    expectMatches("x\\left(y+1\\right)", (x, y) => x * (y + 1));
  });

  test("handles fractions, roots, powers, and absolute value", () => {
    expectMatches("\\frac{x}{y+3}", (x, y) => x / (y + 3));
    expectMatches("\\sqrt{x^2+y^2}", (x, y) => Math.sqrt(x * x + y * y));
    expectMatches("x^{3}", (x) => x ** 3);
    expectMatches("x^{-2}", (x) => 1 / (x * x));
    expectMatches("x^{0}", () => 1);
    expectMatches("\\left|y\\right|", (_x, y) => Math.abs(y));
    expectMatches("2^{x}", (x) => 2 ** x);
  });

  test("handles function calls in both Desmos spellings", () => {
    expectMatches("\\arctan\\left(y,x\\right)", (x, y) => Math.atan2(y, x));
    expectMatches("\\operatorname{sign}\\left(x\\right)", (x) => Math.sign(x));
    expectMatches(
      "\\operatorname{mod}\\left(x,3\\right)",
      (x) => ((x % 3) + 3) % 3
    );
    expectMatches("\\max\\left(x,y\\right)", (x, y) => Math.max(x, y));
    expectMatches("\\sin x", (x) => Math.sin(x));
    expectMatches("\\ln\\left(x^2+1\\right)", (x) => Math.log(x * x + 1));
    expectMatches("e^{x}", (x) => Math.E ** x);
    expectMatches("\\pi y", (_x, y) => Math.PI * y);
  });

  test("guards against division by zero instead of producing infinities", () => {
    const glsl = compiled("\\frac{1}{x}");
    expect(Number.isFinite(evaluate(glsl, 0, 0))).toBe(true);
  });

  test("explains what it cannot translate", () => {
    const cases: readonly [string, string][] = [
      ["a_{1}x", "is not defined"],
      ["\\int_{0}^{1}x", "not supported"],
      ["y=x", "not an equation"],
      ["\\left\\{x>0\\right\\}", "not supported"],
      ["z", "is not defined"],
      ["\\sin\\left(x", "closing parenthesis"],
      ["\\operatorname{lcm}\\left(x,y\\right)", "not supported"],
      ["\\arctan\\left(x,y,1\\right)", "cannot take 3 arguments"],
    ];
    for (const [latex, fragment] of cases) {
      const result = compileFieldComponentToGLSL(latex);
      expect([latex, result.ok]).toEqual([latex, false]);
      if (!result.ok)
        expect([latex, result.error]).toEqual([
          latex,
          expect.stringContaining(fragment),
        ]);
    }
  });
});

/** An environment of the kind the plugin reads out of the expression list. */
function environment(
  scalars: readonly string[],
  functions: Record<string, [string[], string]> = {}
) {
  return {
    scalars: new Set(scalars),
    functions: new Map(
      Object.entries(functions).map(([name, [params, latex]]) => [
        name,
        { params, latex },
      ])
    ),
  };
}

describe("Vector Tools LaTeX referencing the expression list", () => {
  test("a named value becomes a uniform rather than a literal", () => {
    // Baking the value in would mean recompiling and relinking both shader
    // programs on every frame of a slider drag, which is the cost the renderer
    // went to some trouble to stop paying.
    const result = compileFieldComponentToGLSL(
      "ax+by",
      environment(["a", "b"])
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect([...result.params].sort()).toEqual(["a", "b"]);
    expect(result.glsl).toContain("u_vp_a");
    expect(result.glsl).toContain("u_vp_b");
    expect(result.helpers).toHaveLength(0);
  });

  test("both spellings of a subscript are the same name", () => {
    // MathQuill writes `a_{1}` and a hand-typed expression may write `a_1`. If
    // these disagreed, a field would reference a slider that the environment
    // holds under the other spelling and report it undefined.
    for (const latex of ["a_{1}x", "a_1x"]) {
      const result = compileFieldComponentToGLSL(latex, environment(["a_1"]));
      expect([latex, result.ok]).toEqual([latex, true]);
      if (result.ok) expect(result.params).toEqual(["a_1"]);
    }
  });

  test("a definition becomes a GLSL function, called once per use", () => {
    const result = compileFieldComponentToGLSL(
      "f\\left(x\\right)+f\\left(y\\right)",
      environment([], { f: [["u"], "u^2+1"] })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Compiled once however many times it is called: a body that uses its
    // argument twice would otherwise duplicate the argument at every call.
    expect(result.helpers).toHaveLength(1);
    expect(result.helpers[0].name).toBe("f");
    expect(result.helpers[0].glsl).toContain("float vtu_f(vec2 p, float vl_u)");
    expect(result.glsl).toBe("(vtu_f(p, p.x) + vtu_f(p, p.y))");
  });

  test("a definition may use the coordinates, and may call another", () => {
    const result = compileFieldComponentToGLSL(
      "g\\left(2\\right)",
      environment([], { g: [["u"], "uf\\left(x\\right)"], f: [["v"], "v+y"] })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Dependencies first, so the shader can emit them in the order given.
    expect(result.helpers.map((helper) => helper.name)).toEqual(["f", "g"]);
    expect(result.helpers[0].glsl).toContain("p.y");
    expect(result.helpers[1].glsl).toContain("vtu_f(p, p.x)");
  });

  test("refuses a definition that leads back to itself", () => {
    // A shader has no call stack, so this cannot be compiled at all — and the
    // failure to catch it is a hang or a driver crash, not a wrong picture.
    const cases: Record<string, [string[], string]>[] = [
      // Straight self-reference, and the mutual pair that a single-name guard
      // would miss.
      { f: [["u"], "f\\left(u\\right)+1"] },
      { f: [["u"], "g\\left(u\\right)"], g: [["u"], "f\\left(u\\right)"] },
    ];
    for (const functions of cases) {
      const result = compileFieldComponentToGLSL(
        "f\\left(x\\right)",
        environment([], functions)
      );
      expect(result.ok).toBe(false);
      if (!result.ok)
        expect(result.error).toContain("defined in terms of itself");
    }
  });

  test("refuses a call with the wrong number of arguments", () => {
    const result = compileFieldComponentToGLSL(
      "f\\left(x,y\\right)",
      environment([], { f: [["u"], "u"] })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("takes 1 argument");
  });

  test("names what it could not translate inside a definition", () => {
    // The point of naming it is that the user can see which definition in the
    // graph is the one the shader cannot follow.
    const result = compileFieldComponentToGLSL(
      "f\\left(x\\right)",
      environment([], { f: [["u"], "\\sum_{n=1}^{3}u"] })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("not supported");
  });

  test("a value used by a definition is still reported to the caller", () => {
    // The uniform is declared once for the whole shader, so a name reached only
    // from inside a helper still has to reach the list the renderer uploads.
    const result = compileFieldComponentToGLSL(
      "f\\left(x\\right)",
      environment(["k"], { f: [["u"], "ku"] })
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.params).toEqual(["k"]);
  });
});
