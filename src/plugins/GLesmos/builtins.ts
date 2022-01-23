// reference https://www.khronos.org/registry/OpenGL-Refpages/gl4/index.php

// Test using https://www.desmos.com/calculator/lfgehepjce
const builtins: {
  [K: string]:
    | undefined
    | {
        tag: "simple";
        // alias: replace function call references to this
        alias?: string;
        // def: function definition
        def?: string;
        // deps: dependencies
        deps?: string[];
        // body is a just a more concise way to set def
        body?: string;
      }
    | {
        // make: specialize the function definition for a given list size
        tag: "list";
        alias?: string;
        make(n: string): string;
        deps?: (n: string) => string[];
      };
} = {
  sin: {
    tag: "simple",
  },
  cos: {
    tag: "simple",
  },
  tan: {
    tag: "simple",
  },
  cot: {
    body: "1.0/tan(x)",
    tag: "simple",
  },
  sec: {
    body: "1.0/cos(x)",
    tag: "simple",
  },
  csc: {
    body: "1.0/sin(x)",
    tag: "simple",
  },
  arcsin: {
    alias: "asin",
    tag: "simple",
  },
  arccos: {
    alias: "acos",
    tag: "simple",
  },
  arctan: {
    def:
      `float arctan(float y_over_x) { return atan(y_over_x); }\n` +
      `float arctan(float y, float x) { return atan(y, x); }`,
    tag: "simple",
  },
  arccot: {
    def: "float arccot(float x) { return atan(1.0, x); }",
    tag: "simple",
  },
  arcsec: {
    body: "acos(1.0/x)",
    tag: "simple",
  },
  arccsc: {
    body: "asin(1.0/x)",
    tag: "simple",
  },
  sinh: {
    tag: "simple",
  },
  cosh: {
    tag: "simple",
  },
  tanh: {
    tag: "simple",
  },
  coth: {
    body: "1.0/tanh(x)",
    tag: "simple",
  },
  sech: {
    body: "1.0/cosh(x)",
    tag: "simple",
  },
  csch: {
    body: "1.0/sinh(x)",
    tag: "simple",
  },
  arcsinh: {
    def: "float arcsinh(float x) { float a=abs(x); return sign(x) * (1.0+x*x==1.0 ? log1p(a) : log(a+rtxsqpone(a))); }",
    deps: ["log1p", "rtxsqpone"],
    tag: "simple",
  },
  arccosh: {
    // should be NaN for x<1
    body: "log(x+rtxsqmone(x))",
    deps: ["rtxsqmone"],
    tag: "simple",
  },
  arctanh: {
    body: "0.5*(log1p(x)-log1p(-x))",
    deps: ["log1p"],
    tag: "simple",
  },
  arccoth: {
    body: "arctanh(1.0/x)",
    deps: ["arctanh"],
    tag: "simple",
  },
  arcsech: {
    body: "arccosh(1.0/x)",
    deps: ["arccosh"],
    tag: "simple",
  },
  arccsch: {
    body: "arcsinh(1.0/x)",
    deps: ["arcsinh"],
    tag: "simple",
  },
  sqrt: {
    tag: "simple",
  },
  // TODO: use toFraction handling to define x^(1/3) for x < 0
  // Or maybe wrap pow using `x < 0 ? -pow(-x,n) : pow(x,n)`
  pow: {
    // Rational pow. For x<0, Desmos converts the exponent y to a fraction
    // and adjusts sign based on the parity of the numerator of y.
    // Instead, we only handle the x<0 case where y is an integer.
    alias: "rpow",
    def: `
    float rpow(float x, float y) {
      if (x >= 0.0) return pow(x,y);
      else {
        float m = mod(y, 2.0);
        if (m == 0.0) return pow(-x, y);
        else if (m == 1.0) return -pow(-x, y);
        else return pow(x, y);
      }
    }`,
    tag: "simple",
  },
  nthroot: {
    def: "float nthroot(float x, float n) { return pow(x,1.0/n); }",
    tag: "simple",
  },
  hypot: {
    def: "float hypot(float x, float y) { return length(vec2(x,y)); }",
    tag: "simple",
  },
  log: {
    body: "log(x)/2.302585092994045684",
    alias: "log10",
    tag: "simple",
  },
  logbase: {
    def: "float logbase(float x, float base) { return log(x)/log(base); }",
    tag: "simple",
  },
  ln: {
    body: "log(x)",
    tag: "simple",
  },
  exp: {
    tag: "simple",
  },
  floor: {
    tag: "simple",
  },
  ceil: {
    tag: "simple",
  },
  round_single: {
    def: "float round(float x) { return floor(0.5 + x); }",
    tag: "simple",
  },
  round: {
    def: "float round(float x, float n) { float p=pow(10.0, n); return round(x*p)/p; }",
    deps: ["round_single"],
    tag: "simple",
  },
  abs: {
    tag: "simple",
  },
  sign: {
    tag: "simple",
  },
  // GLSL uses actual mod, not JS's remainder
  mod: {
    tag: "simple",
  },
  // nCr and nPr are limited to a small region of values because we
  // are naively using factorials (non-fixed loop size doesn't work with GL)
  nCr: {
    def: `
    float nCr(float n, float k) {
      n = round(n);
      k = round(k);
      if (k > n || n < 0.0 || k < 0.0) return 0.0;
      return round(factorial(n) / (factorial(k) * factorial(n-k)));
    }`,
    deps: ["factorial", "round_single"],
    tag: "simple",
  },
  nPr: {
    def: `
    float nPr(float n, float k) {
      n = round(n);
      k = round(k);
      if (k > n || n < 0.0 || k < 0.0) return 0.0;
      return round(factorial(n) / factorial(n - k));
    }`,
    deps: ["factorial", "round_single"],
    tag: "simple",
  },
  factorial: {
    body: "gamma(x + 1.0)",
    deps: ["gamma"],
    tag: "simple",
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
    tag: "simple",
  },
  distance: {
    tag: "simple",
  },

  /** LISTS */
  lcm: {
    make: (n) => `
    float lcm(float[${n}] L) {
      float g = abs(round(L[0]));
      for (int i=1; i<${n}; i++) {
        float v = abs(round(L[i]));
        g = g * v / gcd(g, v);
      }
      return g;
    }`,
    deps: () => ["gcdTwo"],
    tag: "list",
  },
  gcd: {
    make: (n) => `
    float gcd(float[${n}] L) {
      float g = abs(round(L[0]));
      for (int i=1; i<${n}; i++) {
        g = gcd(g, abs(round(L[i])));
      }
      return g;
    }`,
    deps: () => ["gcdTwo"],
    tag: "list",
  },
  gcdTwo: {
    // Based on https://github.com/riccardoscalco/glsl-gcd/blob/master/index.glsl
    // Note that the gcd worst-case is Fibonacci numbers, and we're
    // dealing with 32-bit floats, so the max number of iterations
    // needed is log_{phi}(sqrt(5) * 2^127) = 184.6
    // Each loop does two iterations, so just 93 loops are needed
    // Precondition: gcd expects non-negative integer-valued floats
    def: `
    float gcd(float u, float v) {
      for (int i=0; i<95; i++) {
        if (v == 0.0) break;
        u = mod(u, v);
        if (u == 0.0) break;
        v = mod(v, u);
      }
      return u+v;
    }`,
    tag: "simple",
    alias: "gcd",
  },
  mean: {
    // We know n >= 1: otherwise the `mean` could be constant-collapsed to NaN
    make: (n) => `
    float mean(float[${n}] L) {
      return total(L) / ${n}.0;
    }`,
    tag: "list",
    deps: (n) => [`total#${n}`],
  },
  total: {
    make: (n) => `
    float total(float[${n}] L) {
      float tot = L[0];
      for (int i=1; i<${n}; i++) {
        tot += L[i];
      }
      return tot;
    }`,
    tag: "list",
  },
  stdev: {
    make: (n) => `
    float stdev(float[${n}] L) {
      float mean = mean(L);
      float tot = 0.0;
      for (int i=0; i<${n}; i++) {
        float v = L[i] - mean;
        tot += v * v;
      }
      return sqrt(tot / ${parseInt(n) - 1}.0);
    }`,
    tag: "list",
    deps: (n) => [`mean#${n}`],
  },
  mad: {
    make: (n) => `
    float mad(float[${n}] L) {
      float mean = mean(L);
      float tot = 0.0;
      for (int i=0; i<${n}; i++) {
        tot += abs(L[i] - mean);
      }
      return tot / ${n}.0;
    }`,
    tag: "list",
    deps: (n) => [`mean#${n}`],
  },
  // careful: GLSL length is Euclidean norm
  // But length doesn't need to be implemented because it should
  // always be constant-collapsed
  // length: {},
  min: {
    // We know n >= 1: otherwise the `min` could be constant-collapsed to 0
    make: (n) => `
    float min(float[${n}] L) {
      float m = L[0];
      for (int i=1; i<${n}; i++) {
        m = min(m, L[i]);
      }
      return m;
    }`,
    tag: "list",
  },
  max: {
    // We know n >= 1: otherwise the `min` could be constant-collapsed to 0
    make: (n) => `
    float max(float[${n}] L) {
      float m = L[0];
      for (int i=1; i<${n}; i++) {
        m = max(m, L[i]);
      }
      return m;
    }`,
    tag: "list",
  },
  argmin: {
    // We know n >= 1: otherwise the `argmin` could be constant-collapsed to 0
    make: (n) => `
    float argmin(float[${n}] L) {
      if (isnan(L[0])) return 0.0;
      int arg = 0;
      float min = L[0];
      for (int i=1; i<${n}; i++) {
        float e = L[i];
        if (isnan(e)) return 0.0;
        if (e < min) {
          arg = i;
          min = e;
        }
      }
      return float(arg + 1);
    }`,
    tag: "list",
  },
  argmax: {
    // We know n >= 1: otherwise the `argmax` could be constant-collapsed to 0
    make: (n) => `
    float argmax(float[${n}] L) {
      if (isnan(L[0])) return 0.0;
      int arg = 0;
      float max = L[0];
      for (int i=1; i<${n}; i++) {
        float e = L[i];
        if (isnan(e)) return 0.0;
        if (e > max) {
          arg = i;
          max = e;
        }
      }
      return float(arg + 1);
    }`,
    tag: "list",
  },
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

  /** New additions */
  // validateRangeLength: {},
  // validateSampleCount: {},
  // select: {},
  // shuffle: {},
  sortPerm: {
    // Insertion sort, which is more performant than other
    // sorts I tried (bubble-up merge, bitonic, and bubble)
    // Does not handle NaNs the same as JS
    make: (n) => {
      if (+n > 128) {
        throw "Sorted list length exceeds 128. Stopping to avoid page freeze.";
      }
      return `float[${n}] sortPerm(float[${n}] L) {
        int[${n}] perm;
        int[${n}] nextPerm;
        for (int i=0; i<${n}; i++) {
          perm[i] = i;
        }
        float lastMin = -Infinity;
        int lastIndex = -1;
        for (int i=0; i<${n}; i++) {
          float currMin = Infinity;
          int currIndex = -1;
          int j;
          for (j=0; j<${n}; j++) {
            float e = L[j];
            if (
              (e > lastMin || (e == lastMin && j > lastIndex))
              && e < currMin
            ) {
              currMin = e;
              currIndex = j;
            }
          }
          perm[i] = currIndex;
          lastMin = currMin;
          lastIndex = currIndex;
        }
        float[${n}] permFloat;
        for (int i=0; i<${n}; i++) {
          permFloat[i] = float(perm[i] + 1);
        }
        return permFloat;
      }`;
    },
    tag: "list",
  },
  elementsAt: {
    make: (n) => `
    float[${n}] elementsAt(float[${n}] L, float[${n}] I) {
      float[${n}] outList;
      for (int i=0; i<${n}; i++) {
        outList[i] = L[int(I[i])-1];
      }
      return outList;
    }`,
    tag: "list",
  },
  uniquePerm: {
    make: () => {
      throw "The unique function is not supported";
    },
    tag: "list",
  },

  /** HELPERS for numeric stability */
  log1p: {
    body: "x-0.5*x*x == x ? x : log(1.0+x)",
    tag: "simple",
  },
  rtxsqpone: {
    body: "hypot(x,1.0)",
    deps: ["hypot"],
    tag: "simple",
  },
  rtxsqmone: {
    def: "float rtxsqmone(float x) { float t = x*x; return t-1.0==t ? abs(x) : sqrt(t-1.0); }",
    tag: "simple",
  },
  gamma: {
    body: `x < 0.0
      ? M_PI / (sin(M_PI * x) * gamma_pos(1.0 - x))
      : gamma_pos(x)`,
    deps: ["gamma_pos"],
    tag: "simple",
  },
  gamma_pos: {
    // https://github.com/libretro/glsl-shaders/blob/master/crt/shaders/crt-royale/port-helpers/special-functions.h#L228
    def: `
    float gamma_pos(float s) {
      float sph = s + 0.5;
      float lanczos_sum = 0.8109119309638332633713423362694399653724431 + 0.4808354605142681877121661197951496120000040/(s + 1.0);
      float base = (sph + 1.12906830989)/2.71828182845904523536028747135266249775724709;
      return (pow(base, sph) * lanczos_sum) / s;
    }`,
    tag: "simple",
  },
};

// Unhandled: CompilerFunctionTable (these get compiled out to the above functions)

export function getDefinition(s: string) {
  // We take the definition as either a raw string, like "hypot" for the hypot function,
  // or the function name and size separated by a #, like "total#10" for the total function,
  // which should be specialized to a list of 10 args
  const data = getBuiltin(s);
  if (data === undefined) {
    throw `Undefined identifier: ${s}`;
  }
  if (data.tag === "simple") {
    const name = data?.alias ?? s;
    const res =
      data?.def ??
      (data?.body && `float ${name}(float x) { return ${data.body}; }`) ??
      "";
    return res;
  } else {
    // data.tag === "list"
    return data.make(getArgs(s));
  }
}

export function getDependencies(s: string) {
  const builtin = getBuiltin(s);
  if (!builtin?.deps) return [];
  if (builtin.tag === "list") {
    return builtin.deps(getArgs(s));
  } else {
    return builtin.deps;
  }
}

export function getFunctionName(s: string) {
  return getBuiltin(s)?.alias ?? s;
}

export function getBuiltin(s: string) {
  return builtins[s.split("#")[0]];
}

export function getArgs(s: string) {
  return s.split(/#/)[1];
}
