# Vector Tools — a full briefing

This document exists to hand an outside researcher (a model, or a person)
everything needed to propose new features and new approaches for **Vector
Tools** without having to read the source first, and without proposing
something the platform has already been proven not to allow.

It is written to be read cold. It states not only what the plugin does but
_why each decision is the way it is_, because several of them look wrong until
you know what they are working around, and the cost of relearning them is
measured in days.

If you are asked to research or design something for this project, read
sections 1–6 before proposing anything, and hold your proposal against
section 10.

---

## 1. What this is

**Vector Tools** is a plugin inside a personal fork of **DesModder**, a browser
extension that adds features to the Desmos graphing calculator. It is not a
standalone app and never will be: it runs inside a real desmos.com page, on top
of a calculator someone else wrote and ships new builds of without warning.

Its purpose is to make **multivariable calculus and linear algebra easier to
see**. The target user is a student or instructor in a Calc 3 / differential
equations / linear algebra course who wants a vector field, a flow, a gradient,
or a transformation on the screen in front of them, and who should get it
without effort and with the fluidity of Desmos itself.

Two design commitments follow from that and constrain everything:

- **It must render effortlessly.** If a picture takes visible work to obtain,
  it has failed at its job.
- **What it produces should survive without the extension where it reasonably
  can.** A field generated into the expression list is an ordinary Desmos
  graph, shareable with someone who has never heard of this plugin.

### Repository

|              |                                                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Fork         | `daguitarman55555-byte/DesModder` (push to `origin` only)                                                                 |
| Upstream     | `DesModder/DesModder`, merged in at `53ff70bc` — **never push there**                                                     |
| Branch       | `feature/vector-tools-foundation`                                                                                         |
| Plugin       | `src/plugins/vector-tools/`                                                                                               |
| Docs         | `docs/VECTOR_TOOLS_ARCHITECTURE.md`, `VECTOR_FIELD_GENERATOR.md`, `VECTOR_FLOW_VISUALIZER.md`, `VECTOR_TOOLS_TEST_LAB.md` |
| Host version | DesModder 0.15.17                                                                                                         |

### Everything must pass

```
npm run lint            # prettier --check, tsc --build, eslint
npm run test:unit       # 1592 tests
npm run test:integration  # 53 tests, real Desmos in headless Chrome
```

The integration harness loads the built extension (`npm run build` → `dist/`)
into puppeteer and drives an actual desmos.com calculator.
`driver.page.screenshot(...)` works and screenshots are read as part of
verifying a change — **most bugs in this plugin have been invisible to
assertions and obvious in a picture.**

---

## 2. The shape of the plugin

Vector Tools is one configuration driving **three independent renderers**, plus
the shared libraries they draw on.

```
                         VectorFieldConfig  (model.ts, JSON, schemaVersion 3)
                                  |
        +-------------------------+-------------------------+
        |                         |                         |
   generator.ts              ArrowRenderer            FlowRenderer
   (Desmos expressions)      (live WebGL arrows)      (GPU particles)
        |                         |                         |
  ExpressionAdapter          ArrowOverlay              FlowOverlay
  (getState/setState)        (own canvas + ctx)        (own canvas + ctx)
        |                         |                         |
   the graph itself        transparent overlay over the graph paper

  shared: palettes.ts (ramps, emitted three ways: Desmos, GLSL, CSS)
          latexToGLSL.ts (LaTeX subset → GLSL, against an environment)
          environment.ts (what the expression list defines)
          symbolic.ts (exact partial derivatives — currently no caller)
```

### 2.1 The renderer is no longer this plugin's

Everything above the adapter line — `ArrowRenderer`, `FlowRenderer`, both
overlays, `latexToGLSL`, `field.ts`, `palettes`, `environment`, `identifiers`
and the GL test double — now lives in **`src/field-rendering/`**, which Vector
Tools and Physics Lab both depend on and neither owns.

It moved because a slope field is a vector field with the arrowheads taken off,
and the alternative to sharing was a second copy of a thousand lines of shader
that would drift. The move was mechanical: no logic changed, git recorded every
file as a rename, and this plugin's integration suite is the guard that it
still draws what it drew before.

Two things did change, both additive and both off by default here:

- `ArrowOptions.centered` draws a mark straddling its sample point instead of
  starting from it. A vector has a tail and a slope mark does not. Vector Tools
  does not set it.
- The overlay's canvas id is a parameter rather than a constant, because an id
  is unique to a document and two overlays sharing one would each delete the
  other's canvas on start. Vector Tools keeps the id it always had.

The four mode unions (`VectorLengthMode`, `VectorColorMode`, `ColorRangeMode`,
`FlowColorMode`) moved to `field-rendering/types.ts` for the same reason and are
re-exported from `model.ts`, so nothing that read them from `model` had to
change.

### File map

Rows marked **↑** no longer live in this plugin. They moved to
`src/field-rendering/` when Physics Lab needed the same renderer — see 2.1.
Everything about how they work is unchanged; only the import path is.

| File                              | Lines | What it owns                                                                |
| --------------------------------- | ----: | --------------------------------------------------------------------------- |
| `model.ts`                        |  ~965 | `VectorFieldConfig`, defaults, normalization, validation, presets, limits   |
| `generator.ts`                    |   653 | config → deterministic `VectorFieldPlan` of Desmos expressions; audit       |
| `desmos/ExpressionAdapter.ts`     |   270 | the **only** calculator boundary; apply / remove / audit a generated set    |
| `index.ts`                        | ~1070 | the plugin controller: settings, overlays, dispatcher, component sync       |
| `components/VectorToolsPanel.tsx` | ~1180 | the DCGView panel (Field / Arrows / Color / Flow tabs)                      |
| `↑ palettes.ts`                   |  ~460 | colour ramps as stops, emitted as Desmos LaTeX, shader uniforms **and** CSS |
| `↑ environment.ts`                |  ~125 | scans the expression list for what a component may reference                |
| `symbolic.ts`                     |   409 | exact symbolic partial differentiation over Desmos's own syntax tree        |
| `↑ latexToGLSL.ts`                |  ~700 | compiles the usable subset of Desmos LaTeX to GLSL ES 3.00                  |
| `↑ field.ts`                      |  ~110 | the shared `vtField(vec2 p)` prelude, helpers, and parameter uniforms       |
| `↑ ArrowRenderer.ts`              |  ~590 | instanced arrows, geometry from `gl_VertexID`/`gl_InstanceID`               |
| `↑ ArrowOverlay.ts`               |  ~245 | the arrows' canvas, bounds, visibility, context loss                        |
| `↑ FlowRenderer.ts`               |  ~985 | ping-ponged particle textures, RK4 advection, trails                        |
| `↑ FlowOverlay.ts`                |  ~255 | the flow's canvas, bounds, visibility, context loss                         |
| `↑ glTestDouble.ts`               |    90 | a fake WebGL2 both renderers are unit-tested against                        |

---

## 3. The three renderers

### 3.1 Generator — ordinary Desmos expressions

`generator.ts` maps one config to a `VectorFieldPlan`: one folder plus hidden
helpers (samples, flattened grid, component functions, magnitudes, directions,
display components, colour list) plus **visible restricted parametric curves**
for arrow shafts and arrowhead wings. Twenty items per field.

Every ID begins `vector_tools_vf_<field-id>_`, so update, audit and removal are
stable without depending on expression-list positions.

Costs three restricted parametrics per arrow. **Warns above 2,500 vectors,
refuses above 10,000.**

Two sources: `components` embeds P(x,y) and Q(x,y) directly; `gradient` embeds
a scalar f and defines the components as Desmos's own partial derivatives of
it, so the arrows are exactly ∇f.

The arrowhead here is **two line segments**, not a filled triangle, because a
filled one would be a polygon per arrow.

### 3.2 Live arrows — this extension's own canvas

`flow/ArrowRenderer.ts`. One instance per grid point. The field is evaluated in
the **vertex shader**. The geometry — nine vertices, two triangles of shaft and
one of head — exists only in that shader, addressed by `gl_VertexID` and
`gl_InstanceID`, **with no vertex buffer at all**. One draw call for the whole
field.

No expressions written. No practical cap. **Solid tapered arrowheads, which
Desmos expressions cannot draw** — this is the thing live rendering buys beyond
speed.

`arrowMode` is **Live / Desmos expressions / Off**, defaulting to Live, because
a tool for looking at a field should show one immediately; Generate is what
commits it.

### 3.3 Flow visualiser — GPU particle advection

`flow/FlowRenderer.ts`, adapted from Andrei Kashcha's **fieldplay** (MIT —
`flow/LICENSE-fieldplay.md`). Ping-ponged particle position textures, RK4
integration in a fragment shader, trails that fade.

Four passes per frame: integrate, fade the trail, draw particles into it, blit
to the canvas. **Three of those cover the whole canvas**, so their cost is the
drawing buffer's area — four times the CSS box on a high-density display, which
is why `renderScale` exists.

A **Look** setting picks Streamlines (long-lived particles, long trails, which
genuinely draw the streamlines) or Texture (short trails, constant respawn,
which cover the viewport evenly and read as a texture with direction in it).
Both looks only preset `trailPersistence` and `dropRate`; every value stays
adjustable afterwards.

Particle count 500 – 400,000; above ~120,000 a mid-range GPU starts dropping
frames on a large viewport. Capacity is separated from count, because the count
slider fires per pointermove and count-owns-allocation meant deleting and
rebuilding two float textures once a frame for the length of a drag.

**Registers only with the 2D graph paper.** `flowAvailability` refuses the 3D
product before the field is even compiled, because on 3D
`graphpaperBounds.mathCoordinates` is a rotatable box with no screen-space
meaning. `/geometry` is the same 2D graph paper and works unchanged.

---

## 4. Shared libraries

### 4.1 `palettes.ts`

Ramps are defined **once, as stops**, and emitted **three times**: as a Desmos
`rgb`/`hsv` list expression for generated arrows, as shader uniforms for the
GPU, and as a CSS `linear-gradient` for the picker's swatches. A swatch written
out separately is a swatch that eventually disagrees with the field, which is
worse than no swatch.

Eighteen palettes in four groups. **Sequential**: Spectral (default), Viridis,
Blue, Turbo, Plasma, Magma, Cividis, Jet (classic), Grayscale. **Diverging**:
Blue-to-red, Cool-to-warm. **Cyclic**: Hue wheel, Twilight, Phase.
**Expressive**: Sunset, Ocean, Ember, Neon.

Jet is perceptually poor and invents edges where the field is smooth. It is
there because decades of fluid-dynamics figures used it and a plot meant to sit
beside one should be able to match it — an option, not a recommendation.

`cyclic` is a claim about the ramp's two ends being the same colour, held to the
colours by a test. It matters for `direction`, which colours an angle: 359° and
1° are neighbours, and a ramp whose ends do not meet draws a hard edge across
the field along whichever ray happens to be zero — a feature of the picture that
is not a feature of the field. The hue wheel has no stops at all and is emitted
from a formula; the swatch samples that same formula.

Turbo needs eight stops, which is what sets `MAX_PALETTE_STOPS`.

### 4.2 `flow/latexToGLSL.ts`

Compiles the subset of Desmos LaTeX a field component can realistically use
into a GLSL ES 3.00 expression over `vec2 p`. Anything outside the subset is
**reported by name**, so the panel can say exactly which piece it could not
translate rather than silently drawing a different field.

Supported: `+ - * / ^`, `\frac`, `\sqrt` (including `\sqrt[n]`), `|…|`,
parentheses/braces/brackets, implicit multiplication, `\cdot`/`\times`, and the
functions `sin cos tan cot sec csc arcsin arccos arctan arccot arcsec arccsc
sinh cosh tanh coth sech csch arcsinh arccosh arctanh exp ln log sqrt abs sign
floor ceil round mod min max`. Variables `x`, `y` and `e`, **plus anything the
expression list defines** — see 4.3.

Piecewise functions and restrictions compile too: `\{c₁: v₁, c₂: v₂, v\}` is a
chain of ternaries in Desmos's order, a condition may be a chain (`-1 ≤ x ≤ 1`),
a branch with no value is 1, and no branch holding is undefined — a NaN the
field reads as no arrow, which is what Desmos draws there.

**Explicitly refused**: lists, sums, integrals, actions, and any name the
expression list does not define.

### 4.3 `environment.ts` — reaching the rest of the graph

A component may reference what the graph defines: a named value (`a`, `k_{1}`,
a slider) and a function of numbers (`f(u)`, `g(u,v)`). `scanDefinitions` reads
the expression list for those two shapes and hands the compiler an environment.

The two kinds are treated differently on purpose, and the distinction is the
whole design:

- **A value becomes a uniform, never a literal.** Baking the number in would
  mean recompiling and relinking both programs on every frame of a slider drag —
  exactly the cost `c0dd0cce` removed. `FlowField` deliberately carries the
  parameter _names_ and not their values, and `setField` compares whole fields,
  so a slider drag cannot relink a program even by accident.
- **A definition becomes a real GLSL function**, not an inlining at the call
  site: a body using its argument twice would otherwise duplicate the whole
  argument expression at each use, and chains multiply. Every helper takes `p`
  whether it reads a coordinate or not, so a definition may mention x and y
  without the caller knowing. Helpers come back dependencies-first.

Values are read through Desmos's own `HelperExpression`, so `a = b + 1` works
without any of this understanding `b`, and an animating slider reports without
touching the expression list.

**Recursion is refused**, directly and mutually, because a shader has no call
stack — missing it is a hang or a driver crash, not a wrong picture. So is
nesting deeper than twelve, and a call with the wrong number of arguments.
A definition the compiler cannot follow is **named**, so the message says which
definition in the graph is the problem.

Two facts found the hard way: `setExpression` does **not** emit
`set-item-latex` — it emits `add-item-to-end-from-api` and `on-evaluator-changes`,
and the latter is what a definition typed anywhere in the list arrives as. That
event also fires on every frame of an animating slider, so the scan reads
`cc.getAllItemModels()` rather than `getState()`, and coalesces rather than
debounces (a debounce under a steady stream never comes due).

The generated field's own namespace is skipped: its helpers are built from the
component, so a component referencing one would be circular.

Guards live in a GLSL prelude: `vtDiv` (epsilon-protected division), `vtPow`
(real powers of negative bases only for integral exponents), `vtCot`/`vtSec`/
`vtCsc`, `vtLog10`, `vtMod`. NaN and Inf from the field are collapsed to zero
in `vtField`.

A **gradient** field arrives at the GPU as its scalar function and is
central-differenced, because the GPU cannot differentiate symbolically. The
step follows the viewport so the gradient stays smooth at any zoom, and it is
exact for the quadratics most potentials are built from. (The generated Desmos
expressions differentiate exactly instead. The two therefore agree numerically
but not identically.)

### 4.4 `symbolic.ts` — **has no caller yet**

Exact symbolic partial differentiation over Desmos's own syntax tree, via
`text-mode-core`'s Aug layer. No CAS: Desmos's parser already produces the
tree, differentiation of a tree is mechanical, and the same layer emits LaTeX
back out.

It is exact for everything it accepts and **refuses everything else rather than
guessing** — an almost-right derivative is worse than none.

- `differentiate(node, variable)` — partial derivative, simplified. Every other
  identifier is held constant, which is what makes it partial.
- `implicitDerivative(...)` — the implicit function theorem, `dy/dx = -F_x/F_y`.
- `identifiersIn`, `dependsOn`, `simplify`, `toLatex`.
- Known function derivatives: `sin cos tan cot sec csc exp ln log sqrt arcsin
arccos arctan sinh cosh tanh abs`.
- `u^v` splits into power rule / exponential rule / general form.
- Refuses: multi-argument function calls, unknown functions, anything that is
  not a constant, identifier, negation, binary operator, or single-argument
  call.

`index.ts` already exposes `partialDerivative(latex, variable)` and
`gradient(latex, variables?)` on top of it. **Nothing in the UI calls either.**
Giving this module a job is one of the more valuable things available.

---

## 5. Constraints — what the platform actually allows

Every one of these was established the hard way. Treat them as facts, not as
starting assumptions to re-test.

### 5.1 Desmos

- **`Desmos.Private.Parser` exposes only `parse`, `parseIdentifier`,
  `setInput`.** No symbol table, no operator registry. **You cannot teach Desmos
  an operator.** Any proposal that requires new notation inside a Desmos
  expression is dead on arrival.
- `\partial` and `\nabla` **render as nothing**. The literal `∂` and `∇`
  characters render but do not parse.
- **`\frac{d}{dx}` applied to a two-argument function is the partial derivative
  with respect to x, holding y.** `\frac{\partial}{\partial x}` and
  `\partial_{x}` both error. Verified against a real Desmos for first partials,
  divergence, curl, and nested second partials.
- **`setExpression` silently drops `folderId` and `colorLatex`,** and the
  `set-item-colorLatex` action is ignored by current builds. A field written
  through them lands outside its folder and renders in one flat colour.
  Everything therefore goes through `Calc.getState()` / `Calc.setState()`,
  which also makes generation atomic, undoable in one step, and keeps a
  regenerated field at its existing list position.
- **Dispatching from inside a dispatcher callback throws** "Cannot dispatch in
  the middle of a dispatch".
- Desmos reports `graphpaperBounds` on **every pointermove** during a drag.
- **`setExpression` does not emit `set-item-latex`.** It emits
  `add-item-to-end-from-api`, `tick`, `evaluator-progress-update` and
  `on-evaluator-changes`. Listening only for `set-item-latex` catches edits made
  in the UI and misses every programmatic one — which is how a graph acquires a
  slider without anyone touching this plugin. `on-evaluator-changes` is the one
  to watch, and it **also fires on every frame of an animating slider**, so
  anything hung off it must be cheap and must coalesce rather than debounce.
- **`Calc.observeEvent("change", …)` heavily throttles**, so it is the wrong
  instrument for anything that should feel immediate.
- **`cc.getAllItemModels()` gives id/type/latex without serialising the graph**,
  which `getState()` does. On a hot path, that difference is most of the cost.
- **Defining a global `t` stops the generated arrows being parametrics.** The
  shafts and wings are restricted parametrics in `t` (`{0 ≤ t ≤ 1}`). Defining
  `t` does not error and does not shadow anything: Desmos evaluates those
  expressions at the global value and draws **one point per arrow instead of a
  segment**. `isGraphable` stays `true`, and the only assertable trace is
  `expressionAnalysis[id].evaluationDisplayed` turning `true` — everything else
  about it is visual. Established by drawing the same field twice, once with `t`
  and once renamed: dots against arrows. So a time variable spelled `t` has to
  be renamed on the way into the graph, which is what `timeSymbolFor` and
  `renameIdentifier` are for. (Live rendering is unaffected — there `t` is a
  uniform, not an expression.)
- **`\operatorname{dt}` works inside a ticker handler**, and is milliseconds
  since the previous tick. Worth knowing because the tick rate is not what the
  minimum step suggests: with `minStepLatex: "16"` the harness ticked about 27
  times a second, not 62. A fixed step per tick therefore animates at an
  unpredictable rate; `speed · dt/1000` does not.
- **A ticker is graph-level**, one per graph, and lives in
  `state.expressions.ticker` rather than the expression list. It round-trips
  through `getState`/`setState`. Being outside the list means it cannot be
  namespaced, so it is the one part of a generated field whose ownership has to
  be recognised — by its handler mentioning the field's own clock symbol.
- Values are best read through **`Calc.HelperExpression({ latex })`**, which is
  Desmos's own evaluator: `numericValue` plus `observe("numericValue", …)`. It
  has no documented teardown, so keep them rather than rebuilding them.

### 5.2 DCGView (the UI framework)

- **Only props passed as _functions_ are re-read.** A bare value is wrapped in
  `DCGView.const` and frozen at first render. Every control takes getters.
- **Props are written as _attributes_**, and `disabled="false"` is still a
  disabled input in HTML. `disabled` is never passed as a prop; the property is
  assigned in `onUpdate`. Passing it as a prop once disabled every number field
  in the panel.
- Inputs are only re-synced while they do **not** hold focus, so a render
  triggered mid-edit cannot fight the user's typing.
- The panel has **no `<select>` elements**: a native dropdown inside a scrolling
  popover is awkward to hit and DCGView cannot drive its selection through props
  anyway. Option lists are wrapping rows of one-click chips.
- Element IDs are namespaced per axis, because duplicate IDs point `<label for>`
  at the wrong input.

### 5.3 WebGL

- WebGL2 required. The flow additionally requires `EXT_color_buffer_float`.
- The plugin holds **two contexts** on top of Desmos's own. Browsers cap
  contexts per page. Both overlays now handle `webglcontextlost` /
  `webglcontextrestored`.
- The arrows' canvas and the flow's canvas are deliberately separate: the flow
  advects sixty times a second and fades its previous frame; the arrows are a
  still picture. Sharing a renderer would mean the arrows paying an animation
  loop's costs to sit still.
- Both canvases are `pointer-events: none`, inserted next to
  `canvas.dcg-graph-inner`, write no expressions and touch no calculator state.

### 5.4 Known unrelated breakage

DesModder's find-and-replace patches against Desmos's **minified** source break
when Desmos ships a new build. `override-keystroke` was fixed with a `____$`
wildcard; `quake-pro` and `syntax-highlighting` may still be broken. This shows
as a panic popover on load and is **not** caused by Vector Tools, which has no
replacements of its own. Verified by reproducing it on a commit predating the
plugin.

### 5.5 Desmos 3D (verified 2026-10-02)

Full write-up, with measurements and evidence: `DESMOS_3D_CAMERA.md`. In short:

- **The camera a frame was drawn with is on the main thread.**
  `grapher3d.redrawResult.camera` holds three column-major three.js matrices
  (`worldMatrixWorld`, `cameraMatrixWorldInverse`, `cameraProjectionMatrix`).
  `src/field-rendering/camera3d.ts` turns them into one math-to-clip matrix.
  That lands within 0.1–0.7 px RMS of the points Desmos draws, across
  rotations, orthographic and perspective views, non-cubic boxes, and 2× DPR.
- **Follow the redraw, not the rotation.** `onRedraw3dResults` fires once per
  redraw with the new camera in its argument. `controls.worldRotation3D` runs
  2–3 frames ahead of the picture.
- **`setState` reads 3D bounds from `__v12ViewportLatexStash`** and ignores the
  numeric `viewport`. It also ignores `worldRotation3D`; set orientation as the
  video creator does.
- **No shared depth.** Desmos draws on its own WebGL context, so an overlay can
  depth-test only its own geometry.
- **Desmos clips everything to the box,** and the z = 0 plane is translucent.

---

## 6. Decisions that look like bugs and are not

**Do not "fix" any of these.** Each cost real time to establish.

1. **Colour uses a saturating ramp, `1 - exp(-m/scale)`, not a measured
   min/max.** Fields with poles — anything with a denominator passing through
   zero, which is most of a multivariable course — reach magnitudes near the
   pole larger than the rest of the field combined.
   `sin(x²+y²)/(1-|x³y³|+cos(x²+y²))` reaches two hundred thousand within a few
   units of the origin while the rest of it sits below ten. A ramp stretched to
   one of those leaves everything else inside its first hundredth: one flat
   colour. A saturating ramp gives ordinary magnitudes most of its length and
   lets the poles run into its end. `scale` follows the viewport.
   There used to be a whole `FieldRange` module measuring the range on the GPU;
   it was **deleted at `1383a4ff` for exactly this reason**. Do not bring it
   back without solving the pole problem first.
   `color.rangeMode` can still be set to `manual`, which spreads the ramp
   linearly between two given values.
2. **The generated Desmos expressions _do_ use Desmos's `min`/`max`,** because
   a static graph has no viewport for a scale to follow. A field drawn live and
   the same field generated will not colour identically. Understood, not a bug.
3. **Arrow thickness is in pixels but capped against the arrow's own length,**
   and the displayed length is capped against the viewport (0.12 of its width).
   Without both, zooming out makes each arrow wider than it is long and the
   field smears into a wash.
4. **The direction is taken before the length is capped.** Normalising by the
   capped length scales it back up by exactly what the cap removed — a fix that
   silently does nothing.
5. **A grid too dense to read is thinned by default** (`arrowDensityLimit`),
   down to 10,000. Matching the sampling domain to a zoomed-out viewport asks
   for hundreds of thousands of arrows by accident, and what you get is the
   moiré between the arrow grid and the pixel grid rather than the field. **It
   is a checkbox, not a rule** — turning it off draws every one of them, and
   that is deliberate. Both axes scale by one factor so arrows stay square to
   the grid.
6. **Trails are reprojected on pan, not cleared.** Desmos reports bounds on
   every pointermove; clearing made the flow blink out for the whole gesture.
   `setBounds` redraws the old trail into its new place, one screen pass, with
   whatever pans in from off-screen left transparent. Only an explicit
   `resetBounds`, on starting, clears.
7. **`renderScale`** exists because three of four passes per frame cover the
   whole canvas.
8. **Only the slots the user types into are mirrored back** from the expression
   list (`editableSlots`). In gradient mode that is f alone: P and Q are
   derived, and adopting a hand-edit to one of them would overwrite the
   derivative the generator owns.
9. **Panel size is persisted from the _inline_ width and height,** because a
   corner drag writes those while a short window merely clamps the rendered box
   through `max-height` — persisting the clamp would shrink the panel
   permanently.

---

## 7. What changed most recently

### 7.1 Reaching the rest of the graph, and the panel around it

Five commits, verified in a real Desmos through the integration harness:

1. **`0ba399ef` — Give the equation boxes the width the column already had.**
   Desmos's inline math input is an inline-block, so it shrink-to-fits, and the
   MathQuill field inside caps its own max-width against whatever the container
   reports. A container with nothing to report settled it at **74px inside a
   338px cell**, clipping the expression rather than wrapping it — unreadable at
   exactly the point an expression grew long enough to need reading. Now 396px
   and not overflowing. P and Q stack instead of sharing a fixed two-column grid
   whenever the panel is too narrow for both.
2. **`1daa3ce1` — Show the ramp instead of naming it.** Eighteen palettes in
   four groups, each drawn from the same stops it selects. See 4.1.
3. **`b82e4d81` — Let a field component reach the rest of the graph.** The
   compiler takes an environment: values become uniforms, definitions become
   GLSL functions. See 4.3.
4. **`b150eef7` — Find what the graph defines, without asking what it equals.**
   `environment.ts`. Collects names, never values, which is what makes a moving
   slider incapable of invalidating the scan.
5. **`dccb93bc` — Let the field actually read the graph.** The wiring, and the
   two facts it turned up: `setExpression` emits `on-evaluator-changes` rather
   than `set-item-latex`, and that event also fires per frame of an animating
   slider, so the scan reads item models rather than `getState()`.

Also **`e7e8a02e`** — both things that draw colours now share the Colour tab,
each under the name of what it colours, with a **Match arrows** button that
appears only while pressing it would change something. They stay separately
settable: one scheme for both is the common case, not the only legitimate one.
`flowColorModeFor` in `model.ts` owns the correspondence, because an arrow can
be coloured by an x component while a particle's only scalar is its speed.

### 7.2 The performance work before that

Three commits, measured against a 201×201 sampling domain (40,401 arrows)
viewed from twelve units across, over a hundred simulated slider frames:

|                                             |    before |      after |
| ------------------------------------------- | --------: | ---------: |
| shader links during a 100-frame slider drag |       100 |      **0** |
| instances submitted over those frames       | 4,040,100 | **16,500** |

(The wall-clock time was identical, ~1.65 s, because the loop is
`requestAnimationFrame`-paced and neither build dropped below 60 fps in that
configuration. The submitted-work counts are the real signal; the elapsed time
measures nothing here. Stated plainly so nobody quotes a speedup that was not
observed.)

1. **`c0dd0cce` — Stop asking the GPU for work the frame does not need.**
   `ArrowRenderer.setField` now compares the field against the one its linked
   program was built from, the way `FlowRenderer` always has; every settings
   change arrives as `start(field, options)` with the same field, so a drag was
   relinking a shader per pointermove. And `visibleGridSpan` instances only the
   columns and rows of the grid that intersect the view, plus a margin wider
   than the longest arrow the shader will draw. Non-finite bounds fall back to
   the whole grid: drawing too much is a performance answer, drawing too little
   is a wrong picture.
2. **`c5898a92` — Come back when the browser takes the graphics context away.**
   Both overlays handle `webglcontextlost` (with `preventDefault`, without
   which the browser never restores it) and rebuild on `webglcontextrestored`
   from the field and options they keep for that purpose. `isRunning` is now
   the canvas rather than the renderer, so a mounted overlay with a lost
   context reads as running-and-briefly-blank instead of stopped.
3. **`09ece825` — Show only the controls the current settings actually read.**
   `lengthInputsFor` in `model.ts` is now the single answer to which of the four
   length numbers a mode reads (`actual` none, `normalized` one, `clamped` two),
   and the panel shows only those. The fixed-colour swatch appears only when the
   arrows or the flow is set to use it — one swatch, two users. The flow's
   secondary controls (trail length, respawn rate, opacity, particle size,
   render detail) fold into a **Fine tuning** disclosure, leaving on screen the
   controls that decide what the flow _is_.

---

## 8. The agreed roadmap

Items 1–3 and 6 are done (palettes, live arrow rendering, the Streamlines/Texture
flow preset, and time-varying fields). The rest, in the order agreed:

### 4. Nullclines and equilibria

Draw `P(x,y)=0` and `Q(x,y)=0` as implicit curves; their intersections are the
critical points. Two generated expressions, large payoff for a differential
equations course. Desmos draws implicit curves natively, so the generated half
is nearly free. A live GPU version would be a fragment pass colouring pixels
where the field's sign changes, distance-normalised so the line has even width.

### 5. Divergence and curl — **the exact half is in the Field tab**

The Field tab shows `∇·F` and `∇×F` (the scalar curl, ∂Q/∂x − ∂P/∂y) as
formulas, differentiated by the shared differentiator from Desmos's own parse,
and says whether the field is conservative: by construction for a gradient,
exactly when the curl folds to 0, "probably" when it only vanishes at the 49
points of a grid over the sampling domain, and plainly not otherwise. That is
also the conservative-field check listed below. The GPU overlay is still to do.

Desmos's parser reads `x(y-1)` as a call of a function named x and leaves its
evaluator to decide. The analysis decides the same way, from the environment
(§4.3): a one-argument call of x, y, t, e, π, τ or a value the graph defines is
a product; a call of a defined function, or of a name nothing defines, stays a
call and is refused rather than guessed at. `x(y-1)^2` is x·(y-1)² and
`(x(y-1))^2` is (x·(y-1))², as Desmos evaluates them — the aug tree keeps that
bracket as `parenWrapped` for exactly this. The shared rewrite is
`implicitProducts` in `src/symbolic/products.ts`; Physics Lab's integral and
limit use it with the one variable.

Two halves:

- **As a coloured overlay from the GPU** — a full-screen fragment pass with
  central differences, the same pattern `field.ts` already uses for gradients.
  Note that divergence and curl are **signed**, so the saturating ramp needs a
  signed variant (`sign(d) · (1 - exp(-|d|/scale))`) mapped onto a diverging
  palette centred at zero. "Blue to red" exists but is not currently
  zero-centred.
- **As exact generated expressions** via `symbolic.ts` — its first caller.
  `∂P/∂x + ∂Q/∂y` and `∂Q/∂x - ∂P/∂y`, spelled with `\frac{d}{dx}` on
  two-argument functions per §5.1.

### 6. Time-dependent fields — **done** (`d32754ab`, `0a288bb5`)

`P(x,y,t)`, animated, in both halves. Nothing else in the Desmos ecosystem does
this.

Live, `t` resolves to a `u_time` uniform, the way a named value resolves to
`u_vp_<name>` (4.3) and for the same reason. One clock drives both overlays, so
the arrows and the particles over them always show the same instant. Nothing
animates unless the field asks to: a component with no `t` costs exactly what it
did before, no loop and no uploads. The controls are play, speed and reset, and
deliberately **not** a scrubber — `t` is unbounded, so there is no range for one
to span.

Generated, the component is rewritten onto the field's own clock symbol and a
ticker advances it, because a global `t` would turn the arrows into dots (5.1).
The rewrite is undone on the way back, so the panel shows what the user wrote.
The handler uses `speed · dt/1000`, so the generated animation runs at the same
rate as the live one. Remove takes the ticker only when it is the field's own,
and a ticker doing something else is refused rather than taken over.

`t` is **not reserved**: a graph that defines `t` as a slider keeps that meaning,
in both halves, and the field simply stops being time-varying. An explicit
definition beats an implicit one.

### 7. Click-to-seed streamlines, and LIC

Click the graph to release particles from a point. **Line Integral Convolution**
as a dense static alternative to particles — a field texture with the field's
structure everywhere at once, no animation, no trails.

### Open design question: custom graph transformations

Drawing the field through a user-supplied map `X(x,y)`, `Y(x,y)`. Achievable on
our own canvas since arbitrary LaTeX already compiles to GLSL — but **incoherent
while Desmos's own grid underneath stays Cartesian**. Two candidate resolutions:

- Apply the transform at **generation** time with the Jacobian, which stays
  ordinary Desmos and would give `symbolic.ts` a job.
- Draw the **image of the Cartesian grid under the map as an overlay**, on top
  of the undeformed grid rather than replacing it. That is the picture that
  makes a transformation legible, and it uses the same instanced-line machinery
  the arrows already use. This is a proposal, not a decision.

### Further ideas already on the table (not yet agreed)

- **Equilibria classification.** Once nullclines give the critical points, the
  Jacobian at each is four calls to `symbolic.ts`; its eigenvalues classify the
  point (saddle / node / spiral / centre) and give eigenvector directions to
  draw. The single biggest linear-algebra payoff available, and it falls out of
  items 4 + 5 almost for free.
- **Conservative-field check.** `∂P/∂y - ∂Q/∂x` simplified to zero says a
  potential exists. One line of panel text; `symbolic.ts` does the work.
- **Cursor probe.** P, Q, |V|, angle, divergence and curl at the pointer,
  evaluated through a hidden `HelperExpression` so it is Desmos's own evaluator
  and not a second one.
- **Matrix field / linear transformation mode.** V = Ax for a 2×2 matrix, with
  eigenvalues, eigenvectors, and the image of the unit circle.

---

## 9. Where we would most like outside research

These are genuinely open. Answers that come with a demonstrated mechanism, not
just a name, are worth far more.

1. **A magnitude→colour mapping that survives poles and is still readable for
   fields without them.** The saturating ramp is a good answer, not obviously
   the best one. Percentile-based ramps, robust statistics (median/MAD), and
   log-modulus transforms are all candidates — but any of them that requires
   _measuring_ the field must explain what happens when 0.1% of samples carry
   99% of the range, and must work identically in a Desmos expression with no
   viewport (see §6.1 and §6.2).
2. **LIC on a WebGL2 fragment shader at interactive rates**, over a field
   evaluated per-sample rather than sampled from a texture, and how it should
   composite over Desmos's graph paper without hiding it.
3. **Drawing implicit curves (`P=0`) live on the GPU** with even apparent line
   width at any zoom, without marching squares on the CPU.
4. **Finding all equilibria of a 2D field robustly** in a viewport, on a budget
   that survives a pan. Grid + Newton is the obvious answer; degenerate and
   non-isolated cases are the interesting part.
5. **A menu structure for a tool that is about to grow** an Analysis surface
   (nullclines, div/curl, conservative check, probe) on top of four existing
   tabs, in a ~360 px popover, with no `<select>` available.
6. **Whether anything in the Desmos public API has changed** that would relax
   §5.1 — particularly around colours, folders, and tickers.
7. **Prior art worth stealing from**: fieldplay (already the flow's basis),
   VisIt/ParaView vector-field conventions, Mathematica's `StreamPlot` /
   `VectorPlot` heuristics for arrow density and scaling, and how any of them
   choose a length scale automatically.

---

## 10. Rules a proposal has to satisfy

A proposal is useful here only if it clears all of these:

1. **It runs in a browser extension, in a real desmos.com page**, alongside
   Desmos's own renderer, with no server and no external service.
2. **It does not require teaching Desmos new notation** (§5.1).
3. **It states which half it belongs to** — generated Desmos expressions
   (shareable, capped, static) or our own canvas (live, uncapped, needs the
   extension) — or explains why it needs both.
4. **If it colours anything by magnitude, it says what happens near a pole.**
   Test it against `sin(x²+y²)/(1-|x³y³|+cos(x²+y²))`.
5. **If it has a trade-off, it goes behind a labelled control with a sensible
   default** — not a limit imposed on the user. Two limits have already been
   imposed where an option belonged (an arrow cap, a colour range) and both had
   to be undone. **Do not make product decisions on the maintainer's behalf.**
6. **It can be verified in a picture.** If the only evidence it works is an
   assertion, it has not been shown to work.
7. **It does not undo anything in §6** without first solving the problem that
   decision exists to solve.

### House style, if you are writing code

Commit messages explain **why**, in prose — not a bulleted changelog. Comments
do the same: dense, deliberate, explaining the reason a thing is the way it is,
especially where the obvious approach was tried and failed. Match it.

---

## 11. Known defects, verified and open

An outside review of `origin/main` (2026-09-08) raised twenty-two points. `main`
was several commits behind this branch, so a number of them were already fixed
here; the rest were checked against the branch tip one at a time. This section
records only what was **confirmed against the code**, so the list is a work
queue rather than a set of suggestions.

Fixed in response: expressions sharing the field's namespace were being deleted
by generation and by Remove — `cad6b0c9`.

### Confirmed open

1. **Flow animation is frame-rate dependent.** There is no `dt` anywhere in
   `FlowRenderer`: the RK4 step, `u_dropRate` and `u_fade` are all applied once
   per frame with per-frame constants. A 144 Hz display therefore advects the
   field about 2.4× faster than a 60 Hz one, with correspondingly shorter trails
   and shorter particle lifetimes. The fix is to pass the `requestAnimationFrame`
   timestamp into `frame()`, scale the step by elapsed time, and convert the two
   probabilities to a rate — `p_dt = 1 - (1 - p_60)^(60 dt)` — clamping elapsed
   time so a backgrounded tab does not teleport every particle on resume.
   Note this **changes how existing saved graphs animate**, which makes it a
   decision and not just a fix.
2. **Live arrows ignore `zeroVectorMode`.** It is not in `ArrowOptions` and
   never reaches the shader, which always sends zero vectors outside the clip
   volume. So "show zero vectors as points" works for generated expressions and
   silently does nothing for the default renderer.
3. **Palette uniforms are rebuilt and uploaded every frame.** `paletteUniforms`
   allocates two `Float32Array`s and is called from inside both renderers' frame
   paths. It should be cached against the palette ID and uploaded on change.
4. **The whole configuration is serialised on every `input` event.** Dragging a
   slider stringifies and re-parses the config per pointermove, and drives a
   panel render and an arrow refresh with it. A transient value while dragging,
   persisted on change or after a debounce, would remove that.

### Raised, and deliberate rather than broken

- **The GPU guards change the mathematics near singularities** (§4.2): division
  by zero becomes division by ε, `sqrt` of a negative is zero, NaN and Inf
  become zero components. This is real and it is on purpose — but the review's
  underlying point stands and is worth a decision: the overlay currently draws a
  _stationary finite arrow_ where Desmos considers the field undefined, rather
  than drawing nothing. A validity flag that hides invalid arrows and respawns
  particles that land on them would be more honest than ε, and would not cost
  the guards.
- **The gradient step follows the viewport** (§4.2). Deliberate. The review's
  refinement is fair though: one step for both axes lets a wide aspect ratio
  degrade the smaller one, and separate `h_x`/`h_y` would be strictly better.
- **Two WebGL contexts** (§5.3). Deliberate, and the review agrees it is lower
  priority than anything above.

### Already fixed before the review ran

Shader relinking on settings-only changes (`c0dd0cce`), WebGL context loss and
restoration (`c5898a92`), and referencing expression-list constants and
functions (`b82e4d81`, `b150eef7`, `dccb93bc`). A review that names any of these
is looking at `main`, not at this branch.
