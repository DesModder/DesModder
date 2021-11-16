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
    // Rational pow. For x<0, Desmos converts the exponent y to a fraction
    // and adjusts sign based on the parity of the numerator of y.
    // Instead, we only handle the x<0 case where y is an integer.
    alias: "rpow",
    def: `float rpow(float x, float y) {
      if (x >= 0.0) return pow(x,y);
      else {
        float m = mod(y, 2.0);
        if (m == 0.0) return pow(-x, y);
        else if (m == 1.0) return -pow(-x, y);
        else return pow(x, y);
      }
    }`,
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
  round_single: {
    def: "float round(float x) { return floor(0.5 + x); }",
  },
  round: {
    def: "float round(float x, float n) { float p=pow(10.0, n); return round(x*p)/p; }",
    deps: ["round_single"],
  },
  abs: {},
  sign: {},
  // GLSL uses actual mod, not JS's remainder
  mod: {},
  // nCr and nPr are limited to a small region of values because we
  // are naively using factorials (non-fixed loop size doesn't work with GL)
  nCr: {
    def: `float nCr(float n, float k) {
      n = round(n);
      k = round(k);
      if (k > n || n < 0.0 || k < 0.0) return 0.0;
      return round(factorial(n) / (factorial(k) * factorial(n-k)));
    }`,
    deps: ["factorial", "round_single"],
  },
  nPr: {
    def: `float nPr(float n, float k) {
      n = round(n);
      k = round(k);
      if (k > n || n < 0.0 || k < 0.0) return 0.0;
      return round(factorial(n) / factorial(n - k));
    }`,
    deps: ["factorial", "round_single"],
  },
  factorial: {
    body: "gamma(x + 1.0)",
    deps: ["gamma"],
  },
  polyGamma: {
    def: `
    float polyGamma(float m, float z) {
      float a = mod(m, 2.0) == 0.0 ? -1.0 : 1.0;
      // z < 0 is not handled
      float u = 0.0;
      float i = pow(z, -(m + 1.0));
      for (float j = 0.0; j < 10.0; j++) {
        if (z < 10.0) {
          u += i;
          z++;
          i = pow(z, -(m + 1.0));
        }
      }
      u += m == 0.0 ? -log(z) : (i * z) / m;
      u += 0.5 * i;
      float c = 2.0;
      float h = m + 1.0;
      float s = (i * z * h) / c;
      float l = 1.0 / (z * z);

      // manually unrolled loop lol. It's ok because the compiler would do the same
      s *= l; u += s * 0.166666666666666667; s *= ++h / ++c; s *= ++h / ++c;
      s *= l; u += s * -0.03333333333333333; s *= ++h / ++c; s *= ++h / ++c;
      s *= l; u += s * 0.023809523809523808; s *= ++h / ++c; s *= ++h / ++c;
      s *= l; u += s * -0.03333333333333333; s *= ++h / ++c; s *= ++h / ++c;
      s *= l; u += s * 0.07575757575757576; s *= ++h / ++c; s *= ++h / ++c;
      s *= l; u += s * -0.2531135531135531; s *= ++h / ++c; s *= ++h / ++c;
      s *= l; u += s * 1.16666666666666667; s *= ++h / ++c; s *= ++h / ++c;
      s *= l; u += s * -7.092156862745098; s *= ++h / ++c; s *= ++h / ++c;
      s *= l; u += s * 54.971177944862156; s *= ++h / ++c; s *= ++h / ++c;
      s *= l; u += s * -529.1242424242424; s *= ++h / ++c; s *= ++h / ++c;
      s *= l; u += s * 6192.123188405797; s *= ++h / ++c; s *= ++h / ++c;
      s *= l; u += s * -86580.25311355312; s *= ++h / ++c; s *= ++h / ++c;
      s *= l; u += s * 1425517.1666666667; s *= ++h / ++c; s *= ++h / ++c;
      s *= l; u += s * -27298231.067816094;
      return factorial(m) * a * u;
    }`,
    deps: ["factorial"],
  },
  distance: {},

  /** LISTS */
  // lcm: {},
  // gcd: {},
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

  /** COLORS (do not need to implement) */
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
  gamma: {
    body: `x < 0.0
      ? M_PI / (sin(M_PI * x) * gamma_pos(1.0 - x))
      : gamma_pos(x)`,
    deps: ["gamma_pos"],
  },
  gamma_pos: {
    // https://github.com/libretro/glsl-shaders/blob/master/crt/shaders/crt-royale/port-helpers/special-functions.h#L228
    def: `float gamma_pos(float s) {
      float sph = s + 0.5;
      float lanczos_sum = 0.8109119309638332633713423362694399653724431 + 0.4808354605142681877121661197951496120000040/(s + 1.0);
      float base = (sph + 1.12906830989)/2.71828182845904523536028747135266249775724709;
      return (pow(base, sph) * lanczos_sum) / s;
    }`,
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
