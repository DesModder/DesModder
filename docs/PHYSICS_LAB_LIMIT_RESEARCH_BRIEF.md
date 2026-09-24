# Research brief: the Physics Lab Limit tab

_Written 2026-09-24 for a research assistant (GPT) with no access to the code.
Everything you need to know about the system is in this document. What I need
back is described in §5. This follows an earlier brief on the integrator; its
answer on limits (a graduated plan ending in a Gruntz subset) has been read and
is not what is being asked again._

---

## 1. What this is

**Physics Lab** is a plugin in a browser extension for the **Desmos graphing
calculator**, aimed at AP Calculus AB/BC, Calculus II, and AP Physics. It now
has a **Limit tab**: the user types an expression and a point (a number, an
expression like `π/2`, or `±∞`), picks "both sides", "from the left" or "from
the right", and the panel shows:

- the **indeterminate form**, when there is one (`0/0`, `∞/∞`, `0·∞`, `∞−∞`,
  `1^∞`, `0^0`, `∞^0`);
- **L'Hôpital's rule** as actually applied: each line is the derivative of the
  numerator over the derivative of the denominator, up to four times;
- the **exact value** (`e`, `3/5`, `−π/2`, `+∞`) with a decimal beside it, and
  the **method that decided it**, recorded by the rule that fired: "Direct
  substitution", "Leading terms", "Squeeze theorem", "Rewritten as an
  exponential of a logarithm, then series expansion", "Growth rates",
  "Factoring out the dominant term", "L'Hôpital's rule, applied twice";
- **"does not exist"** as an answer, with its reason: both one-sided limits
  when they differ (`|x|/x` at 0), or a proof of oscillation for `sin(g)` /
  `cos(g)` when `g` runs off to infinity (`sin(1/x)` at 0);
- a **refusal** when nothing decides it.

Every answer is also checked numerically (the function sampled at 10⁻¹ … 10⁻⁸
from the point, or 10¹ … 10⁸ out). Values that settle somewhere else hide the
answer; values that approach too slowly to see are reported as "not confirmed".

The engine is hand-written **TypeScript in the browser**, no CAS, no server,
over Desmos's own syntax tree (`Constant | Identifier | Negative | Add |
Subtract | Multiply | Divide | Exponent | FunctionCall | Norm (|x|) |
Piecewise`). It has exact arithmetic over rationals with atoms for π, e,
square roots and logarithms of primes; an exact truncated Laurent-series engine
about 0 with rational coefficients; a complete differentiator; and a limit
engine with rules for sums, products, quotients, polynomial ratios at infinity,
`exp(B ln A)` for variable powers, growth-rate dominance (exponential beats
power beats log), squeeze by a bounded factor, and the series fallback.

## 2. Rules the engine lives by (non-negotiable)

1. **Refuse rather than guess.** A number the function seems to approach is
   evidence, not a limit. Numeric sampling is a check, never the method.
2. **Exact values only**, decimals beside them.
3. **Name the method from what actually decided it.**
4. **Textbook form, in Desmos's LaTeX.**
5. **A trade-off becomes a labelled control with a default**, not a decision
   made for the user.

## 3. What works today

`sin x/x → 1`, `(x²−4)/(x−2) → 4` at 2, `(√(x+4)−2)/x → 1/4`,
`(1+1/x)^x → e`, `(1+2x)^{1/x} → e²`, `x^x → 1` at 0⁺, `sin 3x/sin 5x → 3/5`,
`(3x²+1)/(2x²−x) → 3/2` at ∞, `√(4x²+1)/x → −2` at −∞, `x − ln x → ∞`,
`ln x/√x → 0`, `e^x/x^{10} → ∞`, `x eˣ → 0` at −∞, `x sin(1/x) → 0`,
`cos x/x → 0` at ∞, `sin(x−π)/(x−π) → 1` at π, `tan x → +∞` at π/2⁻,
`|x|/x` at 0 does not exist (−1 and 1), `sin(1/x)` at 0 does not exist.

## 4. What does not, and the questions

### Q1. Conventions a course uses — please be exact, with sources

(a) `lim_{x→0} √x`: the function has no left side. Does AP Calculus (College
Board CED, released FRQ scoring guidelines) treat this as `0`, or as "does not
exist", or avoid it? Stewart? What should a teaching tool say? (Currently: it
reports the right-hand limit with a note saying so.)

(b) `lim_{x→0} 1/x² = ∞`: AP answer keys say the limit "does not exist" but
accept "= ∞" — what exactly is the convention, and how should the panel phrase
an infinite limit so it is right under it?

(c) When the two sides are `−∞` and `+∞` (`1/x` at 0), is the conventional
statement "does not exist", or "the one-sided limits are −∞ and +∞"?

### Q2. The algebraic methods a course expects, as steps

AP students are taught to evaluate `0/0` by **factoring and cancelling**,
**rationalising with a conjugate**, **trig identities** (`sin 2x = 2 sin x
cos x`, `1 − cos²x = sin²x`), and **dividing by the highest power** at
infinity — before L'Hôpital. The engine already knows the answer; the question
is how to _present_ the textbook route.

- An algorithm that, given `P(x)/Q(x)` with a common factor `(x−a)^k`, produces
  the cancelled form and says so; the same for a conjugate `√A − B`.
- A rule for choosing which method to show (a decision table: shape of the
  expression → method a teacher would use), with examples.
- How L'Hôpital must be guarded: the loop in `√(x²+1)/x`, the growth of
  `e^{1/x}`-type expressions under repeated differentiation. What is a
  decreasing measure that proves progress, and what to show instead when the
  rule is the wrong tool?

### Q3. Proving "does not exist" beyond sin/cos of an unbounded argument

Which non-existence proofs are implementable and sound: `x sin x` at ∞
(unbounded oscillation), `sin(x)·(1 + 1/x)`, `(−1)^⌊x⌋`, `floor(x)` at an
integer, `sin(1/x) + x`, `e^{1/x}` at 0 (sides `+∞` and `0`)? Give a general
criterion (e.g. two sequences to the point with different limits, constructed
symbolically), its scope, and test cases including ones it must refuse.

### Q4. Piecewise functions and floor/ceil

The standard AP one-sided question is a piecewise function. Desmos writes
`\left\{x<1:x^{2},2x+1\right\}`. What is the correct one-sided rule at and near
each boundary (strict vs non-strict conditions, conditions that are not of the
form `x < c`), and for `⌊x⌋`, `⌈x⌉`, `round`, `sign` at their jumps?

### Q5. Series about a point that is not rational

`sin(x)` about `π/6` needs coefficients `1/2`, `√3/2`, … . The series engine
has rational coefficients only. What is the smallest extension that makes
`(sin x − 1/2)/(x − π/6)` at `π/6` exact — expanding `f(a + h)` with the
addition formulas and keeping the special values as exact atoms, or a
coefficient field `Q(√2, √3)` — and where does it stop?

### Q6. Symbolic parameters

`sin(ax)/x → a`, `(1 + a/x)^x → e^a`, `(x^n − 1)/(x − 1) → n` at 1. How do
SymPy/Maxima/Mathematica decide these, and when must the answer split
(`a > 0`, `a = 0`, `a < 0`)? What should a teaching panel show: the general
answer with a stated condition, or cases?

### Q7. Numeric confirmation that is honest

The check today: a finite limit is "confirmed" when the best agreement at any
sample distance is within 10⁻⁵ relative, or the error at least halves per
decade. Is there a better-founded test — Richardson extrapolation, Wynn's
epsilon, Aitken — that confirms slowly converging limits (`1/ln x → 0`,
`x^{1/x} → 1`) without ever confirming a wrong one, in double precision?
Give the procedure and its failure modes (cancellation near the point).

### Q8. Practice problems

The Derivative tab generates "a similar problem" by changing constants and
keeping the expression tree. For limits the similar problem must keep the
_form_ and the _method_ (a `0/0` at the same kind of point, still factorable).
How should constants be chosen so the new problem is still `0/0` at the new
point and still solvable by the same method? Examples welcome.

### Q9. A coverage test suite

Please give **50 limits** that span AP Calculus AB/BC Unit 1 plus the limits
that appear in BC Units 6 and 10 (improper integrals, series tests), each with
its exact answer, its form, the method a textbook uses, and whether a
two-sided limit exists. Include at least 10 that do not exist and 5 that a
tool should refuse.

## 5. Format of the reply

One section per question, in order. For each: the algorithm or rule precisely
enough to implement (TypeScript-like pseudocode over exact rationals), its
scope, 5–15 test cases with answers, primary sources, and a judgement of
cost/benefit (now, later, never). Depth matters most on Q1, Q2, Q3 and Q4,
because those are what a student meets first.
