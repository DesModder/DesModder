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
