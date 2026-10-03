import { testWithPageAndOpts, type Driver } from "#tests";
import type { Calc as CalcType } from "#globals";
import { canonicalIdentifier } from "../identifiers";
import { glslParamName, type FieldEnvironment } from "../latexToGLSL";
import { compileObstacle } from "./obstacles";
import { compileExpression } from "./strictEvaluate";
import { emitExpressionGLSL, STRICT_GLSL_PRELUDE } from "./strictGLSL";
import { parseStrictExpression } from "./strictParse";
import {
  DESMOS_POWER_PROBES,
  DESMOS_PROBES,
  DESMOS_SNAPS,
  PROBE_SLIDERS,
} from "./strictSemantics.fixtures";

declare let Calc: CalcType;

/** `HelperExpression` as Desmos ships it; the typings omit `unobserve`. */
interface ObservableHelper {
  numericValue: number;
  observe: (event: string, callback: () => void) => void;
  unobserve: (event: string) => void;
}

/**
 * Three ways of computing one thing, held to each other: live Desmos, the CPU
 * evaluator, and the GLSL the GPU will run. The fixture file is a record of
 * what Desmos said once; this asks it again, so that a Desmos release that
 * changes an edge case fails here before it moves a wall in somebody's tank.
 */

const sliderEnv: FieldEnvironment = {
  functions: new Map(),
  scalars: new Set(PROBE_SLIDERS.map(([name]) => canonicalIdentifier(name))),
};
const sliderValues = new Map(
  PROBE_SLIDERS.map(([name, value]) => [canonicalIdentifier(name), value])
);

/** Desmos's own value for each LaTeX, through `HelperExpression`. */
async function desmosValues(
  driver: Driver,
  latexes: readonly string[],
  degreeMode: boolean
): Promise<(number | string)[]> {
  return await driver.page.evaluate(
    async (
      latexes: string[],
      degreeMode: boolean,
      sliders: [string, number][]
    ) => {
      Calc.setBlank();
      Calc.updateSettings({ degreeMode });
      Calc.setExpressions(
        sliders.map(([name, value], i) => ({
          id: `slider${i}`,
          latex: `${name}=${value.toPrecision(17)}`,
        }))
      );
      const read = async (latex: string) =>
        await new Promise<number>((resolve) => {
          const helper = Calc.HelperExpression({
            latex,
          }) as unknown as ObservableHelper;
          let settled = false;
          const finish = () => {
            if (settled) return;
            settled = true;
            helper.unobserve("numericValue");
            resolve(helper.numericValue);
          };
          helper.observe("numericValue", () => setTimeout(finish, 20));
          setTimeout(finish, 4000);
        });
      const out: (number | string)[] = [];
      for (const latex of latexes) {
        const value = await read(latex);
        out.push(Number.isFinite(value) ? value : String(value));
      }
      Calc.setBlank();
      Calc.updateSettings({ degreeMode: false });
      return out;
    },
    [...latexes],
    degreeMode,
    PROBE_SLIDERS.map(([n, v]) => [n, v] as [string, number])
  );
}

function cpuValue(latex: string, degreeMode: boolean): number {
  const parsed = parseStrictExpression(latex, sliderEnv);
  if (!parsed.ok) throw new Error(`${latex}: ${parsed.error}`);
  return compileExpression(parsed.expr, parsed.program, { degreeMode })(
    { x: NaN, y: NaN, time: 0, params: sliderValues },
    []
  );
}

const asText = (v: number) => (Number.isFinite(v) ? v : String(v));

function sameDouble(cpu: number, desmos: number | string) {
  if (typeof desmos === "string") return String(cpu) === desmos;
  if (desmos === 0) return cpu === 0;
  return Math.abs(cpu - desmos) <= 1e-12 * Math.abs(desmos);
}

/**
 * Float32 against a double: the same special value, or close. "Close" is 10⁻⁴
 * relative because GLSL leaves the accuracy of its built-ins to the driver,
 * and the Intel driver's acos(0.5) is 4·10⁻⁵ out. That is a wall misplaced by a
 * ten-thousandth of its distance from the origin, far inside one cell; what
 * this test exists to catch is a wrong special value, which is exact.
 */
function sameFloat(gpu: number, ok: boolean, desmos: number | string) {
  if (desmos === "NaN") return !ok;
  if (!ok) return false;
  if (desmos === "Infinity") return gpu === Infinity;
  if (desmos === "-Infinity") return gpu === -Infinity;
  const expected = desmos as number;
  return Math.abs(gpu - expected) <= 1e-4 * Math.abs(expected) + 1e-6;
}

/**
 * Renders one RGBA32F pixel per sample and reads them back: the fragment's
 * `main` decides what each pixel holds.
 */
async function runFragment(
  driver: Driver,
  source: string,
  width: number,
  height: number,
  uniforms: Record<string, number>
): Promise<number[] | { error: string }> {
  return await driver.page.evaluate(
    (
      source: string,
      width: number,
      height: number,
      uniforms: Record<string, number>
    ) => {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl2");
      if (!gl) return { error: "no WebGL2" };
      if (!gl.getExtension("EXT_color_buffer_float"))
        return { error: "no EXT_color_buffer_float" };
      const compile = (type: number, text: string) => {
        const shader = gl.createShader(type)!;
        gl.shaderSource(shader, text);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
          throw new Error(gl.getShaderInfoLog(shader) ?? "compile failed");
        return shader;
      };
      try {
        const program = gl.createProgram();
        gl.attachShader(
          program,
          compile(
            gl.VERTEX_SHADER,
            `#version 300 es
void main() {
  vec2 corner = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}`
          )
        );
        gl.attachShader(program, compile(gl.FRAGMENT_SHADER, source));
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS))
          return { error: gl.getProgramInfoLog(program) ?? "link failed" };
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, width, height);
        const framebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.framebufferTexture2D(
          gl.FRAMEBUFFER,
          gl.COLOR_ATTACHMENT0,
          gl.TEXTURE_2D,
          texture,
          0
        );
        gl.viewport(0, 0, width, height);
        gl.useProgram(program);
        for (const [name, value] of Object.entries(uniforms)) {
          gl.uniform1f(gl.getUniformLocation(program, name), value);
        }
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        const pixels = new Float32Array(width * height * 4);
        gl.readPixels(0, 0, width, height, gl.RGBA, gl.FLOAT, pixels);
        gl.getExtension("WEBGL_lose_context")?.loseContext();
        return Array.from(pixels);
      } catch (error) {
        return { error: String(error) };
      }
    },
    source,
    width,
    height,
    uniforms
  );
}

const sliderUniforms = Object.fromEntries(
  PROBE_SLIDERS.map(([name, value]) => [
    glslParamName(canonicalIdentifier(name)),
    value,
  ])
);

function fragmentHeader(uniformNames: readonly string[]) {
  return `#version 300 es
precision highp float;
precision highp int;
uniform float u_time;
${uniformNames.map((name) => `uniform float ${name};`).join("\n")}
out vec4 outColor;
${STRICT_GLSL_PRELUDE}`;
}

const probeCases = DESMOS_PROBES.filter(
  ([latex]) => !DESMOS_SNAPS.has(latex) && !latex.includes("!")
).map(([latex]) => latex);

testWithPageAndOpts(
  "strict geometry: the CPU evaluator matches live Desmos on every edge case",
  { timeout: 240000 },
  async (driver) => {
    const mismatches: string[] = [];
    for (const degreeMode of [false, true]) {
      const desmos = await desmosValues(driver, probeCases, degreeMode);
      probeCases.forEach((latex, i) => {
        const cpu = cpuValue(latex, degreeMode);
        if (!sameDouble(cpu, desmos[i])) {
          mismatches.push(
            `${degreeMode ? "deg" : "rad"} ${latex}: Desmos ${desmos[i]}, CPU ${asText(cpu)}`
          );
        }
      });
    }
    expect(mismatches).toEqual([]);
  }
);

testWithPageAndOpts(
  "strict geometry: the rational-exponent rule is still Desmos's",
  { timeout: 240000 },
  async (driver) => {
    const live = await driver.page.evaluate(
      async (exponents: number[]) => {
        Calc.setBlank();
        const read = async (latex: string) =>
          await new Promise<number>((resolve) => {
            const helper = Calc.HelperExpression({
              latex,
            }) as unknown as ObservableHelper;
            let settled = false;
            const finish = () => {
              if (settled) return;
              settled = true;
              helper.unobserve("numericValue");
              resolve(helper.numericValue);
            };
            helper.observe("numericValue", () => setTimeout(finish, 20));
            setTimeout(finish, 4000);
          });
        const out: (number | string)[] = [];
        for (const a of exponents) {
          Calc.setExpression({ id: "a", latex: `a=${a.toPrecision(17)}` });
          await new Promise((resolve) => setTimeout(resolve, 40));
          const v = await read("(-8)^{a}");
          out.push(Number.isFinite(v) ? v : String(v));
        }
        Calc.setBlank();
        return out;
      },
      DESMOS_POWER_PROBES.map(([, exponent]) => exponent)
    );
    const mismatches: string[] = [];
    DESMOS_POWER_PROBES.forEach(([label, exponent], i) => {
      const cpu = cpuValue(
        String.raw`(-8)^{${exponent.toPrecision(17)}}`,
        false
      );
      if (!sameDouble(cpu, live[i])) {
        mismatches.push(`${label}: Desmos ${live[i]}, CPU ${asText(cpu)}`);
      }
    });
    expect(mismatches).toEqual([]);
  }
);

testWithPageAndOpts(
  "strict geometry: the GLSL computes what Desmos computes, in float32",
  { timeout: 120000 },
  async (driver) => {
    for (const degreeMode of [false, true]) {
      const desmosRows = DESMOS_PROBES.filter(([latex]) =>
        probeCases.includes(latex)
      ).map(
        ([latex, radian, degree]) =>
          [latex, degreeMode ? degree : radian] as const
      );
      const functions = desmosRows.map(([latex], i) => {
        const parsed = parseStrictExpression(latex, sliderEnv);
        if (!parsed.ok) throw new Error(`${latex}: ${parsed.error}`);
        return emitExpressionGLSL(
          parsed.expr,
          parsed.program,
          { degreeMode },
          `probe${i}`
        );
      });
      const dispatch = desmosRows
        .map((_, i) => `  if (k == ${i}) { v = probe${i}(p, ok); }`)
        .join("\n");
      const width = 16;
      const height = Math.ceil(desmosRows.length / width);
      const source = `${fragmentHeader(Object.keys(sliderUniforms))}
${functions.join("\n")}
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  int k = c.y * ${width} + c.x;
  vec2 p = vec2(0.0);
  bool ok = false;
  float v = 0.0;
${dispatch}
  // Infinity cannot be trusted to survive a float target's blending or a
  // driver's flush, so it travels as a flag beside a finite value.
  outColor = vec4(vsIsInf(v) ? 0.0 : v, ok ? 1.0 : 0.0, vsIsInf(v) ? sign(v) : 0.0, 1.0);
}`;
      const pixels = await runFragment(driver, source, width, height, {
        u_time: 0,
        ...sliderUniforms,
      });
      if (!Array.isArray(pixels)) throw new Error(pixels.error);
      const mismatches: string[] = [];
      desmosRows.forEach(([latex, expected], i) => {
        const [value, ok, inf] = pixels.slice(i * 4, i * 4 + 3);
        const gpu = inf !== 0 ? inf * Infinity : value;
        if (!sameFloat(gpu, ok === 1, expected)) {
          mismatches.push(
            `${degreeMode ? "deg" : "rad"} ${latex}: Desmos ${expected}, GPU ${ok === 1 ? gpu : "undefined"}`
          );
        }
      });
      expect(mismatches).toEqual([]);
    }
  }
);

/**
 * An exponent within a few float32 roundings of an integer or of an
 * odd-denominator rational is that number on the GPU, because a float32
 * uniform cannot say otherwise. Desmos, in doubles, refuses `0.3333333`,
 * `1/3 + 10⁻⁹` and `2 + 10⁻¹²`. Those are the only rows the GPU may get wrong,
 * and they are listed rather than skipped.
 */
function float32RoundsToRational(exponent: number) {
  const r = Math.fround(exponent);
  if (Number.isInteger(r)) return !Number.isInteger(exponent);
  for (let q = 2; q <= 100; q++) {
    const p = Math.round(r * q);
    if (Math.abs(r * q - p) <= 4 * 1.1920929e-7 * Math.max(1, Math.abs(r * q)))
      return q % 2 === 1;
  }
  return false;
}

testWithPageAndOpts(
  "strict geometry: the GLSL power rule matches Desmos where float32 can tell",
  { timeout: 120000 },
  async (driver) => {
    const parsed = parseStrictExpression(String.raw`(-8)^{a}`, {
      functions: new Map(),
      scalars: new Set(["a"]),
    });
    if (!parsed.ok) throw new Error(parsed.error);
    const fn = emitExpressionGLSL(
      parsed.expr,
      parsed.program,
      { degreeMode: false },
      "power"
    );
    // The exponent reaches the shader as a slider's uniform, the way a real
    // obstacle's would, one draw per value.
    const results: { value: number; ok: boolean }[] = [];
    for (const [, exponent] of DESMOS_POWER_PROBES) {
      const single = `${fragmentHeader([glslParamName("a")])}
${fn}
void main() {
  bool ok;
  float v = power(vec2(0.0), ok);
  outColor = vec4(vsIsInf(v) ? 0.0 : v, ok ? 1.0 : 0.0, 0.0, 1.0);
}`;
      const pixels = await runFragment(driver, single, 1, 1, {
        u_time: 0,
        [glslParamName("a")]: exponent,
      });
      if (!Array.isArray(pixels)) throw new Error(pixels.error);
      results.push({ value: pixels[0], ok: pixels[1] === 1 });
    }
    const mismatches: string[] = [];
    const divergent: string[] = [];
    DESMOS_POWER_PROBES.forEach(([label, exponent, minusEight], i) => {
      const { value, ok } = results[i];
      if (sameFloat(value, ok, minusEight)) return;
      if (minusEight === "NaN" && float32RoundsToRational(exponent)) {
        divergent.push(label);
        return;
      }
      mismatches.push(
        `${label}: Desmos ${minusEight}, GPU ${ok ? value : "undefined"}`
      );
    });
    expect(mismatches).toEqual([]);
    // The known float32 cases: a decimal 1/3 to seven or more digits, and 1/3
    // plus anything float32 cannot resolve.
    expect(divergent).toEqual(
      DESMOS_POWER_PROBES.filter(
        ([, exponent, minusEight]) =>
          minusEight === "NaN" && float32RoundsToRational(exponent)
      ).map(([label]) => label)
    );
  }
);

testWithPageAndOpts(
  "strict geometry: GPU and CPU agree on which cells are solid",
  { timeout: 120000 },
  async (driver) => {
    const env: FieldEnvironment = {
      functions: new Map([
        ["f", { params: ["u"], latex: String.raw`\left|u\right|-r` }],
      ]),
      scalars: new Set(["r"]),
    };
    const cases = [
      String.raw`x^{2}+y^{2}\le1`,
      String.raw`y<\sqrt{x}`,
      String.raw`y>\sin\left(2x\right)+\frac{1}{x}`,
      String.raw`x^{2}+y^{2}\le4\left\{x>0,y>0\right\}`,
      String.raw`-1<y\le\ln\left(x+3\right)`,
      String.raw`y<f\left(x-t\right)`,
      String.raw`\left|x\right|^{\frac{1}{3}}+y^{\frac{2}{3}}<1.5`,
      String.raw`y<\left\{x<0:x^{2},\sqrt{x}\right\}`,
    ];
    const size = 64;
    const params = new Map([["r", 1.25]]);
    const time = 0.75;
    for (const latex of cases) {
      const result = compileObstacle(latex, env, { degreeMode: false }, "k");
      if (!result.ok) throw new Error(`${latex}: ${result.error}`);
      const { obstacle } = result;
      const source = `${fragmentHeader(obstacle.params.map(glslParamName))}
${obstacle.glsl.helpers.join("\n")}
${obstacle.glsl.solidFunction}
${obstacle.glsl.signedFunction}
void main() {
  vec2 p = (gl_FragCoord.xy / ${size}.0) * 8.0 - 4.0;
  bool ok;
  float s = vsSigned_k(p, ok);
  outColor = vec4(vsSolid_k(p) ? 1.0 : 0.0, ok ? s : 0.0, ok ? 1.0 : 0.0, 1.0);
}`;
      const pixels = await runFragment(driver, source, size, size, {
        u_time: time,
        ...Object.fromEntries(
          obstacle.params.map((name) => [
            glslParamName(name),
            params.get(name)!,
          ])
        ),
      });
      if (!Array.isArray(pixels)) throw new Error(`${latex}: ${pixels.error}`);
      let solidDisagreements = 0;
      let validityDisagreements = 0;
      let checked = 0;
      for (let j = 0; j < size; j++) {
        for (let i = 0; i < size; i++) {
          // The pixel centre the shader saw, rounded to float32 as it was.
          const x = Math.fround(((i + 0.5) / size) * 8 - 4);
          const y = Math.fround(((j + 0.5) / size) * 8 - 4);
          const scope = { x, y, time, params };
          const cpuSolid = obstacle.contains(scope);
          const cpuSigned = obstacle.signed(scope);
          const k = (j * size + i) * 4;
          const gpuSolid = pixels[k] === 1;
          const gpuOk = pixels[k + 2] === 1;
          // A point within float32 rounding of the wall may land either side.
          const nearWall =
            Number.isFinite(cpuSigned) && Math.abs(cpuSigned) < 1e-4;
          if (nearWall) continue;
          checked++;
          if (cpuSolid !== gpuSolid) solidDisagreements++;
          if (Number.isNaN(cpuSigned) === gpuOk) validityDisagreements++;
        }
      }
      expect({ latex, solidDisagreements, validityDisagreements }).toEqual({
        latex,
        solidDisagreements: 0,
        validityDisagreements: 0,
      });
      expect(checked).toBeGreaterThan(size * size * 0.9);
    }
  }
);
