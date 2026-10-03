import { canonicalIdentifier } from "../identifiers";
import { EMPTY_ENVIRONMENT, type FieldEnvironment } from "../latexToGLSL";
import { CellKind, compileObstacle, rasterizeObstacles } from "./obstacles";
import { compileExpression, desmosPow } from "./strictEvaluate";
import { parseStrictExpression } from "./strictParse";
import {
  DESMOS_POWER_PROBES,
  DESMOS_PROBES,
  DESMOS_SNAPS,
  PROBE_SLIDERS,
  type ProbeValue,
} from "./strictSemantics.fixtures";

const sliderEnv: FieldEnvironment = {
  functions: new Map(),
  scalars: new Set(PROBE_SLIDERS.map(([name]) => canonicalIdentifier(name))),
};
const sliderValues = new Map(
  PROBE_SLIDERS.map(([name, value]) => [canonicalIdentifier(name), value])
);

function evaluateConstant(latex: string, degreeMode: boolean): number {
  const parsed = parseStrictExpression(latex, sliderEnv);
  if (!parsed.ok) throw new Error(`${latex}: ${parsed.error}`);
  const compiled = compileExpression(parsed.expr, parsed.program, {
    degreeMode,
  });
  return compiled({ x: NaN, y: NaN, time: 0, params: sliderValues }, []);
}

function matches(actual: number, expected: ProbeValue) {
  if (expected === "NaN") return Number.isNaN(actual);
  if (expected === "Infinity") return actual === Infinity;
  if (expected === "-Infinity") return actual === -Infinity;
  if (expected === 0) return actual === 0;
  return Math.abs(actual - expected) <= 1e-12 * Math.abs(expected);
}

describe("the strict evaluator computes what live Desmos computes", () => {
  // Factorial is Γ(x + 1) in Desmos, and solids refuse it until there is a
  // tested Gamma for the GPU; the refusal itself is tested below.
  const isFactorial = (latex: string) => latex.includes("!");
  const cases = DESMOS_PROBES.filter(
    ([latex]) => !DESMOS_SNAPS.has(latex) && !isFactorial(latex)
  );

  test.each(cases)("%s", (latex, radian, degree) => {
    const inRadians = evaluateConstant(latex, false);
    const inDegrees = evaluateConstant(latex, true);
    expect({ inRadians, ok: matches(inRadians, radian) }).toEqual({
      inRadians,
      ok: true,
    });
    expect({ inDegrees, ok: matches(inDegrees, degree) }).toEqual({
      inDegrees,
      ok: true,
    });
  });

  test("the cases Desmos snaps to an exact value are the only exceptions", () => {
    // tan(π/2) is infinite in Desmos and merely huge in doubles. Every other
    // probe has to match, so this list cannot quietly grow.
    expect(DESMOS_SNAPS.size).toBe(3);
    expect(evaluateConstant(String.raw`\tan(\frac{\pi}{2})`, false)).toBe(
      Math.tan(Math.PI / 2)
    );
  });
});

describe("a negative base to a fractional power", () => {
  test.each(DESMOS_POWER_PROBES)(
    "(−8)^%s and (−2)^%s as Desmos measured them",
    (_label, exponent, minusEight, minusTwo) => {
      expect(matches(desmosPow(-8, exponent), minusEight)).toBe(true);
      expect(matches(desmosPow(-2, exponent), minusTwo)).toBe(true);
    }
  );

  test("an undefined base stays undefined even to the power 0", () => {
    expect(desmosPow(NaN, 0)).toBeNaN();
    expect(desmosPow(Infinity, 0)).toBe(1);
  });
});

const at = (x: number, y: number, params = new Map<string, number>()) => ({
  x,
  y,
  time: 0,
  params,
});

function obstacle(latex: string, env: FieldEnvironment = EMPTY_ENVIRONMENT) {
  const result = compileObstacle(latex, env, { degreeMode: false });
  if (!result.ok) throw new Error(`${latex}: ${result.error}`);
  return result.obstacle;
}

describe("an obstacle is exactly the region Desmos shades", () => {
  test("a disc, with its boundary per the inequality's strictness", () => {
    const closed = obstacle(String.raw`x^{2}+y^{2}\le1`);
    const open = obstacle(String.raw`x^{2}+y^{2}<1`);
    expect(closed.contains(at(0, 0))).toBe(true);
    expect(closed.contains(at(1, 0))).toBe(true);
    expect(open.contains(at(1, 0))).toBe(false);
    expect(closed.contains(at(1.01, 0))).toBe(false);
  });

  test("undefined is never solid, so y < √x has no wall where x < 0", () => {
    const region = obstacle(String.raw`y<\sqrt{x}`);
    expect(region.contains(at(-2, -5))).toBe(false);
    expect(region.signed(at(-2, -5))).toBeNaN();
    expect(region.contains(at(4, 1))).toBe(true);
    // The visual compiler's sqrt(max(x, 0)) would say 0 here, and -5 < 0.
  });

  test("a restriction clips the region, and its edge is a wall", () => {
    const half = obstacle(String.raw`x^{2}+y^{2}\le4\left\{x>0\right\}`);
    expect(half.contains(at(1, 0))).toBe(true);
    expect(half.contains(at(-1, 0))).toBe(false);
    // Read as a product, 4·{x > 0} is undefined for x < 0, which would leave
    // the cut face with no wall. As a restriction, x = 0 is the wall.
    expect(half.signed(at(-1, 0))).toBe(1);
    expect(half.signed(at(0.5, 0))).toBeLessThan(0);
  });

  test("two restrictions must both hold; commas inside one mean either", () => {
    const both = obstacle(String.raw`y<5\left\{x>0\right\}\left\{y>0\right\}`);
    const either = obstacle(String.raw`y<5\left\{x>0,y>0\right\}`);
    expect(both.contains(at(1, -1))).toBe(false);
    expect(either.contains(at(1, -1))).toBe(true);
    expect(either.contains(at(-1, 1))).toBe(true);
    expect(either.contains(at(-1, -1))).toBe(false);
  });

  test("a chain is a band", () => {
    const band = obstacle(String.raw`-1<y\le2`);
    expect(band.contains(at(0, -1))).toBe(false);
    expect(band.contains(at(0, 2))).toBe(true);
    expect(band.contains(at(9, 0))).toBe(true);
  });

  test("sliders, definitions and the clock are read as Desmos reads them", () => {
    const env: FieldEnvironment = {
      functions: new Map([
        ["f", { params: ["u"], latex: String.raw`\left|u\right|-r` }],
      ]),
      scalars: new Set(["r"]),
    };
    const region = obstacle(String.raw`y<f\left(x-t\right)`, env);
    expect(region.params).toEqual(["r"]);
    expect(region.usesTime).toBe(true);
    const r = new Map([["r", 1]]);
    expect(region.contains({ x: 3, y: 0, time: 0, params: r })).toBe(true);
    expect(region.contains({ x: 3, y: 0, time: 3, params: r })).toBe(false);
    // A missing slider value is undefined, so not solid.
    expect(region.contains({ x: 3, y: 0, time: 0, params: new Map() })).toBe(
      false
    );
  });

  test("degree mode turns circular trig, and only circular trig", () => {
    const result = compileObstacle(String.raw`y<\sin(x)`, EMPTY_ENVIRONMENT, {
      degreeMode: true,
    });
    if (!result.ok) throw new Error(result.error);
    expect(result.obstacle.contains(at(90, 0.999))).toBe(true);
    expect(result.obstacle.contains(at(90, 1.001))).toBe(false);
  });

  test("the signed function agrees with membership wherever both are defined", () => {
    const cases = [
      String.raw`x^{2}+y^{2}\le1`,
      String.raw`y>\sin\left(x\right)`,
      String.raw`-1<y\le2`,
      String.raw`x^{2}+y^{2}\le4\left\{x>0,y>0\right\}`,
      String.raw`y<\sqrt{x}`,
      String.raw`\left|x\right|+\left|y\right|<\frac{3}{2}\left\{y<\ln\left(x+2\right)\right\}`,
    ];
    let seed = 7;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return (seed / 2147483648) * 8 - 4;
    };
    for (const latex of cases) {
      const region = obstacle(latex);
      for (let n = 0; n < 2000; n++) {
        const point = at(random(), random());
        const signed = region.signed(point);
        if (region.contains(point)) {
          expect({ latex, signed: signed <= 0 }).toEqual({
            latex,
            signed: true,
          });
        } else if (!Number.isNaN(signed)) {
          expect({ latex, signed: signed >= 0 }).toEqual({
            latex,
            signed: true,
          });
        }
      }
    }
  });
});

describe("what is not a solid says why", () => {
  const error = (latex: string, env = EMPTY_ENVIRONMENT) => {
    const result = compileObstacle(latex, env, { degreeMode: false });
    return result.ok ? "compiled" : result.error;
  };

  test.each([
    [String.raw`y=x^{2}`, /equation draws a curve/],
    [String.raw`x^{2}+y^{2}`, /not a region/],
    [String.raw`y<a`, /"a" is not defined/],
    [String.raw`y<\operatorname{erf}(x)`, /"erf" is not supported/],
    [String.raw`y<x!`, /"!" is not supported/],
    [String.raw`\left\{x>0\right\}`, /needs an inequality in front/],
  ])("%s", (latex, message) => {
    expect(error(latex)).toMatch(message);
  });
});

describe("rasterizing a tank", () => {
  test("cell centres are classified as solid, fluid or undefined", () => {
    const grid = { xMin: -2, xMax: 2, yMin: -1, yMax: 1, nx: 40, ny: 20 };
    const scope = { time: 0, params: new Map<string, number>() };
    const disc = obstacle(String.raw`x^{2}+y^{2}\le0.25`);
    const { cells, solidCount, undefinedCount } = rasterizeObstacles(
      [disc],
      grid,
      scope
    );
    // A disc of radius 0.5 on 0.1 cells: about π·25 ≈ 79 centres.
    expect(solidCount).toBeGreaterThan(70);
    expect(solidCount).toBeLessThan(90);
    expect(undefinedCount).toBe(0);
    expect(cells[10 * 40 + 20]).toBe(CellKind.Solid);

    const root = obstacle(String.raw`y<\sqrt{x}`);
    const rooted = rasterizeObstacles([root], grid, scope);
    // The left half has no defined boundary: undefined, never solid.
    expect(rooted.undefinedCount).toBe(20 * 20);
  });
});
