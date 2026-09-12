# Physics and Calculus Lab handoff

Nothing has been built yet. This is the brief for starting it, written after
building Audio Lab against its own specification, so it carries what that
actually cost as well as what its spec asked for.

Source: `AP_Physics_and_Calculus_DesModder_Extension_Build_Specification.docx`
(in `~/Downloads`). It is not readable by the usual `.docx` tooling on this
machine — there is no Python. Unzip it and parse `word/document.xml` with node;
paragraphs are `<w:p>`, text runs are `<w:t>`, and `w:pStyle w:val="Heading1"`
marks the sections.

## Read this first

Physics Lab is a **third independent plugin**. It must not import from
`src/plugins/vector-tools` or `src/plugins/audio-lab`, and neither of them may
import from it. That includes test helpers: Audio Lab has its own fake WebGL
rather than reaching for Vector Tools', and Physics Lab should do the same
rather than reaching for either.

If a genuinely neutral utility turns out to be worth sharing, extract it into a
package with its own tests and have all three depend on that. Do not let one
plugin reach into another, even once, even for something small.

## Scope reality

This specification is much larger than Audio Lab's. Audio Lab was nine gates
and roughly half-built when work started. This is eleven gates, and gate 0 is
the only thing that exists.

The spec's own scope advice is the important part, and it is right:

> The most important scope discipline is to build shared engines before
> accumulating presets.

Seven one-off simulators would each re-implement parsing, state, rendering, and
validation. The engines below are what make the unit catalogues cheap.

## Recommended order

The spec's gate list, with the reasoning it gives for the ordering:

| Gate | Deliverable                           | Why here                                                          |
| ---- | ------------------------------------- | ----------------------------------------------------------------- |
| 0    | Plugin shell and lifecycle            | Proves isolation and clean teardown before anything depends on it |
| 1    | Quantity engine                       | Units and dimensions improve every later unit                     |
| 2    | Model registry and expression adapter | Safe graph ownership protects every graph from here on            |
| 3    | Data lab                              | Tables, fits, residuals, uncertainty                              |
| 4    | Calculus expression actions           | Limits, derivatives, integrals, accumulation                      |
| 5    | ODE and slope fields                  | Reused by cooling, RC, decay, SHM, motion, flow                   |
| 6    | Physics 1 mechanics                   | The largest exam-weighted area                                    |
| 7    | Electric field explorer               |                                                                   |
| 8    | Circuit laboratory                    |                                                                   |
| 9    | Physics 2 and BC presets              |                                                                   |
| 10   | AP reasoning layer                    | Assumptions, setup, interpretation, checks                        |
| 11   | Optimisation and browser integration  |                                                                   |

A realistic v1 boundary, from the spec: quantity engine, model registry,
equation pathway, data lab, calculus actions, first-order ODE/slope fields,
core Physics 1 mechanics, electric-field explorer, DC/RC circuits, PV diagrams,
ray diagrams, wave superposition, modern-physics presets. BC parametric, polar,
and Taylor tools come after the AB foundations. Explicitly deferred: dense 3D
fields, arbitrary circuit nonlinearities, full computer algebra, stiff ODE
solvers, arbitrary distributed-charge geometry, complete multi-element optics.

## Layout

```text
src/plugins/physics-lab/index.ts   controller and lifecycle only
components/                        Desmos-themed panel tabs and controls
quantities/                        dimensions, units, constants, uncertainty
models/                            typed model registry, AP presets by unit
expressions/                       ownership manifest and expression generation
numerics/                          root finding, fits, quadrature, RK45, events
diagrams/                          field, circuit, optics, PV, wave generators
workers/                           off-main-thread computation protocol
```

## What Audio Lab learned that applies directly

These are not restatements of the spec. They are things that only showed up in
the building, and every one of them will recur here.

**Split the session from the panel on day one.** Audio Lab was written with the
panel owning the audio, the analysis, and the renderer, and closing the popover
silently stopped all three. Unpicking it later was a real refactor. Physics Lab
has the same shape — a panel controlling long-lived generated content — so put
the state on the controller from the start and make the panel a view over it.

**Write to the graph on a throttled clock, never with `setState`.** Creation of
a generated set can be one `setState`, which makes it atomic and undoable.
Everything after that must be `setExpressions` with id and latex, coalesced, and
values that have not changed dropped before they are sent. Audio Lab has a test
asserting `setState` is never called during playback; Physics Lab wants the
equivalent for slider drags. The spec says the same thing in its performance
section — "avoid full graph-state serialization for routine parameter changes."

**Own IDs explicitly, never by prefix.** Audio Lab removes only the exact IDs in
its manifest, with a regression test that keeps a user expression sharing its
prefix. Vector Tools learned this the hard way — see its `removeGeneratedSet`
comment about `vector_tools_vf_default_scratch`. This will matter more here,
because Physics Lab generates far more per model.

**A fake WebGL does not validate GLSL.** Audio Lab's field passed 26 unit tests
against a GL double while being completely invisible on screen — additive
blending over white graph paper. If Physics Lab gets a WebGL overlay, compile
its shaders on a real GPU and _measure the pixels_, do not look at a screenshot
and call it fine. Bundle a harness with esbuild and open it in the browser pane;
it takes ten minutes and it is the only thing that catches this class of bug.

**Numerical results need a reference, not a plausibility check.** Audio Lab's
band energies looked correct and were wrong in two independent ways, both found
by feeding a synthetic tone with a known answer. Physics Lab has far more of
this: every ODE case, every circuit, every field integration wants an analytic
reference case, and the spec asks for exactly that in its acceptance tests.

**Say what a thing is, especially when it is an approximation.** Audio Lab's
three meanings of `W_audio(x)` are labelled in the panel because a
representative sinusoid, the recent waveform, and an additive reconstruction are
different objects. The spec's whole "Correctness and trust" section is this
point, and it is the difference between a teaching tool and an answer machine.

## Verification

```bash
npm run lint
npm run test:unit
npm run build-ff
npm run build
```

**Run the Chrome build last, always.** Both write to `dist/` and esbuild wipes
the directory first, so whichever ran last wins. The Firefox build writes
`manifest_version: 2`, which Chrome refuses to load — leaving `build-ff` last
breaks the reload loop with "Cannot install extension because it uses an
unsupported manifest version."

Then load `dist/` unpacked at `chrome://extensions` and hard-refresh
`https://www.desmos.com/calculator`.

## Open questions to settle before gate 1

These change the shape of the code and are worth a decision rather than a
default:

1. **Does the quantity engine touch the user's mathematics?** The spec says
   units attach "without changing the visible mathematics." That implies a
   parallel annotation store rather than units inside latex, which is a
   different design from putting them in the expressions.
2. **How much symbolic capability?** "Rearrange common algebraic relationships"
   and "integrate indefinitely where supported" sit between a lookup table and a
   CAS. Vector Tools already has a `symbolic.ts` — worth reading before deciding
   what Physics Lab needs, though not importing.
3. **Workers now or later?** The spec wants ODE integration, circuit solving,
   regression, and field integration off the main thread. Retrofitting a worker
   boundary is unpleasant; committing to one before there is anything slow is
   speculative. A reasonable middle is to keep the numerics pure and
   transferable so moving them later is mechanical.

---

## What gate 0 established, and what it found

Built: `src/plugins/physics-lab/`, registered, disabled by default, with the
session split from the panel on day one per the Audio Lab lesson above. Also
`symbolic/exact.ts` — exact real constants — because it is the foundation of
the symbolic work and depends on none of the open questions below.

### Verified against a real Desmos

Three facts, each checked in a browser rather than assumed. The first one
changes the design.

- **A differential equation has no answer box.** Desmos parses `\frac{dy}{dx}`
  as `d·y ÷ d·x`, marks the row with an error triangle, and puts **"add
  slider: d"** exactly where `1+1` gets its `= 2`. So the evaluation box that
  shows `2` under `1+1` does not exist on the rows a solver would want to write
  into. Whatever surface the solution appears on has to be built; it cannot be
  borrowed.
- **`\sqrt{2}^{3}` evaluates to `2.82842712475`** and there is no setting,
  anywhere, that shows `2\sqrt2`. The exact form genuinely has to come from us.
- **`(-8)^{1/3}` has no value in Desmos at all** — not an error row, no `=`
  line. `exact.ts` deliberately answers `-2`, the real cube root, because that
  is the convention an AP course teaches. It is the one case where an exact
  answer appears beside a blank evaluation box rather than beside a decimal.

### The exact-constant engine

`symbolic/exact.ts` holds a value as a **sum of products**,
`Σ q · π^a · e^b · Π p_i^{c_i}`, with rational exponents over `bigint`
rationals. Two normalisations do the visible work: prime exponents fold into
[0, 1), which is what turns `(\sqrt2)^3` into `2\sqrt2` and rationalises
`1/\sqrt2` into `\frac{\sqrt2}{2}`; and the coefficient is factored into primes
before any root, so `\sqrt{8}` finds `2^3`. π and e stay opaque atoms, which is
what keeps `\frac{\pi^2}{2}` from collapsing to 4.9348.

It refuses rather than approximates — a sum in a denominator, a fractional
power of a sum, `2^\pi`, an unknown function — and the caller shows Desmos's
decimal instead.

One bug worth recording because assertions could not see it: `\pi` emitted
beside `e` is `\pie`, an undefined command that renders as **nothing**. The
unit tests were happy. `concat` in `exact.ts` inserts a space only where two
fragments would glue into one command name, and the integration test now round-
trips emitted LaTeX through Desmos's own evaluator for exactly this class of
failure.

Evidence: `docs/assets/physics-lab-exact-value.png`.

### Vector Tools is a soft dependency

Rafael's direction, and it differs from Audio Lab's rule: Physics Lab **may**
build on Vector Tools and **must** work without it. Everything that reaches for
it goes through `PhysicsLabSession.vectorTools`, which returns `undefined` when
the plugin is disabled, and every caller handles that. Reaching for
`dsm.vectorTools` anywhere else is what would turn a shared component into a
hard dependency by accident.

### Decisions taken, 2026-09-09

- **Symbolic answers appear in the panel, with an "Add to graph" button.** The
  answer box was the original request and it does not exist on the rows that
  need it. Injecting our own row into the expression DOM, and patching Desmos's
  evaluation view through a `.replacements` file, were both offered and
  declined — the second because it joins the §5.4 class of breakage that panics
  on load whenever Desmos ships a new build.
- **The live renderer is extracted into a neutral shared module** that Vector
  Tools and Physics Lab both depend on, rather than copied or cross-imported.
  Slope fields therefore work with Vector Tools disabled. This touches working,
  verified Vector Tools code, which was accepted as the price.

### Next

Gate 1 in the table above is the quantity engine. Ahead of it, and unblocked by
the decisions above: extracting `ArrowRenderer` / `latexToGLSL` / `palettes`
into the shared module, then slope fields as a dash geometry over it — a slope
field is `(1, f(x,y))` normalised, with the arrowhead taken off, so it is the
existing instanced-line machinery with a different vertex program.

The symbolic solver's scope should follow the curriculum rather than the
textbook: AP Calculus BC examines separable equations, slope fields and Euler's
method, and AP Physics adds RC, cooling, decay and SHM. Separable plus
first-order linear covers essentially all of it, and `exact.ts` is what lets the
constant of integration and the coefficients come out in the form a student is
expected to write.

---

## The renderer extraction, and slope fields

Done, and verified against a real Desmos.

**`src/field-rendering/`** now holds the whole drawing half that used to be
Vector Tools': both renderers, both overlays, the LaTeX-to-GLSL compiler, the
GLSL field prelude, the palettes, the environment scan, the identifier rules and
the GL test double. Vector Tools and Physics Lab both depend on it and neither
owns it. The move was mechanical — git recorded every file as a rename, no logic
changed — and Vector Tools' own 18 integration tests are the guard. They pass,
and it still draws, checked in a picture rather than only in assertions.

Two additive changes to the shared renderer, both off unless asked for:

- `ArrowOptions.centered` straddles the sample point instead of starting from
  it. A vector has a tail; a slope mark is a tangent line and does not.
- The overlay's canvas id is now a parameter. An id is unique to a document, and
  two overlays sharing one would each remove the other's canvas on start — a bug
  that could not exist while only one plugin drew.

**A slope field is a vector field with the arrowheads taken off.** `dy/dx =
f(x,y)` is the direction field of `(1, f)`, so there is no second renderer here:
the marks are the arrows, at one length because only the direction carries
information, head size zero, centred on the sample point. That is the whole
implementation.

### How it was verified, and one trap

`readPixels` on the overlay canvas reported **zero** non-transparent pixels
while the field was drawing perfectly well. The context has no
`preserveDrawingBuffer`, so reading it outside a frame returns an empty buffer.
It is a false negative, and taking it at face value would have sent someone
hunting a rendering bug that did not exist.

What did work was reference cases with known answers. `dy/dx = 0` gives marks
that are exactly horizontal; `dy/dx = 1` gives exactly 45° up and to the right,
which also pins the sign convention; and for `dy/dx = x - y` the analytic
solutions `y = x - 1 + Ce^{-x}` plotted over the field run tangent to every mark
they cross. That last one is the permanent evidence
(`docs/assets/physics-lab-slope-field.png`) and the integration test generates
it rather than anyone taking it by hand.

### The panel

Rewritten in Vector Tools' style rather than Audio Lab's: a real DCGView
component whose controls take getters, `onUpdate` for anything that cannot be an
attribute, inputs re-synced only while unfocused, chips instead of `<select>`, a
`SegmentedControl` tab bar, and real MathQuill fields for both maths inputs. The
gate-0 panel followed Audio Lab's static-template-plus-plain-DOM-runtime pattern
and has been removed.

The colour modes offered are a deliberate subset of what the renderer
implements: `x-component` is the constant 1 at every mark in a slope field, so
it would colour the whole field flat and offer a control that does nothing.
Magnitude is `sqrt(1 + f²)`, which is steepness, and is named that.

### Still open

Flow (fieldplay particles) over a slope field is nearly free now that
`FlowRenderer` and `FlowOverlay` are in the shared module, but it is not wired
up. The symbolic solver for separable and first-order linear equations is not
started; `symbolic/exact.ts` is what will let its constants come out in the form
a student is expected to write.

---

## Solving the equation, not just drawing it

The slope field now comes with the solution, in the same tab, under the equation
it solves.

`symbolic/integrate.ts` is antiderivatives over the Aug tree — the mirror of
Vector Tools' `symbolic.ts` and deliberately less capable, because the two
problems are not the same size. Differentiation is mechanical; integration is
not, and most expressions have no closed form at all. It covers the power rule
and its logarithm exception, exponentials, trigonometry, linear arguments with
their `1/a` factor, and integration by parts restricted to a polynomial times
something that keeps its form. **Everything else is refused by name.**

The parts restriction is not a shortcut. `∫u·w = u·W − ∫u'·W` only terminates if
`u'` eventually reaches zero, which a polynomial guarantees and nothing else
here does — general parts can recurse until the stack goes or return to where it
started. Restricting to a polynomial is tabular integration, and the
polynomial-times-exponential case it covers is exactly `∫x·e^x`, which is what
solving `dy/dx = x − y` comes down to.

`symbolic/ode.ts` solves first-order equations in three cases, which between
them are the whole syllabus: free of y (antiderivative), affine in y
(`y = -b/a + Ce^{ax}` — growth, decay, cooling, RC, terminal velocity), and
separable (left as a relation). The constant of integration is emitted as the
identifier `C`, so **Desmos offers a slider for it** — a one-parameter family you
can drag through, sitting over the marks it has to stay tangent to. That is the
best available outcome rather than a workaround.

### Nothing is reported without being checked

Every solution is substituted back into the original equation numerically —
across sample points and several values of C — before it is returned, and
discarded if it does not satisfy it. Implicit solutions are checked through the
implicit function theorem instead: `-F_x/F_y` has to be the f that was given.

This is not belt-and-braces. A symbolic slip produces a plausible curve with the
right shape and the wrong constant, which a reader cannot catch, and the whole
promise of drawing the solution over the slope field is that the two agree. The
check found four real defects during the build that the LaTeX assertions were
perfectly happy with.

### Getting the form right

Correct was never the hard part; the form a student would write was. Four
simplifier rules exist only for that, and each was added against a specific ugly
answer:

- **Same-base exponentials fold within a product.** The integrating factor
  multiplies by `e^{-∫a}` and then by `e^{∫a}` again, so without folding them
  `dy/dx = x − y` answers `e^{-x}(xe^{x}-e^{x}+C)` — the same function, and not
  the one in any answer key. Folding needs the factors flattened first, since
  the two powers arrive on opposite sides of the polynomial part, and the
  integrating factor has to be _distributed_ over the sum before there is
  anything for the fold to act on.
- **Signs are hoisted out of products and folded through sums**, so parts gives
  `sin(x) − x·cos(x)` rather than `x·-cos(x) − -sin(x)`.
- **A negative power is written as a fraction**, so separating `dy/dx = x·y²`
  ends at `-1/y` rather than `y^{-1}/-1`.
- **A quotient of two numbers folds only when it comes out whole.** `1/2` stays
  a fraction. This is the one pipeline in the plugin whose entire purpose is
  keeping values exact, and a decimal appearing in it is a defect.

And `+C` is appended textually in the direct case rather than emitted from the
tree, because the simplifier is free to reorder a sum and turns `-cos(x)+C` into
`C-cos(x)`. The tree keeps C where it is, because the tree is what gets
verified.

`symbolic/latex.ts` converts `\operatorname{abs}(…)` to bars and drops the
parentheses a function call puts around an already-delimited argument, so a
logarithm reads `\ln|x|`. Both walk `\left`/`\right` pairs rather than matching
a regular expression — the naive version breaks on `abs(f(x))`, closing at f's
bracket and leaving the rest outside the bars, which still parses and quietly
means something else.

### Evidence

`docs/assets/physics-lab-slope-field.png` is generated by the integration test.
The curve in it is not written by the test: the panel solved `dy/dx = x − y`
itself, and the button put _its_ answer into the graph. So the picture checks
the solver and the renderer against each other rather than either against
something hand-written. `C` arrives undefined and Desmos offers the slider, as
designed.

### Scope, honestly

Second-order equations, systems, Euler's method, initial conditions and exact
equations are all absent. Partial fractions and general substitution are absent,
so `dy/dx = y(1-y)` — the logistic equation, which is on the BC syllabus — is
refused rather than solved. That is the next obvious piece of work.

---

## Rendered maths, a panel that fits, and the logistic equation

### The readouts are maths now

Both the solution and the exact value render through `StaticMathQuillView`
rather than being printed as their own LaTeX source. Desmos already draws
formulae better than anything this plugin would ship, and an answer written
`\frac{x}{3}` asks the reader to parse the notation before they can read the
result. The string is still carried in a `data-latex` attribute, so the
integration tests assert on exactly what the button will insert.

### The panel does not scroll sideways

420px, wide enough that three number fields sit on a row and a heading sits
beside its button. `overflow-x: hidden` on the panel and the body; the section
head and the inline rows wrap. Only `.dsm-physics-lab-math` is allowed to be
wider than the panel and scroll on its own, because only an expression has no
upper bound on its length — and MathQuill lays a formula out as a single line,
so a forced wrap breaks it across a fraction bar rather than at an operator.

A horizontal scrollbar on the panel moves the controls out from under the
pointer, which is a far worse cost than a long expression needing a swipe.

### The logistic equation

`dy/dx = ry(1 - y/K)` now solves in closed form: `y = K/(1 + Ce^{-rx})`,
labelled with the carrying capacity. Three things had to be built for it.

**Partial fractions**, done on the factors rather than by finding roots.
`1/(L₁L₂) = A/L₁ + B/L₂` with `A = a₁/D`, `B = -a₂/D`, `D = a₁b₂ - a₂b₁`, and
the integral collapses to `ln|L₁/L₂| / D`. Root-finding was the obvious approach
and the wrong one: the logistic denominator is `y(1 - y/M)`, whose roots are 0
and M, and a solver needing numbers for them would refuse the one form the
equation is always written in. D is zero exactly for a repeated factor, which is
declined — and repeated factors are now collapsed into a power beforehand, so
`(x+1)(x+1)` reaches the power rule where it always belonged.

**A closed-form recogniser ahead of the general separable path.** Separating the
logistic succeeds and answers with a relation between logarithms, which is a
complete answer and not the one the syllabus teaches. It is recognised as a
quadratic in y with no constant term — so `y = 0` is an equilibrium — which
covers `ky(1-y/M)`, `ky(M-y)` and `y(1-y)` without caring which way round it was
typed. `coefficientsIn` reads polynomial coefficients that may themselves be
expressions, which is what allows the capacity to come back as `M`.

**Reading `y(1-y)` as multiplication.** Desmos's parser resolves juxtaposition
before a bracket as function application, so `y\left(1-y\right)` arrives as a
`FunctionCall` whose callee is `y`. That is the right reading of the notation in
general and the wrong one here, and it is not a corner case — it is how every
textbook writes the equation, so without the rewrite the headline case was
refused in the only form anybody types. Restricted to the two variables of the
equation: a call to `f` or `g` might genuinely be a function the graph defines.

Two simplifier additions came with it. Factors are now flattened through
division and through a negation, not only through multiplication, because the
integrating factor meets its opposite across a fraction bar far more often than
beside it — `e^{3x}·(x·e^{-3x}/-3)` is what `dy/dx = x + 3y` produces, and a
flattener stopping at the fraction leaves both exponentials in plain sight.
And common factors cancel across a fraction, which is what reduces the logistic
capacity `-k / -(k·(1/M))` to `M`. Cancelling `k` assumes it is non-zero; that
is the ordinary convention, and here it is additionally safe because the result
is checked numerically before anybody sees it.

Evidence: `docs/assets/physics-lab-logistic.png`, generated by the integration
test — the S-curve leaving zero, bending, and flattening along the marks at the
carrying capacity.

### Still open

Initial conditions are the obvious next piece: every exam question asks for a
particular solution through a given point, and C appears linearly in every form
produced here, so solving for it is a linear substitution rather than a new
method. After that, second-order constant-coefficient equations — which is SHM,
and needs a different input shape than `dy/dx =`.

---

## Second-order equations

`d²y/dx² = f(y, v)`, on its own tab, where **v means dy/dx**.

### Why `v` and not `y'`

Because `y'` does not parse. Asking Desmos's parser for `y'` returns an error
node — checked directly, along with `y''` and `-3y'-2y`, all of which fail while
`-3v-2y` parses cleanly. The briefing's rule that Desmos cannot be taught new
notation applies exactly here, so an input built around primes could never be
read back at all.

That makes the substitution forced, and it is also the right one: `v = y'` is the
reduction of order every textbook performs, and in physics v is the velocity the
equation is usually about.

### What it solves

`y'' = p·v + q·y + r` with constant coefficients, through the characteristic
equation `s² - ps - q = 0`. All three root cases, because all three turn up in
the problems this is for:

| Discriminant | Solution                      | What it is                       |
| ------------ | ----------------------------- | -------------------------------- |
| positive     | `C₁e^{s₁x} + C₂e^{s₂x}`       | overdamping                      |
| zero         | `(C₁ + C₂x)e^{sx}`            | critical damping                 |
| negative     | `e^{αx}(C₁cos βx + C₂sin βx)` | SHM when α is 0, damped when not |

The `x` in the repeated-root case is the whole content of that case: with one
root the two exponentials are the same function, so they span one dimension and
cannot meet two initial conditions.

A constant term shifts the family by the equilibrium it holds — `y''` and `v` are
both zero there, so `q·y + r = 0`.

Two constants, `C_1` and `C_2`, so Desmos offers two sliders.

### The roots are exact, and that is the point

The characteristic roots go straight into an exponent, where a decimal is not a
rounding: `e^{√2x}` and `e^{1.4142135623730951x}` are different answers and only
one of them is the one being asked for. So the discriminant is carried through
`exact.ts`, and `y'' = 2y` comes back as `C₁e^{√2x} + C₂e^{-√2x}`.

This is what `exact.ts` was built for, and using it here needed one addition:
`toNode`, which produces a syntax tree rather than a string. An exact constant is
not only something to display — these roots get built into a solution that is
then differentiated twice numerically and checked against the equation, and a
string cannot be checked. `toNode` groups radicals the same way `toLatex` does,
which is not cosmetic: the discriminant of `y'' = -v - 4y` is -15, and leaving
its factors apart puts `√3·√5` in an exponent where a reader expects `√15`.

Coefficients must be exact numbers. A symbolic one — `y'' = -ω²y`, which is how
a physicist writes it — is refused, because the sign of the discriminant decides
which of three completely different solutions is correct and there is no way to
know the sign of ω² without knowing ω. Substituting a number, or a slider's
value, is the way through.

### Verification

The same rule as everywhere else: substituted back before it is reported. Both
derivatives are taken numerically and both are fed back in, with `v` bound to the
candidate's own first derivative at each point, so it tests the equation rather
than one differentiation. The tolerance is looser than the first-order check and
has to be — a second difference divides by h², so it carries roughly the square
root of the precision a first derivative does, and tightening it rejects correct
answers.

Evidence: `docs/assets/physics-lab-second-order.png`.

### Still open

Initial conditions, which would turn every general solution here into the
particular one an exam question asks for. Non-constant forcing terms — `y'' + y =
cos(2x)` needs undetermined coefficients or variation of parameters. Systems, and
with them phase planes, which the shared field renderer could already draw.

And the direction Rafael has named for later: PDEs for 3D Desmos. Nothing here
assumes one independent variable in its data structures, but every solver does,
so that would be new work rather than an extension — the separable heat and wave
equations are the tractable start, and `src/field-rendering` already knows how to
put a surface-shaped thing on screen.

---

## The prime is real after all

`d²y/dx² = -y′-4y`, typed with an apostrophe. The earlier note here said the
substitution to `v` was forced; that was half right and the wrong half was the
conclusion.

What is true is that **Desmos's parser** rejects `y'` — checked directly, and it
returns an error node. What is not true is that the input had to work around it.
**MathQuill holds the prime perfectly well**: it renders `−y′−4y` and hands the
latex back, and the panel is the extension's, not Desmos's, so what is displayed
and what is parsed never had to be the same string. The prime is rewritten to
`v` on the way to the parser and the user never sees it. A literal `v` still
works, since it needs no rewriting.

The lesson is narrower than the original note made it: the parser cannot be
taught new notation, and that says nothing about what the editor can hold.

## Initial conditions

"Find the particular solution through (0, 2)" is the second half of almost every
differential-equation question, and a family with a slider on it is the answer
to the first half only. The slope tab now takes a point under the solution and
reports the constant that passes through it.

No new solver. The point is substituted into the solution and what is left is
one equation in C, which is tractable because C enters every form produced here
in exactly one of three ways:

- **Linearly** — `y = F(x) + C`, `y = A + Ce^{ax}` — so `C = (y₀ - b)/a`.
- **In a denominator**, which is the logistic equation alone. Its reciprocal
  _is_ linear in C, so the same solve runs on `1/y₀`.
- **As the gap in a relation**, for the implicit separable answers:
  `L(y) = R(x) + C` gives C directly.

`linearIn` does the work in all three, which is the third distinct job that one
function now has — it also splits a slope field's equation and a second-order
equation's coefficients.

The button inserts `C = …` beside the curve rather than substituting the value
in. Desmos stops offering a slider once C is defined, which is exactly right for
a particular solution, and the two expressions stay readable as what they are:
the family, and the member of it the condition picks.

One simplifier addition came with it. An initial condition is nearly always
given at x = 0, and substituting it produces `\sin(0)`, `\cos(0)` and `e^{0}` in
every solution with a trig term or an exponential. Unfolded, the constant reads
`C = \pi - \sin(0)`. `foldKnownValue` is a deliberately narrow table — only
values that are exactly representable, so `\sin(1)` is left alone and no decimal
ever appears.

## Reading a decimal backwards

Desmos answers `\pi^2` with `9.86960440109`, and that number is what a student
ends up carrying. Pasting it into the Exact value tab now names it.

**This one guesses, and the panel says so.** Every other piece of `symbolic/`
refuses rather than approximates, because an exact answer derived from an
expression is a claim that can be checked. This is the opposite direction and
cannot be: infinitely many constants agree with any finite decimal, and
`9.86960440109` is exactly 986960440109/100000000000 as surely as it is π². So
the readout says "matches all 12 digits you gave" rather than claiming the
number _is_ that constant.

Two things keep it honest. The tolerance is half a unit in the last place the
user actually typed, so a candidate has to agree with every digit rather than be
nearby — `9.86960440509` is refused. And below six significant digits only a
plain rational is offered, because `3.14` is π to the digits given and is also
157/50, and at that length half the search space would match something.

The search is: for each atom — 1, powers of π, powers of e, a square root, π
times a small root — divide and fit the remainder as a rational with a bounded
denominator by continued fractions. The bound is what makes the search mean
anything; without it continued fractions reproduce any input exactly and every
atom would "match". Atoms are tried simplest first, so a number that is merely
rational comes back as a fraction rather than as some baroque multiple of π.

## The panel, reorganised

460px, and everything fits at a normal window size with no horizontal scroll at
any level. Number fields pair up two to a row instead of stacking. The mark
appearance controls — length, thickness, colour, palette — fold into an
**Appearance** disclosure, the same arrangement Vector Tools uses for the flow's
fine tuning: what decides the picture stays on screen, what refines one that
already exists does not.

## Still open

Initial conditions for second-order equations, which need two conditions and a
symbolic derivative of the solution to set up the 2×2 system. Non-constant
forcing terms. Systems, and with them phase planes.

---

## Two CSS bugs, and the phase plane

### The panel was clipped to 290px

`.dsm-pillbox-popover { width: 290px }` is a single-class selector, and the
override was `.dsm-physics-lab-popover { width: auto }` — also a single class.
Equal specificity, so the winner was whichever stylesheet loaded last, and it
was not this one. The panel rendered at 290px with the third tab off the edge
and a horizontal scrollbar underneath.

Vector Tools had this right from the start:
`.dcg-container .dsm-pillbox-popover.dsm-vector-tools-popover` is three
selectors and always wins. Copied.

### The pillbox icon looked smaller

It measured the same: 16px font, a 16×16 box, identical to every other button.
Desmos's own icon font simply draws `scientific` at a smaller scale inside its
em box than the `dsm-icons` glyphs beside it. Only that one button's icon is
scaled up, to 21px, so it reads as an equal.

The first attempt at that selector matched nothing, and the reason is worth
recording: `dsm-action-menu` is a class **on the pillbox button itself**, not on
an ancestor, so `.dsm-action-menu [data-buttonid=…]` — with a space — asks for a
descendant that does not exist. The measurement is what caught it; the icon
still reported 16px after the rule was added.

## The phase plane

`y'' = f(y, y')` has no direction field over x and y at all. The slope at a
point depends on the velocity there as well, so a point on the plane does not
determine a direction and there is nothing to draw. Against **y and y′** there
is: writing the equation as the pair `y' = v`, `v' = f(y, v)` makes it a
first-order system, and a system in two variables is exactly what the arrow
renderer already draws.

So the graph's x is y and the graph's y is v, the horizontal component is the
graph's own y — the first equation of the pair written out — and the user's f is
renamed into those coordinates. Renamed rather than string-replaced:
`renameIdentifier` from the shared module scans identifiers properly, so a `v`
inside a subscript or a function name is left alone.

Two deliberate differences from the slope field:

- **Arrows, with heads.** A slope field mark has no head because dy/dx is a
  slope and a slope has no direction. A phase-plane trajectory runs one way in
  time, and leaving the head off would throw that away.
- **One overlay, not two.** Starting the phase plane stops the slope field. The
  two use different coordinate systems, and drawing both would put two meanings
  on one pair of axes.

A non-autonomous equation is refused: if f depends on x, the field would change
with x and the plane has no axis left to show that on.

Evidence: `docs/assets/physics-lab-phase-plane.png`. The check is the direction
of rotation — a damped oscillator spirals clockwise, so arrows point down where
y is positive and up where it is negative. A phase plane drawn with its two
components swapped looks just as reasonable and turns the other way.

---

## Differentiation, with the rules recorded

`symbolic/differentiate.ts`. Vector Tools already differentiates, and this is
deliberately a different artifact rather than a copy: `symbolic.ts` answers
"what is the derivative" for generating expressions, and this has to answer
"what did you do, and where", which changes the shape of the code. Every rule
reports itself, simplification is kept separate so the intermediate form is
still visible, and the dispatch has to pick the rule a course would pick rather
than merely a correct one.

### Picking the rule, which is half the content

More than one rule is technically correct almost everywhere, and choosing badly
produces steps that are right and unreadable:

- `3x²` takes the **constant multiple** rule. The product rule gives
  `0·x² + 3·2x`, which is correct and which nobody writes.
- `x²` takes the power rule **without** the chain rule, because the inner
  derivative is 1 and a step that multiplies by 1 teaches nothing. `(3x+1)²`
  takes both.
- `2^x` is the exponential rule, not the power rule — the variable is upstairs.
  `x^x` is neither and needs logarithmic differentiation.
- `f/c` is a constant multiple, not a quotient; the quotient rule squares the
  constant and then cancels it again.

Each of those has a test asserting the _rule names_ in the derivation, not only
the answer.

### Coverage

Constant, identity, constant multiple, power, sum, difference, product,
quotient, chain, exponential (base e and general base), logarithm (natural and
base 10), all six trig, all six inverse trig, all six hyperbolic, three inverse
hyperbolic, root, absolute value, logarithmic differentiation, and implicit
differentiation through the implicit function theorem.

Every function name was checked against Desmos's own `autoOperatorNames` list
before being used, so nothing in the table emits a name the calculator does not
have.

### How it is verified

Three ways, and the second is the one that matters. Each derivative is checked
against the form a course writes; against a **numerical derivative of the
original**, which is what catches a dropped chain factor or a flipped sign; and
— for the rules whose derivatives are spelled with `sech`, `csch` or `arcsec` —
against **Desmos's own evaluator**, in the integration suite. That last one
exists because the unit tests evaluate with JavaScript's maths and would never
notice a function name Desmos lacks. It caught nothing, which is the point of
running it.

Two real defects turned up while writing it, both invisible to the LaTeX
assertions: the numeric evaluator had no `sech`, `csch`, `coth` or inverse
hyperbolics, so six correct derivatives were being "checked" against NaN and
passing by never being tested; and `simplify` could not fold `½ - 1`, because a
fraction of two integers is a Divide node rather than a Constant, so the power
rule on `x^{1/2}` produced `x^{1/2-1}`. `simplify` now does exact rational
arithmetic on fractions — without either operand passing through a decimal.

### Still open

The steps are recorded and nothing displays them yet: the tab, and the matching
instrumentation of `integrate.ts`, are the next piece. The generated "similar
example" should re-run the same rule chain with different constants, so it is
guaranteed to be the same shape of problem rather than a hand-picked one.

Also noted for later: animating the phase plane with Vector Tools' time
architecture, which would want modes for `t` — periodic or constant — rather
than the unbounded clock a vector field uses.

---

## The Derivative tab

The engine had no view; it has one now. Type an expression, pick the variable
from a chip row, and get the derivative with the rules that produced it.

Four things about how it presents, each of which was wrong first:

**The steps run outermost first.** The recursion finishes innermost-first, so
recording in completion order gives the small derivatives before the reason for
them — a log rather than a derivation. A worked solution opens with "apply the
product rule" and _then_ does the two pieces it asked for. Each step reserves
its slot before recursing and fills it afterwards, so the outer rule lands in
front of the ones it depends on.

**The prose contains no LaTeX.** The first version built its sentences with the
emitter — "With u = x^{2} and v = \operatorname{sin}\left(3x\right)" — which
renders as exactly that, as text, next to the maths it was describing. The
sentences now say what to do without naming the pieces, because the pieces are
already on screen underneath.

**Each rule shows its general form.** `RULE_FORMULAS` holds `(uv)'=u'v+uv'`,
`d/dx x^n = nx^{n-1}`, `d/dx f(g) = f'(g)·g'` and the rest, rendered as maths
beside the step. That is a different statement from the prose and the more
useful one: the prose says what happened here, the formula is what transfers to
the next problem. Rules whose statement is already the sentence — "a constant
differentiates to zero" — have no entry rather than a formula repeating it.

**Each step shows its result tidied.** The rules literally produce `2x^{1}` and
`3\cdot1`, and a reader following the method does not need to watch arithmetic
that has not happened yet. The general formula beside it already says what the
rule did, so the concrete line can be the readable form.

Two simplifier additions came out of it, both visible in ordinary answers:
a coefficient buried on the right comes to the front, so `x²·(3cos 3x)` reads
`3x²cos 3x`; and it is built left-nested, because the Aug emitter brackets a
product hanging off the right of another and `3·(x²cos 3x)` prints with the
bracket still in it.

### The worked example

Built from the user's own expression by changing its constants and leaving the
shape alone. That is what makes it _similar_: the tree is unchanged, so the
dispatch takes the same branches and the example needs exactly the rules just
explained. Choosing a second problem from a list would give something that looks
alike and may want a rule the reader has not met. An exponent is never allowed
to land on 0 or 1, since both collapse the power rule into a case that is no
longer an example of it. Its answer is behind a disclosure — the point is to try
it first.

Evidence: `docs/assets/physics-lab-derivative.png`.

---

## The derivation is a tree

The Derivative tab shipped explaining itself as a flat list of every rule it
touched. That list was accurate and it was not a derivation: it lost the one
thing worth teaching, which is that a rule ran _inside_ another. The engine now
returns a tree, and the panel renders the hierarchy.

`derive` returns `{ derivative, step }` at every node, and there is no other way
to get either. Nothing computes an answer and then reconstructs a story for it —
a story reconstructed from an answer can disagree with the answer, and the
disagreement would be invisible, because both halves look plausible.

### Three levels, one tree

Every step carries an `importance`:

- **major** — a structural decision. Which rule applies to this shape, and why.
- **supporting** — a sub-problem worth naming. "Differentiate x²."
- **atomic** — a fact. The derivative of x is 1; a constant goes to 0.

The standard view hides the atomic ones and `Every step` stops hiding them. Both
render the _same_ tree, so switching cannot change an answer — there is only ever
one derivation. The outermost step is never hidden, or a derivation that filtered
down to nothing would be a blank panel reporting success.

`x²(sin 3x)^{eˣ}` was seven cards. It is now three: product rule, power rule,
logarithmic differentiation — with the chain rule and the exponential nested
under the third, and the derivative of 3x folded into the chain step.

Two dispatch changes did most of that shortening. `3x` is now one atomic fact,
`d/dx(cx) = c`, rather than a coefficient rule wrapped round a derivative of 1;
and a chain of additions is flattened before it is differentiated, so
`x⁴+3x²-7x+2` is one step with four children instead of three nested sum cards
all saying the same sentence.

### What a step shows

A structural rule names the pieces it split the problem into — `u = x²`,
`v = (sin 3x)^{eˣ}` — and then shows **itself applied with the smaller
derivatives still outstanding**:

    d/dx(x²)·(sin 3x)^{eˣ} + x²·d/dx((sin 3x)^{eˣ})

That middle line is the move being taught. Jumping from the product rule
straight to a fully expanded answer hides the only thing `(uv)' = u'v + uv'`
does, which is turn one problem into two smaller ones. It is built with Aug's
`Derivative` node over a paren-wrapped `Seq`, because the emitter brackets what
sits under a `d/dx` only when it binds looser than addition — without the `Seq`,
`d/dx x²sin(3x)` comes out with nothing to mark where the product ends.

A supporting step shows its answer and no middle line: there, the middle line
would say nothing the answer does not.

### The power rule and the general power rule are two rules

The old prose for `x²` read "bring the exponent down as a factor and reduce it by
one". Beside `(sin 3x)^{eˣ}` — which is on the same screen, in the same
expression — that sentence is not a simplification but a falsehood, and a reader
carries it to the next problem. The recognition line now says _the exponent is a
constant_ before it says anything about bringing it down, and logarithmic
differentiation says "do not bring the exponent down: it is not a constant".

`power` and `power-chain` are separate rules with separate formulas for the same
reason: `d/dx u^n = nu^{n-1}` written beside a base of `3x+1` is the exact
omission that loses the factor of 3.

### Domain conditions

Logarithmic differentiation puts `ln(sin 3x)` into the answer to a question that
never mentioned a logarithm, so the answer is only real where `sin 3x > 0`. That
condition is recorded by the rule that introduced it and shown under the answer.

Only conditions the _derivation_ introduces are recorded. `ln u` already wants a
positive `u` and the reader can see that; a note that appears on every answer is
one nobody reads on the answer where it matters.

### Simplifying is not a rule

The last card is `Tidy up`, it is not numbered, and it says so: the rules
produced one form, collecting it gives the same function written more briefly.
Both forms are shown, because by that point the answer has scrolled away.

It appears only when tidying did something a reader would notice — the rules
produce `2x¹` where the answer is `2x`, and a card about that is a card about
nothing.

### The practice problem is a problem

The answer used to sit under the question behind a disclosure, which is not much
of a question. It is now behind **Show solution**, with **Hint** beside it and a
field to answer in.

The hints are read off the example's own derivation — outermost structure first,
atomic steps skipped, at most three — so a hint cannot point at a structure the
expression does not have, and "the derivative of x is 1" never becomes one.

An attempt is marked by **evaluating both sides**, not by comparing strings:
`3x²sin(4x) + 4x³cos(4x)` with its terms the other way round is the same
derivative, and no amount of string matching will agree that it is. Two
expressions that take the same value everywhere they are defined are the same
function, and that is the thing being marked. An expression undefined at every
sample point is reported as unreadable rather than wrong — it has not been marked
at all.

Changing the question clears the attempt, the hints and the revealed answer.
An answer left on screen from the previous problem reads as the answer to this
one.

## The panel resizes

Same arrangement as Vector Tools, for the same reason and with the same
debounce: `resize: both` with a non-visible overflow, the size read back off the
element's inline style rather than its rendered box, and one write per drag
rather than sixty. Reading the rendered box would remember a `max-height` clamp
from a short window and shrink the panel permanently.

A derivation is what made it necessary. An answer and the lines under it have no
bound on their width, and a reader who wants to see one of them whole should not
have to choose which.

Two things followed:

**The equation fields fill the panel.** Desmos's inline math input is an
inline-block that shrink-to-fits, and the MathQuill field inside caps its own
max-width against whatever the container reports — a container with nothing to
report settles it at a few dozen pixels and _clips_ the expression, unreadable
exactly when it grows long enough to need reading. Every level down to the field
now gets a definite full width and the field's own pixel cap is overridden.

**A long answer is broken over lines** at its top-level `+` and `-`, and nowhere
else: a break inside a product or under a fraction bar reads as a different
expression. Where to break is decided by counting what actually gets drawn rather
than the LaTeX — `\operatorname{sin}\left(` is twenty-four characters and four
glyphs — which is a proxy, not a measurement. The resize handle is the exact
answer; this is the one that needs no dragging.

Evidence: `docs/assets/physics-lab-derivation.png`,
`docs/assets/physics-lab-practice.png`.

---

## The derivation renders as a tree

The tree was in the data and not on the screen. `stepsOf` flattened it into a
numbered list, so `x²(sin 3x)^{eˣ}` read as six sequential operations when three
of them were sub-computations the third one asked for. The hierarchy is now
drawn.

### Rows, not steps

A derivation step becomes more than one thing on screen, so the session emits
**rows**: a `rule` row, then its children's rows, then a `substitute` row
carrying that rule's own result. Flat rather than nested because DCGView builds
a template once — a genuinely recursive component would have to rebuild itself
whenever the expression changed shape — and because depth plus indentation plus
a left rule draws the hierarchy for nothing.

Labels say the same thing for anyone reading rather than looking: `1`, `1a`,
`1b`, `1b-i`.

### Cause before effect

The old step 3 showed `3eˣcos(3x)/sin(3x)` before step 4 explained where
`3cos(3x)` came from. A rule now announces itself, shows itself applied with its
sub-derivatives **still written as `d/dx(…)`**, and its result is assembled in a
row below its children rather than beside its announcement. A rule row with
children carries no result at all; it has not been earned yet.

### Sub-problems are headed by what they are

`1a. Differentiate u` beside `x²`, with `Power rule` named underneath. The
heading is the sub-problem and the rule is the annotation, not the other way
round — which part of the original is being worked on is the first thing a
reader loses in a nested derivative, and a rule name does not say it. The
subexpression is shown boxed beside the heading.

The name comes from the parent: a rule records `childRoles` alongside its
`substitutions`, so the child that came from `u = sin(3x)` is headed
"Differentiate u" rather than "Differentiate".

### Standard and Every step are depths of one tree

`standard` draws depth ≤ 1 — the outermost rule and the sub-problems it creates,
which is the shape of the expression. `full` draws all of it. Nothing is
recomputed and no step is re-classified; the two views cannot say different
things because there is only one tree.

That replaced filtering by importance, which had the same effect by accident and
did not survive contact with a fourth level of nesting.

### Rules that can show where they come from

In the full view, logarithmic differentiation derives itself: `y = u^v`, take
logs, differentiate both sides, multiply through by `y`. `RULE_DERIVATIONS`
holds it. Nobody guesses `u^v(v' ln u + vu'/u)` and everybody can follow taking
logs of both sides, so the rule that looks arbitrary is the one that gets
shown; a rule whose statement is its own justification has no entry.

### Wording that survives being generalised

Three changes, each because the old sentence teaches something false when it
meets the next problem:

- The power rule now says **the exponent 2 is constant** before it says anything
  about bringing it down, and adds that this is not available when the exponent
  contains the variable. The same expression can hold `x²` and `(sin 3x)^{eˣ}`.
- Logarithmic differentiation says "both the base and the exponent depend on x,
  so neither the ordinary power rule nor the ordinary exponential rule is
  sufficient" — which is the actual reason, rather than a statement of where the
  variable is.
- The chain rule names an **outer function and an inner one**, and records both
  as substitutions: `outer = sin(u)`, `u = 3x`. "Multiply by the derivative of
  the inside" does not survive `sin(e^{x²+1})`, which has three insides and no
  way to say which.

`Derivative of a linear term` is now `Linear rule`, since the heading above it
already says it is differentiating the inner function.

## The function simplifier

`symbolic/factor.ts`. `condense(node)` returns the expression a person writes
and a list of what it did to get there.

It is deliberately separate from `simplify` in `integrate.ts`, and the split is
the point. That one is **structural** — folding constants, cancelling factors,
removing multiplications by 1 — all of which have one right answer. This one is
**presentational**: pulling a common factor out of a sum and rewriting a quotient
of trig functions make an expression shorter without making it simpler in any
formal sense, so the panel offers both forms rather than choosing.

Two passes, run to a fixpoint:

**Common factors.** Candidates come from the first term's factors, since a
common factor is by definition one of them, and only factors above the bar are
considered: `f` divides `a·f + b·f/g` and pulling it out is right, whereas
treating a denominator as a candidate gives something equal only where that
denominator is non-zero. One factor per pass, because the remainder is a fresh
sum the next pass walks into — which is how the inner `eˣ` comes out after the
outer power has.

**Quotient identities.** `cos u / sin u → cot u` and `sin u / cos u → tan u`,
matched across a flattened numerator and denominator so `3eˣcos3x/sin3x` finds
them. The reciprocal identities are left alone: `1/sin u` is not obviously
better as `csc u`, and a rewrite that is a matter of taste does not belong in a
pass that runs unasked.

It will not pull numbers out — `2x + 4x²` stays, because `2x(1 + 2x)` is longer
to read and nobody writes it — and it will not match powers of a shared base,
because pulling `x²` out of `x³ + x²` is the first step of factoring to find
roots and doing that silently inside an answer helps nobody.

On the expression this was written for:

    2x(sin3x)^{eˣ} + x²(sin3x)^{eˣ}(eˣln(sin3x) + 3eˣcos3x/sin3x)
    →  (sin3x)^{eˣ}(2x + x²eˣ(ln(sin3x) + 3cot3x))

Every unit case asserts two separate things: the **shape**, which is a matter of
taste and can be argued with, and the **value** at a spread of points, which
cannot. A factoriser that drops a term or loses a sign produces something
shorter and entirely plausible, and only evaluating it notices. The integration
test goes further and asks Desmos itself to evaluate both forms and subtract
them.

The notes carry the factor as a **tree**, not a label. The first version guessed
at a short string and printed `sin` for a factor of `sin(3x)^{eˣ}` — a note
naming something that is not a factor of anything. Emitting LaTeX needs a parser
`Config`, which that module has no business holding, so the caller does it.

## The practice problem

**Check answer** is now a button. A verdict that updated on every keystroke told
somebody halfway through typing that they were wrong, which was both true and
useless; editing an answer withdraws the verdict on the previous one.

**Hints escalate.** A question about the outermost shape, then the names of the
pieces, then a question about whichever piece is actually hard — read off the
example's own derivation, so a hint cannot point at a structure the expression
does not have. Handing over the substitutions at the first press would end the
exercise, and the recognition _is_ the exercise.

## Smaller things

The tab bar draws its own lower boundary, because the body scrolls under it and
a step heading arriving at the top edge otherwise reads as part of the tab row.
`scroll-padding-top` and `scroll-margin-top` keep anything scrolled to clear of
it.

`sameTree`, `topLevelTerms`, `rebuildSum` and `quotientFactors` moved into
`integrate.ts`, which is where the shared tree tools already lived. Three
callers want term-splitting and all three want it to mean exactly the same
thing.

Evidence: `docs/assets/physics-lab-derivation.png` (the tree),
`docs/assets/physics-lab-rule-derivation.png` (a rule deriving itself),
`docs/assets/physics-lab-factored.png` (the simplifier).

### Still open

The integrator is still not instrumented and the tab shows no integrals — the
last piece, and the harder one: integration has no single dispatch the way
differentiation does, so "which rule and why here" is a genuinely different
question there. Several of its steps are _choices_ rather than forced branches,
and the explanation has to say why the choice was made.

The simplifier is not exposed on its own. It runs on derivatives; a tab where an
arbitrary expression could be handed to it is a small amount of wiring and has
not been asked for.

And the phase plane could animate through Vector Tools' time architecture, which
would want bounded modes for `t` — periodic, or held — rather than the unbounded
clock a vector field uses.
