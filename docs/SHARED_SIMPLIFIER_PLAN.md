# A shared simplifier for Physics Lab and Vector Tools

Groundwork, written before any of it is built. Nothing here has been moved
yet; what has been done is a survey of what already exists and one experiment
that settles the biggest unknown.

## Why this is worth doing at all

There are three simplifiers in the tree right now, and two of them are the
same simplifier.

| Where                                       | What it does                                          | Lines |
| ------------------------------------------- | ----------------------------------------------------- | ----- |
| `plugins/vector-tools/symbolic.ts`          | Structural fold: constants, identities, `2y` ordering | ~70   |
| `plugins/physics-lab/symbolic/integrate.ts` | The same fold, plus signs, shared bases, cancelling   | ~150  |
| `plugins/physics-lab/symbolic/factor.ts`    | Presentational: common factors, trig identities       | ~300  |

The duplication is not accidental and it is already documented as such —
`integrate.ts` says of its own `simplify`, in the code, "This is the same fold
Vector Tools' differentiator uses, for the same reason." Two copies of one fold
is two places for a rewrite to be added and one place for it to be forgotten.

That is not the real cost, though. The real cost is that they have **already
drifted**, and the copy the user sees more often is the worse one. Running both
over the same trees:

```
same  vt=2                      pl=2
same  vt=0                      pl=0
same  vt=x/y                    pl=x/y
same  vt=2y                     pl=2y
DIFF  vt=-\left(3x\right)       pl=-3x
DIFF  vt=2x+-\left(2x\right)    pl=0
DIFF  vt=\frac{6x}{3}           pl=2x
```

Vector Tools emits `2x+-\left(2x\right)` where the answer is `0`, and
`\frac{6x}{3}` where the answer is `2x`. A partial derivative shown in the
Vector Tools panel today is sometimes worse-looking than the same expression
would be in Physics Lab, for no reason other than which file it went through.

## The experiment, and what it settles

The question that decides whether this is a merge or a rewrite: does Physics
Lab's fold subsume Vector Tools', or do they disagree anywhere that matters?

Vector Tools' `simplify` was replaced wholesale with Physics Lab's and the
suites run:

- **72/72** Vector Tools unit tests pass unchanged.
- **1983/1983** unit tests across the repo pass unchanged.

So the structural half of this is a **drop-in**. Every case where the two
differ, the Physics Lab one is the better answer, and nothing in the repo
depends on the weaker output. That is the cheapest part of the job and it
should be done first, on its own, so that the win is visible before anything
harder is attempted.

(The probe was a temporary edit and has been reverted; the tree is unchanged.)

## What "general" should mean — three jobs, not one

The thing to resist is a single `simplify(node)` that everybody calls and
nobody can predict. There are three genuinely different questions here, and
`factor.ts` already gets the distinction right for two of them:

**Fold** — structural. Constants collapse, `×1` and `+0` disappear, a sign
moves onto a coefficient, `6x/3` becomes `2x`. There is exactly one right
answer and nobody would prefer the input. Safe to apply everywhere, always,
without asking.

**Condense** — presentational. A common factor comes out of a sum, `cos/sin`
becomes `cot`. Shorter, not simpler in any formal sense, and a matter of
taste — which is why Physics Lab _offers_ both forms rather than choosing, and
why `condense` returns notes saying what it did. Never applied without the
caller asking for it.

**Normalise** — canonical, for comparison rather than for reading. "Is the
student's answer the same function as mine?" is not answered by folding both
and comparing strings; `x(x+1)` and `x²+x` fold to different trees and are the
same function. Physics Lab answers this today with `agreesOnSamples` in
`evaluate.ts`, numerically, and that is the right answer — a canonical form
strong enough to decide it is a computer-algebra problem, and a canonical form
weak enough to build is one that says "different" about things that are not.

Keeping these three named separately is most of the design. A shared module
that exported one function called `simplify` would immediately acquire a
`{ factor?: boolean, canonical?: boolean }` options bag, and from there it
becomes the thing nobody can predict.

## Where it goes

`src/symbolic/`, a neutral package below both plugins, exactly as
`src/field-rendering/` already sits below Vector Tools, Audio Lab and Physics
Lab.

Not an import from one plugin into the other. The separation rule in the
Physics Lab handoff bans a dependency between plugins, and is explicit that the
way out is extraction:

> If a genuinely neutral utility turns out to be worth sharing, extract it into
> a package with its own tests and have all three depend on that.

A simplifier over Aug trees is about as neutral as a utility gets. It knows
about `text-mode-core` and about nothing else.

## What would move, and roughly in what order

Ordered so that each step is separately verifiable and separately revertable.

1. **The fold.** `simplify` from `integrate.ts` and `symbolic.ts` becomes one
   `src/symbolic/fold.ts`, with the union of both test suites. Already proven
   to be a drop-in; this is the step that pays for itself immediately.
2. **The tree utilities.** `visit`, `dependsOn`, `sameTree`, `topLevelTerms`,
   `rebuildSum`, `quotientFactors` and the builders currently live in
   `integrate.ts` beside the integration rules, and Vector Tools has its own
   `visit` and `dependsOn`. These are the vocabulary the rest is written in, so
   they have to move before anything that reads them.
3. **`condense`.** Moves as-is; it already has no Physics Lab specifics in it.
   Vector Tools gains factored partial derivatives for free, which is the
   second visible win.
4. **The numeric check.** `evaluate.ts` is what makes any of this safe to
   extend — a rewrite is a claim, and `agreesOnSamples` is how a claim gets
   checked at a few points in a few microseconds. Anything added to the fold
   after the move should be checked this way in its own test, and that
   discipline is easier to keep if the checker lives in the same package.
5. **Exact constants, if wanted.** `exact.ts` and `rational.ts` are the one
   part of this that is genuinely Physics-Lab-shaped today — they exist so that
   `(√2)³` displays as `2√2` rather than as a decimal. A general simplifier
   that can fold `√8` to `2√2` wants them; a Vector Tools partial derivative
   probably does not. **Left out until there is a caller.**

Steps 1–3 are mechanical and covered by existing tests. Step 4 is a move with
no callers changing. Step 5 is a decision, not a move.

## What it must refuse to do

The existing code is unusually disciplined about this and the shared version
has to stay that way, because a half-built CAS is worse than none: it produces
a plausible expression that is quietly not the same function, and the reader
has no way to tell which of the two is lying.

The refusals already written down, which should survive the move:

- `cancelSharedCoefficient` cancels only an **exactly equal** numeric factor.
  "Full common-factor reduction is a computer algebra problem, and a half-done
  version that cancels the wrong thing would be worse than leaving the fraction
  as it is."
- `factorSums` refuses numeric factoring (`2x+4x²` stays) and refuses shared
  bases (`x³+x²` stays), because both change what the expression looks like it
  is _about_.
- `recognize.ts` is the only module that guesses, and it says so in its own
  doc comment and reports a match as a candidate rather than as a derivation.

The rule that ties these together: **refuse rather than approximate, and if you
must approximate, say so at the call site.** Anything added to the shared fold
should be held to it.

## Decisions still to take

These change what gets built and are not settled here.

1. **How far the fold should go.** Collecting like terms (`2x + 3x → 5x`) is
   the obvious next rewrite and is genuinely wanted for derivative answers. It
   is also the first step onto the road that ends in a term-ordering scheme and
   a canonical form, which is the CAS this is trying not to become. Worth
   deciding as a boundary up front rather than one rewrite at a time.
2. **Whether Vector Tools' panel should offer the factored form.** Physics Lab
   shows expanded and factored side by side. Vector Tools shows one partial
   derivative in a readout. Free once `condense` moves; still a UI choice.
3. **Whether exact constants come along** (step 5 above), which is really the
   question of whether Vector Tools ever wants to show `√2/2` instead of
   `0.7071`.
4. **Whether Audio Lab is a third caller.** It has no symbolic layer today. If
   it never will, the package is shared by two plugins rather than three, which
   is still enough to justify it but is worth knowing before the API is set.

## Evidence

- Both folds run over the same ten trees; output table above.
- Physics Lab's fold substituted for Vector Tools': 72/72 Vector Tools unit
  tests, 1983/1983 repo unit tests, unchanged.
- Repo state at the time of writing: `12c63407`.

---

# What was actually built

Everything above is the plan as written before starting. This section records
what happened, including the two places the plan turned out to be wrong.

`src/symbolic/` now exists and holds `tree.ts`, `fold.ts`, `condense.ts`,
`expand.ts`, `evaluate.ts`, `latex.ts`, `notes.ts` and an `index.ts` that
states the three-names argument where somebody will read it. Physics Lab and
Vector Tools both import from it and neither has a simplifier of its own.

Steps 1–4 went as planned and were a drop-in. Step 5 was left out: exact
constants still live in Physics Lab, because nothing else has asked for them.

**`latex.ts` moved too, which the plan did not anticipate.** It was the same
story a second time: Vector Tools' `toLatex` and Physics Lab's shared a
character-for-character identical `\cdot`-dropping regex, and Physics Lab's did
two more things on top. One emitter now, and Vector Tools gained absolute-value
bars for free.

**`expand` is new, and is the reason the extraction happened when it did.** It
is `condense`'s opposite: it multiplies products out, splits a fraction over a
sum in its numerator, and writes a small whole-number power of a sum out in
full. The point is integration — there is no product rule for integrals, so
`∫(x+1)(x+2)dx` has no rule that matches it and `∫x²+3x+2 dx` is three
applications of the power rule.

Three things about it that the plan did not foresee:

- **It needed the like-term collection that decision 1 was about**, because
  the fold collects only _adjacent_ like terms — it is written one binary
  operator at a time — and `(x+1)(x+2)` distributes to `x·x + 2x + x + 2` with
  a term in between. Without gathering, expanding a pair of binomials produces
  `x²+2x+x+2`, which is worse than what it started from. The gathering lives
  in `expand.ts` rather than in `fold.ts`, so the fold's behaviour everywhere
  else is untouched.
- **It needed a term order**, for the same reason: `(x+2)(x²-3)` distributes
  in the order the factors were written and comes out `x³-3x+2x²-6`. Terms are
  now sorted by descending degree. It is a _stable_ sort on a single number, so
  terms it cannot rank keep the order they were written in and nothing is
  reordered on a rule the code cannot state — that is what keeps it a display
  order rather than the first half of a canonical form.
- **Every rewrite is size-capped individually, not once at the end.** A pass
  that expands `(x+1)^8(x+2)^8` in one go builds a sum of thousands of terms
  before anything asks how big it is, and the fold that runs next overflows the
  stack rather than returning something to measure.

**The integrator tries both routes and keeps the shorter answer.** The first
version tried expansion only after a refusal, which missed `(x+1)(x+2)`
entirely: integration by parts _succeeds_ on it and answers
`(x+1)(x²/2+2x) - (x³/6+x²)`, which is a correct antiderivative and is not what
anybody writes. Two antiderivatives of one integrand differ by a constant, so
there is nothing to choose between them on correctness and the shorter one is
the answer. A tie goes to the unexpanded route, which is what keeps
`∫(x+1)^7 dx` answering `(x+1)^8/8` rather than eight terms of the same
function.

Decision 2 (a factored form in Vector Tools' panel) and decision 4 (Audio Lab)
are still open, and `expand` is not offered in any panel yet — it exists for
the integrator.

## Evidence, second pass

- 2003 unit tests, 73 integration tests, lint clean, Chrome build.
- `expand`'s every case asserts both the shape and, at six sample points, that
  it is still the same function — including each rewrite run once on its own,
  because the loop could hide a bad rewrite behind a good one.
- New integrals that used to be refused: `∫(x+1)(x+2)dx = x³/3 + 3x²/2 + 2x`
  and `∫(x²+1)/x dx = x²/2 + ln|x|`.
