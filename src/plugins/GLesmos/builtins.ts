// reference https://www.khronos.org/registry/OpenGL-Refpages/gl4/index.php
// Test using https://www.desmos.com/calculator/2l2pnpsazy
export const builtins: {
  [K: string]:
    | undefined
    | {
        // alias: replace function call references to this
        alias?: string;
        // def: function definition
        def?: string;
        // deps: dependencies
        deps?: string[];
        // body is a just a more concise way to set def
        body?: string;
      };
} = {
  sin: {},
  cos: {},
  tan: {},
  cot: {
    body: "1.0/tan(x)",
  },
  sec: {
    body: "1.0/cos(x)",
  },
  csc: {
    body: "1.0/sin(x)",
  },
  arcsin: {
    alias: "asin",
  },
  arccos: {
    alias: "acos",
  },
  arctan: {
    def:
      `float arctan(float y_over_x) { return atan(y_over_x); }\n` +
      `float arctan(float y, float x) { return atan(y, x); }`,
  },
  arccot: {
    def: "float arccot(float x) { return atan(1.0, x); }",
  },
  arcsec: {
    body: "acos(1.0/x)",
  },
  arccsc: {
    body: "asin(1.0/x)",
  },
  sinh: {
    def: "float sinh(float x) { float a=abs(x); return -0.5*sign(x)*exp(a)*expm1(-2.0*a); }",
    deps: ["expm1"],
  },
  cosh: {
    body: "0.5*(exp(x)+exp(-x))",
  },
  tanh: {
    def: "float tanh(float x) { float m=expm1(-2.0*abs(x)); return -sign(x)*m/(2.0+m); }",
    deps: ["expm1"],
  },
  coth: {
    body: "1.0/tanh(x)",
    deps: ["tanh"],
  },
  sech: {
    body: "1.0/cosh(x)",
    deps: ["cosh"],
  },
  csch: {
    body: "1.0/sinh(x)",
    deps: ["sinh"],
  },
  arcsinh: {
    def: "float arcsinh(float x) { float a=abs(x); return sign(x) * (1.0+x*x==1.0 ? log1p(a) : log(a+rtxsqpone(a))); }",
    deps: ["log1p", "rtxsqpone"],
  },
  arccosh: {
    // should be NaN for x<1
    body: "log(x+rtxsqmone(x))",
    deps: ["rtxsqmone"],
  },
  arctanh: {
    body: "0.5*(log1p(x)-log1p(-x))",
    deps: ["log1p"],
  },
  arccoth: {
    body: "arctanh(1.0/x)",
    deps: ["arctanh"],
  },
  arcsech: {
    body: "arccosh(1.0/x)",
    deps: ["arccosh"],
  },
  arccsch: {
    body: "arcsinh(1.0/x)",
    deps: ["arcsinh"],
  },
  sqrt: {},
  // TODO: use toFraction handling to define x^(1/3) for x < 0
  // Or maybe wrap pow using `x < 0 ? -pow(-x,n) : pow(x,n)`
  pow: {
    // rational pow
    alias: "rpow",
    def: "float rpow(float x, float y) { return pow(x, y); }",
  },
  nthroot: {
    def: "float nthroot(float x, float n) { return pow(x,1.0/n); }",
  },
  hypot: {
    def: "float hypot(float x, float y) { return length(vec2(x,y)); }",
  },
  log: {
    body: "log(x)/2.302585092994045684",
    alias: "log10",
  },
  logbase: {
    def: "float logbase(float x, float base) { return log(x)/log(base); }",
  },
  ln: {
    body: "log(x)",
  },
  exp: {},
  floor: {},
  ceil: {},
  round: {
    def: "float round(float x, float n) { float p=pow(10.0, n); return floor(0.5+x*p)/p; }",
  },
  abs: {},
  sign: {},
  // GLSL uses actual mod, not JS's remainder
  mod: {},
  // nCr: {},
  // nPr: {},
  // factorial: {},
  // polyGamma: {},
  // lcm: {},
  // gcd: {},
  distance: {},

  /** LISTS */
  // mean: {},
  // total: {},
  // stdev: {},
  // mad: {},
  // careful: GLSL length is Euclidean norm
  // length: {},
  // min: {},
  // max: {},
  // argmin: {},
  // argmax: {},
  // median: {},
  // var: {},
  // varp: {},
  // cov: {},
  // covp: {},
  // corr: {},
  // spearman: {},
  // quantile: {},
  // quartile: {},
  // upperQuantileIndex: {},
  // lowerQuantileIndex: {},
  // quartileIndex: {},
  // upperQuartileIndex: {},
  // lowerQuartileIndex: {},

  /* DISTRIBUTIONS **/
  // normalcdf: {},
  // normalpdf: {},
  // binomcdf: {},
  // binompdf: {},
  // poissoncdf: {},
  // poissonpdf: {},
  // uniformcdf: {},
  // uniformpdf: {},
  // invT: {},
  // invPoisson: {},
  // invBinom: {},
  // invUniform: {},
  // tpdf: {},
  // tcdf: {},
  // erf: {},
  // invNorm: {},

  /** LISTS AGAIN */
  // tscore: {},
  // normalSample: {},
  // uniformSample: {},
  // tSample: {},
  // poissonSample: {},
  // binomSample: {},

  /** COLORS (do no need to implement) */
  // rgb: {},
  // hsv: {},

  /** HELPERS for numeric stability */
  expm1: {
    body: "x+0.5*x*x == x ? x : exp(x)-1.0",
  },
  log1p: {
    body: "x-0.5*x*x == x ? x : log(1.0+x)",
  },
  rtxsqpone: {
    body: "hypot(x,1.0)",
    deps: ["hypot"],
  },
  rtxsqmone: {
    def: "float rtxsqmone(float x) { float t = x*x; return t-1.0==t ? abs(x) : sqrt(t-1.0); }",
  },
};

// Unhandled: CompilerFunctionTable

export function getDefinition(s: string) {
  const data = builtins[s];
  let name = data?.alias ?? s;
  return (
    data?.def ??
    (data?.body && `float ${name}(float x) { return ${data.body}; }`) ??
    ""
  );
}

export function getDependencies(s: string) {
  return builtins[s]?.deps ?? [];
}

export function getFunctionName(s: string) {
  return builtins[s]?.alias ?? s;
}
