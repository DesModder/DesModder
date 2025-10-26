import { isIllegalASCIIMath, wolfram2desmos } from "./wolfram2desmos";

describe("Wolfram To Desmos (Default Config)", () => {
  function w2d(s: string): string {
    if (!isIllegalASCIIMath(s)) {
      return "illegal";
    }
    return wolfram2desmos(s, {
      reciprocalExponents2Surds: true,
      derivativeLoopLimit: false,
    });
  }
  const cases: [from: string, to: string][] = [
    ["abc", "abc"],
    ["\\left\\{x>y\\right\\}", "illegal"],
    ["{x>y}", "\\left\\{x>y\\right\\}"],
    ["φ^2", "\\phi^{2}"],
    ["ϕ^b", "\\phi^{b}"],
    ["2**3", "2^{3}"],
    ["sqrt(5)", "\\sqrt{5}"],
    ["cbrt(5)", "\\sqrt[3]{5}"],
    ["a/b", "\\frac{a}{b}"],
    ["5%3", "\\operatorname{mod}\\left(5,3\\right)"],
    ["infty", "∞"],
    ["infinity", "∞"],

    ["alpha+beta", "\\alpha+\\beta"],
    ["Delta=3", "\\Delta=3"],
    ["lambda^2", "\\lambda^{2}"],
    ["omega_0", "\\omega_{0}"],

    ["x>=y", "x≥y"],
    ["x<=y", "x≤y"],
    ["x!=y", "x≠y"],
    ["x->y", "x→y"],
    ["2×3", "2\\cdot 3"],
    ["2∙3", "2\\cdot 3"],
    ["a pm b", "a ± b"],
    ["10 20", "10 \\cdot 20"],

    ["sin(x)", "sin\\left(x\\right)"],
    ["cosh(x)", "cosh\\left(x\\right)"],
    ["tan^2(x)", "tan^{2}\\left(x\\right)"],
    ["arctan(y/x)", "arctan\\left(\\frac{y}{x}\\right)"],
    ["log(10,100)", "log_{10}\\left(100\\right)"],
    ["ln(x)", "ln\\left(x\\right)"],

    ["sqrt(a+b)", "\\sqrt{a+b}"],
    ["cbrt(x^2)", "\\sqrt[3]{x^{2}}"],
    ["x^(1/2)", "\\sqrt[2] {x}"],
    ["x^(1/3)", "\\sqrt[3] {x}"],

    ["(a+b)*(c+d)", "\\left(a+b\\right)\\cdot \\left(c+d\\right)"],
    ["{a,b,c}", "\\left\\{a,b,c\\right\\}"],
    ["[a,b]", "\\left[a,b\\right]"],
    ["|x|", "\\left|x\\right|"],
    ["abs(x+y)", "\\left|x+y\\right|"],

    ["(a+b)/(c+d)", "\\frac{a+b}{c+d}"],
    ["a/(b/c)", "\\frac{a}{\\frac{b}{c}}"],
    ["mod(7,3)", "\\operatorname{mod}\\left(7,3\\right)"],
    ["nCr(7,3)", "nCr\\left(7,3\\right)"],

    // !! Surprising output
    ["d/dx(xy)", "\\frac{d^{}}{dx^{}}\\left(xy\\right)"],
    // !! Surprising output
    ["d/dx(x^2)", "\\frac{d^{2}}{dx^{2}}\\left(x^{2}\\right)"],
    ["d^2/dx^2(x)", "\\frac{d^{2}}{dx^{2}}\\left(x\\right)"],

    ["sum_(i=1)^n i", "\\sum_{i=1}^{n} i"],
    ["prod_(k=1)^n k", "\\prod_{k=1}^{n} k"],
    ["int_0^t f(x)", "\\int_{0}^{t} f\\left(x\\right)"],

    ["floor(x)", "\\operatorname{floor}\\left(x\\right)"],
    ["ceiling(y)", "\\operatorname{ceil}\\left(y\\right)"],
    ["gcd(a,b)", "\\operatorname{gcf}\\left(a,b\\right)"],
    ["lcm(2,3)", "\\operatorname{lcm}\\left(2,3\\right)"],

    ["sin^2(theta)", "sin^{2}\\left(\\theta\\right)"],
    ["(sin(x))^2", "\\left(sin\\left(x\\right)\\right)^{2}"],
    [
      "sqrt(sin(x)^2 + cos(x)^2)",
      "\\sqrt{sin\\left(x\\right)^{2} + cos\\left(x\\right)^{2}}",
    ],

    ["|x+y|/z", "\\frac{\\left|x+y\\right|}{z}"],
    ["abs(x)/abs(y)", "\\frac{\\left|x\\right|}{\\left|y\\right|}"],

    ["x->infty", "x→∞"],
    ["1/infty", "\\frac{1}{∞}"],

    ["{x>y", "illegal"],
    ["x/y)", "illegal"],
    ["a//b", "illegal"],
    ["a\\b", "illegal"],
  ];
  for (const [from, expected] of cases) {
    const actual = w2d(from);
    test(`from ${JSON.stringify(from)}`, () => {
      expect(actual).toEqual(expected);
    });
  }
});

describe("Wolfram To Desmos (reciprocalExponents2Surds false)", () => {
  function w2d(s: string): string {
    if (!isIllegalASCIIMath(s)) {
      return "illegal";
    }
    return wolfram2desmos(s, {
      reciprocalExponents2Surds: false,
      derivativeLoopLimit: false,
    });
  }
  const cases: [from: string, to: string][] = [
    ["x^(1/2)", "x^{\\frac{1}{2}}"],
    ["x^(1/3)", "x^{\\frac{1}{3}}"],
  ];
  for (const [from, expected] of cases) {
    const actual = w2d(from);
    test(`from ${JSON.stringify(from)}`, () => {
      expect(actual).toEqual(expected);
    });
  }
});

describe("Wolfram To Desmos (derivativeLoopLimit true)", () => {
  function w2d(s: string): string {
    if (!isIllegalASCIIMath(s)) {
      return "illegal";
    }
    return wolfram2desmos(s, {
      reciprocalExponents2Surds: true,
      derivativeLoopLimit: true,
    });
  }
  const cases: [from: string, to: string][] = [
    ["d^2/dx^2(xy)", "\\frac{d}{dx}\\frac{d}{dx}\\left(xy\\right)"],
    // !! Surprising Output
    ["d/dx(x^2)", "\\frac{d}{dx}\\frac{d}{dx}\\left(x^{2}\\right)"],
  ];
  for (const [from, expected] of cases) {
    const actual = w2d(from);
    test(`from ${JSON.stringify(from)}`, () => {
      expect(actual).toEqual(expected);
    });
  }
});
