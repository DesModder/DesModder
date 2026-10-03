# Strict geometry: obstacles exactly as Desmos shades them

_Gate 0 of the fluid tab (`VECTOR_TOOLS_FLUID_RESEARCH_BRIEF.md` §8, GPT's
gate table). Established 2026-10-03 against live desmos.com/calculator._

A fluid obstacle is an inequality from the expression list. The fluid must see
the region Desmos shades: no more and no less. The flow visualizer's compiler
(`latexToGLSL.ts`) cannot do this, because it guards every awkward operation so
a picture always has a number to draw (`sqrt(max(a, 0))`, `log(max(a, 1e-12))`,
a division that never reaches zero). Where Desmos says "undefined", that
compiler says 0, and `y < √x` would grow a wall along the whole negative
x-axis.

So obstacles go through their own path, in `src/field-rendering/sim/`:

| File                          | What it does                                                                                                         |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `strictParse.ts`              | LaTeX to a syntax tree, through the visual compiler's tokenizer so the two never disagree about what was typed       |
| `strictEvaluate.ts`           | the tree on the CPU, in doubles, with Desmos's rules                                                                 |
| `strictGLSL.ts`               | the tree as GLSL ES 3.00, with a validity flag beside every value                                                    |
| `obstacles.ts`                | an inequality as `contains`, a signed function for wall placement, the GLSL for both, and a CPU rasterizer of a tank |
| `strictSemantics.fixtures.ts` | what live Desmos returned for 143 edge cases and 60 rational exponents                                               |

The visual compiler is unchanged. Its tokenizer and error class are now
exported, and nothing else about it moved.

## What Desmos actually does

GPT's second reply listed every edge case as "needs a runtime test". Measured
through `Calc.HelperExpression` in radian and degree mode, the answer is simpler
than its table feared. Desmos computes in IEEE doubles with almost no special
cases:

- **A domain error is NaN**: `√−1`, `ln(−1)`, `arcsin(1.01)`, `arccosh(0.99)`,
  `arcsec(0.5)`, `mod(5, 0)`, `log_{−2}`, `log_0`, `(−8)^{1/2}`.
- **Infinity is a value, and compares as one.** `1/0`, `ln 0`, `arctanh 1`,
  `cot 0`, `csch 0`, `0^{−1}`, `log_1 8` and `exp(1000)` are infinite, and
  `1/0 > 5` holds. `∞ − ∞` and `0 · ∞` are NaN.
- **Every comparison with NaN is false.** A piecewise whose condition is
  undefined falls through to its next branch (`{√−1 < 0: 2, 3}` is 3). An
  inequality is unshaded wherever either side is undefined. For a fluid, that
  rule matters most: **undefined is never solid.**
- **A negative base to a non-integer power is real only for an exact rational
  exponent.** The exponent must be exactly `p/q` as a double, in lowest terms,
  with `q` odd and at most 100. Then the value is `(−1)^p · |b|^r`:
  `(−8)^{1/3} = −2` and `(−8)^{2/3} = 4`. `(−8)^{1/99}` is real and
  `(−8)^{1/101}` is not. `1/3 + 10⁻¹⁵` is not, and neither is `0.333333333`;
  `0.3333333333333333` is, because it is the same double as 1/3. This also
  holds for a slider's value, so it is a run-time rule. `\sqrt[n]{a}` is
  `a^{1/n}` under the same rule: `∛−8 = −2`, the −3rd root of −8 is −½, and the
  0th root of 8 is ∞.
- `mod(a, b) = a − b·floor(a/b)`, taking the divisor's sign. `round` rounds a
  half up (`round(−2.5) = −2`). `0^0 = 1`, but `(0/0)^0` is undefined, which
  differs from `Math.pow`.
- **Degree mode** converts the input of forward circular trig and the output of
  inverse circular trig. Hyperbolic functions are untouched.
- `\{1 > 0, 2 < 1: 1, 0\}` reads as three branches. Commas separate branches,
  so `\{x > 0, y > 0\}` means "either", not "both".

JavaScript's `Math` already behaves this way almost everywhere, so the CPU
evaluator is mostly single calls. The exceptions are the rational-exponent rule,
`mod`, `log` with a base, and a NaN base.

**Desmos snaps three trig values.** `tan(π/2)`, `sec(π/2)` and `tan(90°)` are
infinite in Desmos and merely huge in doubles. Both sit on the same side of
every comparison except at that one point, so they are recorded but not
required to match.

**Factorial is refused for now.** Desmos's factorial is Γ(x + 1)
(`(½)! = 0.886`), and the GPU has no tested Gamma yet.

## Restrictions are walls

Read as ordinary syntax, `x² + y² ≤ 4 {x > 0}` is `4 · {x > 0}`. That shades the
same region but loses the wall: the left half becomes undefined rather than
fluid, and nothing marks x = 0 as a boundary. A trailing brace group therefore
counts as a restriction when it follows a complete term and holds only
conditions. Several groups must all hold; commas inside one group mean "any".

## The signed function

`signed(x, y)` is negative inside and positive outside, and its zero is the
wall:

- `a < b` gives `a − b`, and `a > b` gives `b − a`;
- a chain takes the largest of its links;
- each restriction takes the smallest of its comma-separated parts;
- the whole relation takes the largest of its chain and its restrictions.

It is not a distance. Interpolated bounce-back uses only its sign and zero
crossing, and a partially saturated cell uses a gradient estimated from its own
samples. Where it is NaN, a point is fluid with no wall to place, and the
rasterizer reports such cells as **undefined** rather than hiding them. A unit
test checks that membership and sign agree at 12,000 random points over six
regions.

## On the GPU

Each node becomes `float vN` and `bool kN`, where `kN` false means undefined.
The flag is tracked explicitly, because GLSL ES does not promise NaN. A driver
may fold `isnan` away, and `x/0`, `log 0` and `atan(0, 0)` are undefined in the
specification. Instead:

- every hazardous operation is guarded with control flow;
- infinity is built from its bit pattern, not by dividing by zero;
- the one NaN test that remains, after arithmetic that could make ∞ − ∞, reads
  the bits through `floatBitsToUint`, which no optimiser can assume away;
- piecewise branches are all computed, but only the chosen branch's value and
  flag are kept.

`strictSemantics.int.test.ts` runs every probe on WebGL2 (SwiftShader in the
harness) and checks the results against live Desmos. It also runs eight
obstacles, including a definition, a slider, the clock, a restriction and a
piecewise, on a 64 × 64 grid against the CPU. Every cell agrees except those
within float32 rounding of a wall.

**Two float32 differences are inherent**, and the test lists them rather than
skipping them:

1. **Rounding near an integer or a rational.** An exponent within a few
   float32 roundings of an integer, or of a rational with an odd denominator,
   is taken as that number, since a float32 uniform cannot tell the
   difference. So `0.3333333`, `1/3 + 10⁻⁹` and `2 + 10⁻¹²` are real on the
   GPU and undefined in Desmos.
2. **Overflow.** Values beyond about 3.4·10³⁸ overflow to infinity, where
   Desmos still has a finite number.

**Accuracy of built-ins.** GLSL leaves this to the driver: SwiftShader's
`acos(0.5)` is 4·10⁻⁵ out, so the GPU test allows 10⁻⁴ relative error. That
moves a wall by far less than a cell. What the test exists to catch is a wrong
special value, and those are compared exactly.

## Re-measuring

`strictSemantics.int.test.ts` asks live Desmos again on every integration run.
If a Desmos release changes an edge case, that test fails before a wall moves
in somebody's tank. To refresh the fixture, run its probes the same way and
replace the rows. The probe sliders are listed at the top of the fixture file.
