# Research brief: taking the Physics Lab integrator further

_Written 2026-09-24 for a research assistant (GPT) with no access to the code.
Everything you need to know about the system is in this document. What I need
back is described in §6._

---

## 1. What this is

**Physics Lab** is a plugin inside a browser extension for the **Desmos graphing
calculator** (a fork of DesModder). It is aimed at AP Calculus AB/BC, a first
Calculus II course, and AP Physics. It has an **Integral tab**: the user types
an integrand into a Desmos-style maths field, and the panel shows one of the
following:

- an exact antiderivative plus `C`, with the **technique that produced it** named
  ("Integration by parts, then trigonometric substitution"), and an "Add to
  graph" button;
- a definite integral `∫ₐᵇ f dx = <exact value>`, with its decimal beside it,
  including improper integrals (bounds at ±∞, or singular endpoints);
- a **refusal**, which names the special function when the antiderivative is
  provably non-elementary ("This integral is written with the exponential
  integral Ei, which is not an elementary function…"), plus a power-series
  fallback.

The engine is a hand-written symbolic integrator in **TypeScript, running in the
browser**. It has no CAS dependency and no server, and the bundle size matters.
It operates on Desmos's own syntax tree:

```
Constant | Identifier | Negative(arg)
BinaryOperator{ Add | Subtract | Multiply | Divide | Exponent }(left, right)
FunctionCall(callee, args) | RepeatedOperator (Σ) | Factorial
```

Shared helpers exist: `fold` (structural simplification), `expand`,
`collectLikeTerms`, `differentiate` (complete), `evaluate` (float), and
`agreesOnSamples` (numeric equality at sample points).

## 2. The rules the engine lives by (non-negotiable)

1. **Refuse rather than approximate.** A wrong antiderivative is worse than
   none. Every answer is differentiated back numerically at several points
   before it is shown, and one that fails is never shown.
2. **Never turn an exact value into a decimal.** `√3/2`, not `0.866`; `ln 2`,
   not `0.693`. Decimals appear only _beside_ an exact value.
3. **The answer should look like the textbook's.** The target is the form in
   Stewart or an AP answer key, written in Desmos's own LaTeX (`\left(`,
   `x^{2}`, `\frac{}{}`). A correct answer in an ugly form counts as a bug.
4. **Name the method from the branch that succeeded**, never guessed from the
   shape of the answer.
5. **A trade-off gets a labelled control with a sensible default**, not a limit
   imposed on the user.

## 3. Architecture as it stands

`integrate(node, x)` folds the input, tries it as written, then tries it
multiplied out, and keeps the shorter answer. Inside, `antiderivative()` tries
**rules** (`byRule`) and then **rewrites** (`byRewrite`), in this order:

| Stage               | What it does                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Table               | sin, cos, exp, tan/cot/sec/csc, sinh…, ln, arcsin/arctan…, all of a **linear** argument (the `1/a` factor)                                                                                                                                                                                                                                                                                                     |
| Power rule          | `(ax+b)^r` for rational r; `a^{kx+m}`                                                                                                                                                                                                                                                                                                                                                                          |
| Substitution search | Every subexpression (and every root of a power: `x⁴` offers `x²`) is tried as `u`. The test is whether `f/u'` becomes free of `x` after replacing `u`. The largest `u` relative to `u'` wins                                                                                                                                                                                                                   |
| Partial fractions   | Numerator/denominator GCD cancelled first. Rational roots by the rational root theorem; then quadratics (kept whole when their roots are irrational, integrated by completing the square). Quartics without rational roots are split into two quadratics via the **resolvent cubic**, over **Q(√d)**, using exact field arithmetic. Repeated irreducible quadratics use the reduction formula. Degree ≤ 6 only |
| Discriminant rule   | A constant or linear numerator over a numeric quadratic gives arctan, a log of a quotient, or a power                                                                                                                                                                                                                                                                                                          |
| Trig products       | Any product of the six trig functions of one angle is read as `sin^p cos^q` with integer p, q, then: odd power → Pythagorean peel plus substitution; both even → half-angle; `tan^n` / `sec^n` even → reduction rewrite; odd `sec^n` / `csc^n` → reduction formula; `sin(ax)cos(bx)` → product-to-sum                                                                                                          |
| Trig substitution   | `√(a²−x²)`, `√(a²+x²)`, `√(x²−a²)`. Back-substitution by table, opening multiple angles first                                                                                                                                                                                                                                                                                                                  |
| Root substitution   | `u = ⁿ√g(x)` for g linear, or g = tan/exp/ln of a linear argument (so `√(tan x)` works)                                                                                                                                                                                                                                                                                                                        |
| Parts               | LIATE on a binary split. On the flattened product, a log or inverse factor is `u` and everything else is `dv` (so `arcsin²` works). **Tabular** parts: polynomial × (exp/sin/cos/sinh/cosh of linear arguments), with every Rₖ integrated from the same recursion depth                                                                                                                                        |
| Cyclic rule         | `e^{ax}sin(bx)`, `e^{ax}cos(bx)`, closed form, through constant factors                                                                                                                                                                                                                                                                                                                                        |
| Log substitution    | `x = e^u` to clear `ln` (`cos(ln x)`)                                                                                                                                                                                                                                                                                                                                                                          |
| sin/cos rewrite     | tan → sin/cos and so on, as a late fallback                                                                                                                                                                                                                                                                                                                                                                    |
| Weierstrass         | `t = tan(x/2)`, absolutely last                                                                                                                                                                                                                                                                                                                                                                                |

Depth is capped at 4 nested rewrites. Output is tidied: collect like terms,
expand if shorter, factor a common exponential if shorter, tidy signs, drop
constants inside additive logarithms (`ln|2(x+1)| → ln|x+1|`).

**Non-elementary classifier** (runs only after everything fails, and claims
only textbook theorems): `e^{L}/M^k` → Ei; `sin/cos(L)/M^k` → Si/Ci; `1/ln L` →
li; `x^{2k}e^{Q}` → erf/erfi; `sin/cos(Q)` → Fresnel; `ln(L₁)/L₂` with distinct
roots, `x/(e^L+c)` and `arctan²` → Li₂; `√P` or `1/√P` with P a squarefree cubic
or quartic → elliptic; `x^x`. For a sum, it names the term only when exactly one
term is non-elementary and the others integrate.

**Series fallback**: (a) a closed general term for `c·x^m·f(a·x^k)` with f in
{exp, sin, cos, sinh, cosh, arctan, ln(1+u), 1/(1−u)}, where a first term of
`1/x` is split off as `ln|x|` (so `Ei` comes out right); (b) an exact truncated
Laurent series about 0 with rational coefficients, from arithmetic on
truncated series (composition, inversion, binomial powers). A sum is handled
term by term, and each term is labelled closed form, series, or truncated
series.

**Definite integrals**: F(b) − F(a) in an exact-constant representation. That
representation is sums of rational × π^a × e^b × prime radicals, plus opaque
atoms: logs of primes, and any irreducible constant kept as its expression.
Special-value tables cover trig at multiples of π/12, inverse trig at the
matching values, and `e^{k ln p}`. A small limit engine handles ±∞ and
singular endpoints. A **tanh-sinh quadrature** verifies every exact value; a
disagreement is refused, which is how a `tan(x/2)` antiderivative that jumps at
π is caught. Interior singularities are detected by sampling and refused.

## 4. Known weaknesses, with concrete cases

Each is something I would like the engine to handle or explain better.

**Rational functions**

- `1/(x⁶+1)` is refused. `x⁶+1 = (x²+1)(x⁴−x²+1)` has no rational root, so the
  degree-6 remainder is never split. We have no general factorisation over Q.
- `1/(x³+2)` is refused. Its real root is ∛2, and we have no cube-root field.
- The log part of a rational integral goes through explicit factorisation. I
  suspect Rothstein–Trager / Lazard–Rioboo–Trager, plus Hermite reduction,
  would be more general, but I don't know how to present a `RootSum` answer in
  textbook form.
- Nested radicals appear when a quartic's quadratic factors have discriminants
  that are not squares in Q(√d). We have no denesting.

**Elementary but refused**

- `e^x/x − e^x/x²` (= d/dx of eˣ/x). Two non-elementary pieces cancel, and the
  term-by-term design cannot see it.
- More generally, `∫R(x)e^{x}dx` is elementary iff `R = S' + S` for rational S.
  We have no such decision procedure.
- `∫ln(sin x)`, `∫|x|`, piecewise integrands: untried.

**Presentation**

- `∫x⁵e^{3x}cos 2x` is correct but comes out as a long unfactored nest. It should
  be `e^{3x}(P(x)cos 2x + Q(x)sin 2x)` with polynomial P and Q.
- A `2(x cos x)` bracket survives inside a factored sum.
- `∫√(tan x)` is correct, with four terms in a scattered order. The textbook
  groups them as `(1/√2)arctan((tan x − 1)/√(2 tan x)) + (1/(2√2))ln|…|`.
- The substitution search picks by a node-count score. There is no principled
  model of "the form a textbook prints".

**Limits** (needed now for improper integrals, and later for a Limit tab)

- No 1^∞, 0⁰ or ∞⁰ forms: `lim_{x→∞}(1+1/x)^x = e` is impossible today.
- No L'Hôpital, and no series-based limits. The ∞−∞ rule refuses outright.

**Series** (a Series tab is planned)

- No general term for products or compositions: `sin(x)e^{x²}` gets only the
  first N exact terms.
- No radius of convergence for truncated series.
- No Puiseux series (`√x`), and no expansion about points other than 0.

**Definite integrals**

- A symbolic parameter in the integrand or bounds is refused.
- An interior discontinuity of F is refused rather than split at the jump.
- There are no principal values.

## 5. Constraints on any proposal

- TypeScript in the browser; no WASM CAS, no server. Algorithms must be
  implementable in a few hundred lines each, over exact `bigint` rationals.
- Every answer is verified numerically before display. A proposal can rely on
  that as a safety net, **but not as the method**: the answer must be derived,
  never fitted.
- Output must be textbook-shaped and Desmos-parseable. Desmos supports
  `\sum_{n=0}^{N}`, `\int_{a}^{b}…dx` (evaluated numerically), `\ln`,
  `\operatorname{arcsinh}` and so on, and has no special functions (no Ei, erf,
  Li₂).
- Audience: AP Calculus BC and Calculus II students, and teachers. Coverage of
  a course matters more than generality.

## 6. What I need researched

For each question below, please give:

1. **the algorithm**, precisely enough to implement: pseudocode, the data it
   needs, and its termination argument;
2. **its scope**: exactly which integrands (or limits, or series) it decides or
   solves, and where it stops;
3. **how to present the result in textbook form**, where that is not obvious;
4. **5–15 test cases with known exact answers**, including at least two it must
   refuse;
5. **primary references**: papers, book chapters, and open-source code
   (SymPy, Maxima, FriCAS, Rubi, Giac) where it is implemented;
6. **your judgement of cost/benefit** for this project: implement now, later,
   or never.

### Q1. Factoring polynomials over Q for partial fractions

The smallest practical method to factor a squarefree integer polynomial of
degree ≤ 8 into irreducibles over Q: Kronecker's method,
Berlekamp–Zassenhaus with Hensel lifting, or van Hoeij? Which is simplest to get
right for small degrees and small coefficients? Include squarefree
factorisation (Yun's algorithm).

### Q2. The logarithmic part of rational integrals without explicit roots

Explain Hermite reduction, and Rothstein–Trager versus Lazard–Rioboo–Trager, for
someone implementing them over Q. Crucially: when the resultant's roots lie in
a quadratic or biquadratic field, how do SymPy and Maxima turn the `RootSum`
into real logs and arctangents (Rioboo's conversion)? When is an answer with
`RootSum` over an irreducible cubic the only exact option? And how should that
be shown to a student, if at all?

### Q3. Deciding elementarity for the forms a course meets

- Liouville's theorem specialised to `∫f(x)e^{g(x)}dx` with f, g rational: the
  Risch differential equation `y' + g'y = f`, and how to solve it for rational y
  in practice (bounds on denominators and degrees).
- Chebyshev's theorem on binomial differentials `x^m(a+bx^n)^p` (complete
  criterion, plus the substitutions for the three elementary cases).
- `∫R(x, √(quadratic))` is always elementary (Euler substitutions), while
  `√(cubic/quartic)` is elliptic unless it reduces. What is the reduction
  test?
- Is a practical subset of the transcendental Risch algorithm (one exponential
  or one logarithm over Q(x)) feasible in ~1–2k lines? What do SymPy's
  `risch_integrate` and its limitations teach?

### Q4. Rule-based integration at scale (Rubi)

How is Rubi (Rich's Rule-based Integrator) organised? How are its ~6,700 rules
ordered, and how does it guarantee termination and textbook-shaped results?
Which rule families cover AP/Calc II integrals, and is there a machine-readable
export (the JSON or TeX rule sets, the test suites) that could be mined for a
TypeScript subset? Please also point to Rubi's integration **test suite**, and
to any other published benchmark lists with textbook answers (Timofeev,
Charlwood, Stewart's exercises), since I want a regression corpus of a few
hundred problems.

### Q5. Showing the steps

SymPy's `manualintegrate` builds a rule tree. How is it structured? How does it
choose between rules, and how are steps rendered for students (e.g. SymPy
Gamma)? What would a minimal "steps" data model look like for an integrator
that already records which technique finished each branch?

### Q6. Simplification toward the textbook form

- Canonical forms for elementary expressions. What is decidable, and how do
  practical systems do zero-equivalence (Richardson's theorem, and randomised
  numeric zero-testing)?
- Log and exponential collection: when to combine `ln a − ln b`, and when to
  pull out `e^{ax}` with polynomial coefficients (`e^{3x}(P cos 2x + Q sin 2x)`).
- Fu et al.'s trigonometric simplification algorithm: is it practical here?
- Denesting square roots (Borodin–Fagin–Hopcroft–Tompa; Landau): what is the
  simple special case for `√(a+b√d)`?
- Heuristics CAS authors use to prefer the form printed in textbooks.

### Q7. Definite integrals done right

- Jeffrey and Rich on antiderivatives continuous on the real line: how to
  remove the spurious jumps the Weierstrass substitution introduces, and how to
  choose continuous forms automatically.
- Locating the discontinuities of an antiderivative exactly, so an integral can
  be split there rather than refused.
- Cauchy principal values: when to offer them, and how to present them.
- Definite integrals with symbolic parameters: case splitting on sign
  conditions, as Mathematica's `Assumptions` does. What is the minimal version?

### Q8. Limits (for a planned Limit tab)

The Gruntz algorithm (Dominik Gruntz, 1996 thesis; SymPy's `gruntz`): the
MRV set, rewriting, and the series step. Please give a version for exp/log
functions of one variable, with pseudocode, plus examples like
`(1+1/x)^x → e`, `x^{1/x} → 1`, `(√(x²+x) − x) → 1/2`, and `sin(x)/x → 1`.
Where do simpler methods (L'Hôpital, series substitution) suffice for a course,
and where do they fail or loop?

### Q9. Series (for a planned Series tab)

- Holonomic / D-finite functions: from an expression, derive a linear ODE with
  polynomial coefficients, then a recurrence for the Taylor coefficients, and
  hence a **general term or recurrence** for products such as `sin(x)e^{x²}`
  (closure properties; Salvy–Zimmermann `gfun`; `guess` in FriCAS). When does a
  recurrence have a closed-form hypergeometric term (Petkovšek's Hyper)?
- The radius of convergence from the nearest singularity: a practical method
  for elementary expressions.
- Evaluating known series in closed form: `Σ1/n! = e`, `Σ(−1)ⁿ/(2n+1) = π/4`,
  `Σ1/n² = π²/6`. Which summation algorithms (Gosper, Zeilberger, table lookup
  of hypergeometric identities) are practical here?

### Q10. The AP / Calc II curriculum as a coverage target

Using the College Board's AP Calculus BC Course and Exam Description (units 6,
8 and 10), plus a standard Calc II syllabus: list the integral, limit and series
**types** students must handle, each with two or three canonical examples.
Flag any this engine (as described in §3) does not cover.

## 7. Format of the reply

One section per question, in the order above. Code as TypeScript-like
pseudocode over exact rationals. Mark every claim of the form "X is not
elementary" with a reference or proof sketch, because the engine will say it
to students. Prefer depth on Q1, Q2, Q3, Q4, Q8 and Q9: those unlock the most.
