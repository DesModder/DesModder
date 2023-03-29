// reference https://www.khronos.org/registry/OpenGL-Refpages/gl4/index.php

// Test using https://www.desmos.com/calculator/lfgehepjce
const builtins: Record<
  string,
  | undefined
  | {
      tag: "glsl-builtin";
      alias?: string;
    }
  | {
      tag: "simple";
      /** alias: replace function call references to this.
        Any builtin with a def or body specified must have an alias
        starting with "dsm_" to avoid collisions */
      alias: string;
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
      alias: string;
      make: (n: string) => string;
      deps?: (n: string) => string[];
    }
  | {
      tag: "list2";
      alias: string;
      make: (n: string, m: string) => string;
    }
  | { tag: "type"; alias?: string; def: string }
> = {
  sin: {
    tag: "glsl-builtin",
  },
  cos: {
    tag: "glsl-builtin",
  },
  tan: {
    tag: "glsl-builtin",
  },
  cot: {
    alias: "dsm_cot",
    body: "1.0/tan(x)",
    tag: "simple",
  },
  sec: {
    alias: "dsm_sec",
    body: "1.0/cos(x)",
    tag: "simple",
  },
  csc: {
    alias: "dsm_csc",
    body: "1.0/sin(x)",
    tag: "simple",
  },
  arcsin: {
    alias: "asin",
    tag: "glsl-builtin",
  },
  arccos: {
    alias: "acos",
    tag: "glsl-builtin",
  },
  arctan: {
    alias: "atan",
    tag: "glsl-builtin",
  },
  arccot: {
    alias: "dsm_arccot",
    def: "float dsm_arccot(float x) { return atan(1.0, x); }",
    tag: "simple",
  },
  arcsec: {
    alias: "dsm_arcsec",
    body: "acos(1.0/x)",
    tag: "simple",
  },
  arccsc: {
    alias: "dsm_arccsc",
    body: "asin(1.0/x)",
    tag: "simple",
  },
  sinh: {
    tag: "glsl-builtin",
  },
  cosh: {
    tag: "glsl-builtin",
  },
  tanh: {
    tag: "glsl-builtin",
  },
  coth: {
    alias: "dsm_coth",
    body: "1.0/tanh(x)",
    tag: "simple",
  },
  sech: {
    alias: "dsm_sech",
    body: "1.0/cosh(x)",
    tag: "simple",
  },
  csch: {
    alias: "dsm_csch",
    body: "1.0/sinh(x)",
    tag: "simple",
  },
  arcsinh: {
    alias: "dsm_arcsinh",
    def: "float dsm_arcsinh(float x) { float a=abs(x); return sign(x) * (1.0+x*x==1.0 ? dsm_log1p(a) : log(a + dsm_rtxsqpone(a))); }",
    deps: ["log1p", "rtxsqpone"],
    tag: "simple",
  },
  arccosh: {
    alias: "dsm_arccosh",
    // should be NaN for x<1
    body: "log(x+dsm_rtxsqmone(x))",
    deps: ["rtxsqmone"],
    tag: "simple",
  },
  arctanh: {
    alias: "dsm_arctanh",
    body: "0.5*(dsm_log1p(x)-dsm_log1p(-x))",
    deps: ["log1p"],
    tag: "simple",
  },
  arccoth: {
    alias: "dsm_arccoth",
    body: "dsm_arctanh(1.0/x)",
    deps: ["arctanh"],
    tag: "simple",
  },
  arcsech: {
    alias: "dsm_arcsech",
    body: "dsm_arccosh(1.0/x)",
    deps: ["arccosh"],
    tag: "simple",
  },
  arccsch: {
    alias: "dsm_arccsch",
    body: "dsm_arcsinh(1.0/x)",
    deps: ["arcsinh"],
    tag: "simple",
  },
  sqrt: {
    tag: "glsl-builtin",
  },
  // TODO: use toFraction handling to define x^(1/3) for x < 0
  // Or maybe wrap pow using `x < 0 ? -pow(-x,n) : pow(x,n)`
  pow: {
    // Rational pow. For x<0, Desmos converts the exponent y to a fraction
    // and adjusts sign based on the parity of the numerator of y.
    // Instead, we only handle the x<0 case where y is an integer.
    alias: "dsm_rpow",
    def: `
    float dsm_rpow(float x, float y) {
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
    alias: "dsm_nthroot",
    def: "float dsm_nthroot(float x, float n) { return pow(x,1.0/n); }",
    tag: "simple",
  },
  hypot: {
    alias: "dsm_hypot",
    def: "float dsm_hypot(float x, float y) { return length(vec2(x,y)); }",
    tag: "simple",
  },
  log: {
    alias: "dsm_log10",
    body: "log(x)/2.302585092994045684",
    tag: "simple",
  },
  logbase: {
    alias: "dsm_logbase",
    def: "float dsm_logbase(float x, float base) { return log(x)/log(base); }",
    tag: "simple",
  },
  ln: {
    alias: "log",
    tag: "glsl-builtin",
  },
  exp: {
    tag: "glsl-builtin",
  },
  floor: {
    tag: "glsl-builtin",
  },
  ceil: {
    tag: "glsl-builtin",
  },
  round_single: {
    alias: "dsm_round",
    body: "floor(0.5 + x)",
    tag: "simple",
  },
  round: {
    alias: "dsm_round",
    def: "float dsm_round(float x, float n) { float p=pow(10.0, dsm_round(n)); return dsm_round(x*p)/p; }",
    deps: ["round_single"],
    tag: "simple",
  },
  abs: {
    tag: "glsl-builtin",
  },
  sign: {
    tag: "glsl-builtin",
  },
  // GLSL uses actual mod, not JS's remainder
  mod: {
    tag: "glsl-builtin",
  },
  // nCr and nPr are limited to a small region of values because we
  // are naively using factorials (non-fixed loop size doesn't work with GL)
  nCr: {
    alias: "dsm_nCr",
    def: `
    float dsm_nCr(float n, float k) {
      n = dsm_round(n);
      k = dsm_round(k);
      if (k > n || n < 0.0 || k < 0.0) return 0.0;
      return dsm_round(dsm_factorial(n) / (dsm_factorial(k) * dsm_factorial(n-k)));
    }`,
    deps: ["factorial", "round_single"],
    tag: "simple",
  },
  nPr: {
    alias: "dsm_nPr",
    def: `
    float dsm_nPr(float n, float k) {
      n = dsm_round(n);
      k = dsm_round(k);
      if (k > n || n < 0.0 || k < 0.0) return 0.0;
      return dsm_round(dsm_factorial(n) / dsm_factorial(n - k));
    }`,
    deps: ["factorial", "round_single"],
    tag: "simple",
  },
  factorial: {
    alias: "dsm_factorial",
    body: "dsm_gamma(x + 1.0)",
    deps: ["gamma"],
    tag: "simple",
  },
  polyGamma: {
    alias: "dsm_polyGamma",
    def: `
    float dsm_polyGamma(float m, float z) {
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
      return dsm_factorial(m) * a * u;
    }`,
    deps: ["factorial"],
    tag: "simple",
  },
  // Probably excessive precision considering GLesmos is 32-bit
  // But it's easy to just copy Desmos's 64-bit approximation
  erf: {
    alias: "dsm_erf",
    def: `float dsm_erf(float x) {
      float t = abs(x);
      float n = x*x;
      float r = -n;
      return sign(x) * (
        r < -750.0
          ? 1.0
          : t >= 0.065
          ? 1.0 - exp(r) * (
            t > 50000000.0
              ? r / t
              : t > 50.0
              ? (r * (n * (n + 4.5) + 2.0)) / (t * (n * (n + 5.0) + 3.75))
              : ((0.9999999999999999+t*(2.224574423459406+t*(2.444115549920689+
                 t*(1.7057986861852539+t*(0.8257463703357973+
                  t*(0.28647031042892007+t*(0.07124513844341643+
                    t*(0.012296749268608364+t*(0.001347817214557592+
                      0.00007263959403471071*t))))))))
                )/(1.0+t*(3.352953590554884+t*(5.227518529742423+
                  t*(5.003720878235473+t*(3.266590890998987+
                    t*(1.5255421920765353+t*(0.5185887413188858+
                      t*(0.12747319185915415+t*(0.02185979575963238+
                        t*(0.0023889438122503674+0.00012875032817508128*t
                ))))))))))
              )
          )
          : t*(1.1283791670955126+r*(0.37612638903183754+
              r*(0.11283791670955126+r*(0.026866170645131252+
                0.005223977625442188*r))))
      );
    }`,
    tag: "simple",
  },
  distance: {
    tag: "glsl-builtin",
  },

  /** LISTS */
  lcm: {
    alias: "dsm_lcm",
    make: (n) => `
    float dsm_lcm(float[${n}] L) {
      float g = abs(dsm_round(L[0]));
      for (int i=1; i<${n}; i++) {
        float v = abs(dsm_round(L[i]));
        g = g * v / dsm_gcd(g, v);
      }
      return g;
    }`,
    deps: () => ["gcdTwo", "round_single"],
    tag: "list",
  },
  gcd: {
    alias: "dsm_gcd",
    make: (n) => `
    float dsm_gcd(float[${n}] L) {
      float g = abs(dsm_round(L[0]));
      for (int i=1; i<${n}; i++) {
        g = dsm_gcd(g, abs(dsm_round(L[i])));
      }
      return g;
    }`,
    deps: () => ["gcdTwo", "round_single"],
    tag: "list",
  },
  gcdTwo: {
    // Based on https://github.com/riccardoscalco/glsl-gcd/blob/master/index.glsl
    // Note that the gcd worst-case is Fibonacci numbers, and we're
    // dealing with 32-bit floats, so the max number of iterations
    // needed is log_{phi}(sqrt(5) * 2^127) = 184.6
    // Each loop does two iterations, so just 93 loops are needed
    // Precondition: gcd expects non-negative integer-valued floats
    alias: "dsm_gcd",
    def: `
    float dsm_gcd(float u, float v) {
      for (int i=0; i<95; i++) {
        if (v == 0.0) break;
        u = mod(u, v);
        if (u == 0.0) break;
        v = mod(v, u);
      }
      return u+v;
    }`,
    tag: "simple",
  },
  mean: {
    // We know n >= 1: otherwise the `mean` could be constant-collapsed to NaN
    alias: "dsm_mean",
    make: (n) => `
    float dsm_mean(float[${n}] L) {
      return dsm_total(L) / ${n}.0;
    }`,
    tag: "list",
    deps: (n) => [`total#${n}`],
  },
  total: {
    alias: "dsm_total",
    make: (n) => `
    float dsm_total(float[${n}] L) {
      float tot = L[0];
      for (int i=1; i<${n}; i++) {
        tot += L[i];
      }
      return tot;
    }`,
    tag: "list",
  },
  stdev: {
    alias: "dsm_stdev",
    make: (n) => `
    float dsm_stdev(float[${n}] L) {
      float mean = dsm_mean(L);
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
    alias: "dsm_mad",
    make: (n) => `
    float dsm_mad(float[${n}] L) {
      float mean = dsm_mean(L);
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
    alias: "dsm_listmin",
    make: (n) => `
    float dsm_listmin(float[${n}] L) {
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
    alias: "dsm_listmax",
    make: (n) => `
    float dsm_listmax(float[${n}] L) {
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
    alias: "dsm_argmin",
    make: (n) => `
    float dsm_argmin(float[${n}] L) {
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
    alias: "dsm_argmax",
    make: (n) => `
    float dsm_argmax(float[${n}] L) {
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
  median: {
    // We know n >= 1: otherwise the `median` could be constant-collapsed to NaN
    alias: "dsm_median",
    make: (n) => {
      const len = parseInt(n);
      return len % 2 === 1
        ? `float dsm_median(float[${n}] L) {
            return L[int(dsm_sortPerm(L)[${(len - 1) / 2}])-1];
          }`
        : `float dsm_median(float[${n}] L) {
            float[${n}] perm = dsm_sortPerm(L);
            return 0.5*(L[int(perm[${len / 2}])-1]+L[int(perm[${
            len / 2 - 1
          }])-1]);
          }`;
    },
    tag: "list",
    deps: (n) => [`sortPerm#${n}`],
  },
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
    // Selection sort, which is more performant than other
    // sorts I tried (bubble-up merge, bitonic, and bubble)
    // Does not handle NaNs the same as JS
    alias: "dsm_sortPerm",
    make: (n) => {
      if (+n > 128) {
        throw Error(
          "Sorted list length exceeds 128. Stopping to avoid page freeze."
        );
      }
      return `float[${n}] dsm_sortPerm(float[${n}] L) {
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
    alias: "dsm_elementsAt",
    make: (n, m) => {
      const len = Math.min(parseInt(n), parseInt(m));
      return `
    float[${len}] dsm_elementsAt(float[${n}] L, float[${m}] I) {
      float[${len}] outList;
      for (int i=0; i<${len}; i++) {
        outList[i] = L[int(I[i])-1];
      }
      return outList;
    }`;
    },
    tag: "list2",
  },
  uniquePerm: {
    alias: "dsm_uniquePerm",
    make: () => {
      throw Error("The unique function is not supported");
    },
    tag: "list",
  },

  /** HELPERS for numeric stability */
  log1p: {
    alias: "dsm_log1p",
    body: "x-0.5*x*x == x ? x : log(1.0+x)",
    tag: "simple",
  },
  rtxsqpone: {
    alias: "dsm_rtxsqpone",
    body: "dsm_hypot(x,1.0)",
    deps: ["hypot"],
    tag: "simple",
  },
  rtxsqmone: {
    alias: "dsm_rtxsqmone",
    def: "float dsm_rtxsqmone(float x) { float t = x*x; return t-1.0==t ? abs(x) : sqrt(t-1.0); }",
    tag: "simple",
  },
  gamma: {
    alias: "dsm_gamma",
    body: `x < 0.0
      ? M_PI / (sin(M_PI * x) * dsm_gamma_pos(1.0 - x))
      : dsm_gamma_pos(x)`,
    deps: ["gamma_pos"],
    tag: "simple",
  },
  gamma_pos: {
    // https://github.com/libretro/glsl-shaders/blob/master/crt/shaders/crt-royale/port-helpers/special-functions.h#L228
    alias: "dsm_gamma_pos",
    def: `
    float dsm_gamma_pos(float s) {
      float sph = s + 0.5;
      float lanczos_sum = 0.8109119309638332633713423362694399653724431 + 0.4808354605142681877121661197951496120000040/(s + 1.0);
      float base = (sph + 1.12906830989)/2.71828182845904523536028747135266249775724709;
      return (pow(base, sph) * lanczos_sum) / s;
    }`,
    tag: "simple",
  },
  ternary: {
    alias: "dsm_ternary",
    def: `T dsm_ternary(bool x, T y, T z) { if (x) return y; return z; }`,
    tag: "type",
  },
};

// Unhandled: CompilerFunctionTable (these get compiled out to the above functions)

export function getDefinition(s: string): string {
  // We take the definition as either a raw string, like "hypot" for the hypot function,
  // or the function name and size separated by a #, like "total#10" for the total function,
  // which should be specialized to a list of 10 args
  const data = getBuiltin(s);
  if (data === undefined) {
    throw Error(`Undefined identifier: ${s}`);
  }
  switch (data.tag) {
    case "glsl-builtin":
      return "";
    case "simple":
      return (
        data?.def ??
        (data?.body &&
          `float ${data.alias}(float x) { return ${data.body}; }`) ??
        ""
      );
    case "list":
      return data.make(getArg1(s));
    case "list2":
      return data.make(getArg1(s), getArg2(s));
    case "type":
      return data.def.replace(/T/g, getArg1(s));
  }
}

export function getDependencies(s: string) {
  const builtin = getBuiltin(s);
  if (
    !builtin ||
    builtin.tag === "glsl-builtin" ||
    !("deps" in builtin) ||
    !builtin.deps
  )
    return [];
  if (builtin.tag === "list") {
    return builtin.deps(getArg1(s));
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

export function getArg1(s: string) {
  return s.split(/#/)[1];
}

export function getArg2(s: string) {
  return s.split(/#/)[2];
}
