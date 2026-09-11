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
