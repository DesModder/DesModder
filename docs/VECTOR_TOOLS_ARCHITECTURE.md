# Vector Tools architecture

## Where the renderer lives

Everything that draws — ArrowRenderer, FlowRenderer, both overlays,
latexToGLSL, field.ts, palettes, environment, identifiers — now lives in
**src/field-rendering/**, shared with Physics Lab and owned by neither plugin.
Paths below that read `flow/…` or a bare `palettes.ts` refer to files there;
nothing about their behaviour changed in the move. See
VECTOR_TOOLS_BRIEFING.md §2.1.

## Scope

Vector Tools is a disabled-by-default DesModder plugin for editable vector and
calculus visualizations. It has two independent halves:

- The **generator** turns a field configuration into an ordinary Desmos folder
  of ordinary expressions. It adds no canvas, renderer, external service, or
  custom expression evaluator.
- The **flow visualizer** animates the same field as GPU particles on a
  transparent canvas layered over the graph paper. It writes no expressions and
  is off unless the user presses **Visualize**.

The panel is opened from the existing DesModder pillbox. Enabling the plugin
only adds that entry point. It never generates a graph automatically, and
disabling it only removes the entry point and stops the visualizer—it
deliberately leaves generated Desmos content intact and useful.

## Configuration and persistence

`VectorFieldConfig` in `src/plugins/vector-tools/model.ts` is the only
persisted configuration format. It is plain JSON, has a `schemaVersion`, and
is stored in the current DesModder plugin-settings mechanism under the hidden
`serializedFieldConfig` setting. On load, the configuration is normalized to
the current schema; it is not used to regenerate a graph.

Validation occurs before generation. It checks scalar component fields, finite
domain and rendering parameters, sampling limits, fixed-color syntax, and a
manual color range. More than 2,500 vectors requires an explicit confirmation;
more than 10,000 is rejected. The sampling estimate is always based on the
effective step or count, rather than a UI-only value.

## Generator

`generator.ts` maps one configuration to a deterministic `VectorFieldPlan`.
Every ID begins with `vector_tools_vf_<field-id>_`, which enables stable update,
audit, and removal without relying on expression-list positions. The plan
contains a single generated folder, hidden helpers for the samples, flattened
grid, component functions, magnitudes, directions, display components, and
color list, plus visible restricted parametric curves for shafts and arrowhead
wings.

A field's components come from one of two sources, chosen by `config.source`.
`components` embeds the configured P(x, y) and Q(x, y) directly. `gradient`
embeds a scalar f(x, y) as one more expression in the folder and defines the
components as Desmos's own partial derivatives of it, so the arrows are ∇f and
stay exact rather than approximated.

That relies on a Desmos behaviour worth stating plainly, because the obvious
spellings do not work: `\frac{d}{dx}` applied to a **two-argument** function is
the partial with respect to x, holding y. `\frac{\partial}{\partial x}` and
`\partial_{x}` both error. This was verified against a real Desmos, exactly, for
first partials, divergence, curl, and nested second partials.

Only the slots the user types into are mirrored back from the expression list
(`editableSlots`). In gradient mode that is f alone: P and Q are derived, and
adopting a hand-edit to one of them would overwrite the derivative the generator
owns with something that no longer follows f.

The grid is a Desmos Cartesian list comprehension. The configurable P(x, y)
and Q(x, y) fields are embedded only in namespaced helper functions. Arrow
length modes are calculated in expressions, including an epsilon-protected
normalization path so zero magnitudes cannot cause division by zero. Zero
vectors can be hidden or shown as point markers. Color values are standard
Desmos `rgb`/`hsv` list expressions and are applied to rendered expressions
through the existing item-color action.

## Adapter, ownership, and audit

`desmos/ExpressionAdapter.ts` is the sole calculator boundary, and every write
goes through `Calc.getState()`/`Calc.setState()`.

That choice is forced by Desmos rather than preferred: `setExpression` silently
drops both `folderId` and `colorLatex`, and the `set-item-colorLatex` action is
not handled by current Desmos builds. A field written through them lands outside
its folder and renders in one flat color no matter which color mode is selected.
Writing the whole set in one `setState` also makes generation atomic and
undoable in a single step, and keeps a regenerated field at its existing
position in the expression list instead of moving it to the end.

`applyGeneratedSet` validates every ID, color, and namespace membership before
it reads state, so a malformed plan cannot half-apply. It refuses to overwrite
an item inside the namespace whose type it does not expect, and it rebuilds
`expressions.list` by preserving every other item in order.

`removeGeneratedSet` accepts only a validated namespace and matches that exact
namespace or an underscore-delimited child ID. It cannot remove an unrelated
expression with a similar prefix. The generator also exposes an audit that
compares expected and present folder/expressions, reports missing render rows,
unexpected items, duplicate IDs, dropped `colorLatex`, and namespace collisions.
Audit reports are observational: they never claim mathematical correctness from
a guessed evaluation result.

## Panel

`components/VectorToolsPanel.tsx` is a DCGView component. Three DCGView
behaviours shape how its controls are written, and each of them silently broke a
control before it was accounted for:

- DCGView only re-reads a prop that was passed as a **function**; a bare value is
  wrapped in `DCGView.const` and frozen at first render. Every control therefore
  takes getters, and anything whose DOM state cannot be expressed as an
  attribute is pushed back into the element from `onUpdate` on each render pass.
- DCGView writes props as **attributes**, and `disabled="false"` is still a
  disabled input in HTML. `disabled` is therefore never passed as a prop; the
  property is assigned in `onUpdate` instead. Passing it as a prop disabled every
  number field in the panel.
- Inputs are only re-synced while they do **not** hold focus, so a render
  triggered mid-edit cannot fight the user's typing.

A control that the current mode does not read is not shown. The four length
numbers are the case that matters: `actual` reads none of them, `normalized`
reads one, `clamped` reads two, and all four on screen at once offer three
controls that take input and change nothing, with no clue which is live.
`lengthInputsFor` in `model.ts` is the single answer to which is which, because
the same five cases are the shader's `vtLengthFactor` and the generator's
`factor`, and a wrong answer here hides a control the field depends on. The
same rule hides the palette when the colour mode does not run along one, and
the fixed-colour swatch when neither the arrows nor the flow is set to use it —
that one swatch has two users, so it stays while either still needs it.

The flow's secondary controls are folded into a `<details>` instead. Trail
length and respawn rate are what the Look preset sets, and opacity, particle
size and render detail are refinements of a picture that already exists; on
screen with the controls that decide what the flow _is_, eleven of them in one
column, none of them read as more important than another.

The panel has no `<select>` elements. A native dropdown inside a scrolling
popover is awkward to hit and DCGView cannot drive its selection through props
anyway, so option lists are wrapping rows of one-click chips instead, and the
tab bar is DesModder's existing `SegmentedControl`.

Layout is a fixed title and tab bar, a scrolling body, and a fixed footer, so the
validation state and the Generate/Remove/Reset buttons never scroll away. The
panel itself is CSS-resizable; the pillbox popover is a fixed 290px wide, so the
plugin tags its own popover with a class that lets it size to the panel. Size is
persisted by reading the **inline** width and height, because a corner drag
writes those while a short window merely clamps the rendered box through
`max-height` — persisting the clamp would shrink the panel permanently.

Element IDs are namespaced per axis (`dsm-vector-tools-x-minimum`), because
duplicate IDs point `<label for>` at the wrong input.

## Components in the expression list

The two component definitions are ordinary expressions in the generated folder,
and the panel keeps them in sync in both directions. A dispatcher listener
watches `set-item-latex`, `undo`, `redo`, and `set-state`, and adopts a changed
definition only if its left-hand side still matches the function this field owns;
otherwise it reports that the link is broken rather than adopting an expression
that is no longer the field's component. Writes in the other direction use
`setExpression`, which merges into an existing expression and so leaves
`folderId` and `colorLatex` on the rest of the field alone.

## Who draws the arrows

`config.arrowMode` chooses, and the two are not alternatives so much as two
stages. **Live** is `flow/ArrowRenderer.ts`: one instance per grid point, the
field evaluated in a vertex shader, geometry that exists only in that shader —
nine vertices addressed by `gl_VertexID`, with no vertex buffer at all. It
writes nothing to the expression list, has no vector cap worth naming, and
redraws as the settings change. **Desmos** is the generator above, which is
slower and capped but produces a graph that still works for someone without the
extension. Live is the default because a tool for looking at a field should show
one immediately; Generate is what commits it.

Live arrows are their own canvas and so their own WebGL context, beside the
flow's. The two want opposite things from a frame — the flow advects sixty times
a second and fades its previous frame, the arrows are a still picture — so
sharing a renderer would mean the arrows paying an animation loop's costs to sit
still. `ArrowOverlay` redraws on a coalesced `requestAnimationFrame` when the
view, the field or a setting changes, and not otherwise.

`arrowMode` has a third setting, `off`, because live arrows are on as soon as
the plugin is enabled and turning them off should not mean pretending you want
Desmos to draw them.

Two things keep a settings change cheap, and both had to be added after the
fact. Every change arrives as `start(field, options)` with the _same_ field, so
`setField` compares it against the one the linked program was built from and
returns; without that, dragging the arrowhead slider compiled and linked a
shader per pointermove — measured at a hundred links across a hundred frames of
a drag, against none now. And instances cover only the columns and rows of the
grid that intersect the view, plus a margin wider than the longest arrow the
shader will draw, because the sampling domain has nothing to do with what is
on screen: a 201×201 domain looked at from twelve units across submitted forty
thousand instances a frame and now submits about a hundred and sixty-five, each
of the rest having evaluated the field in a vertex shader only to be clipped.
`visibleGridSpan` is where that arithmetic lives and it falls back to the whole
grid rather than guess whenever a bound is not finite — drawing too much is a
performance answer, drawing too little is a wrong picture.

A vast sampling domain is sampled more coarsely rather than drawn in full —
by default, and only by default. `arrowDensityLimit` turns it off, and then
every sample is drawn however many that is; three hundred thousand arrows is a
legitimate thing to ask for, and being able to ask is the point of drawing here
rather than through Desmos. The limit exists because
matching the domain to a zoomed-out viewport asks for hundreds of thousands of
arrows at a step of 1 _by accident_, and what you get is the moire between the
arrow grid and the pixel grid rather than the field. `thinArrowGrid` scales both
axes by one factor down to the same limit Desmos generation refuses at, and the
status line says it did and how to turn it off. Arrow length is capped
against the viewport for the same reason from the other end: when the domain is
far larger than the view, the spacing the auto length follows is itself larger
than the screen.

Two details are load-bearing. The arrowhead is a filled triangle, which is the
thing Desmos expressions cannot do — a head there is two line segments, because
a filled one would be a polygon per arrow — and it is capped against the arrow's
own length so a short vector keeps a visible shaft. And the colors come off the same ramp the
flow uses.

That ramp saturates — `1 - exp(-m/scale)`, with the scale set by the viewport —
rather than stretching between a measured smallest and largest. Which matters
because of poles. Anything with a denominator passing through zero, which is
most of what a multivariable course is about, reaches magnitudes near that pole
larger than the rest of the field put together;
`sin(x²+y²)/(1-|x³y³|+cos(x²+y²))` reaches two hundred thousand within a few
units of the origin while the rest of it sits below ten. A ramp stretched to one
of those leaves everything else inside its first hundredth, which is one flat
color: the bottom of whichever palette was chosen. A saturating ramp gives the
ordinary magnitudes most of its length and lets the poles run into its end.

Nothing is measured, so nothing can take the range over, and both halves of the
picture agree by construction rather than by keeping two measurements in step.
Log magnitude takes logarithms of the same ramp, scaled so a magnitude means the
same in either. `color.rangeMode` can still be set to `manual`, which spreads
the ramp linearly between two given values, for when a fixed scale matters more
than a readable one.

The generated expressions are the exception: they take Desmos's own `min` and
`max` over the grid, because a static graph has no viewport for a scale to
follow. A field drawn both ways will not colour identically.

## Flow visualizer

`flow/` holds the only rendering code in the plugin. It is a deliberate,
explicitly requested exception to the "no second renderer" rule, and it is
constrained so it cannot affect the graph it draws over: it owns one
`pointer-events: none` canvas, writes no expressions, touches no calculator
state, and is torn down when it is stopped or the plugin is disabled. See
[VECTOR_FLOW_VISUALIZER.md](VECTOR_FLOW_VISUALIZER.md).

Two of its constraints come from what it draws on rather than from what it
draws. It only registers with the 2D graph paper, so `flowAvailability` refuses
the 3D product before the field is even compiled; `/geometry` is the same graph
paper and needs nothing special. And particle _capacity_ is separated from
particle _count_: the count slider fires per pointermove, and the count owning
an allocation meant deleting and rebuilding two float textures once a frame for
the length of a drag.

A frame is four passes: integrate the particles, fade the trail, draw the
particles into it, blit it to the canvas. Three of those cover the whole canvas,
so their cost is the drawing buffer's area, and three decisions follow from
that:

- **Render scale.** The buffer is sized at the device pixel ratio times a
  configurable `renderScale`, so on a dense display the user can trade detail
  the trails barely show for the frame rate they do. Point size is already
  expressed against the buffer, so the particles stay the same visual size.
- **Trails move with the view.** Pan and zoom invalidate a screen-space trail
  texture, and clearing it was the obvious answer and the wrong one — Desmos
  reports bounds on every pointermove, so a drag wiped the trails sixty times a
  second and the flow blinked out for the whole gesture. `setBounds` redraws the
  old trail into its new place instead, one screen pass, with whatever pans in
  from off-screen left transparent. Only an explicit `resetBounds`, on starting,
  clears.
- **Nothing is drawn that nobody can see.** `requestAnimationFrame` already
  stops for a hidden tab but not for a graph scrolled out of view, so an
  `IntersectionObserver` on the canvas skips the frame body while it is off
  screen.

Both overlays also survive losing their context. A browser caps how many WebGL
contexts a page may hold, and these are two on top of Desmos's own; a GPU reset
or a page with too many graphs on it takes one away. Each overlay listens for
`webglcontextlost` — calling `preventDefault`, without which the browser never
restores it — drops the renderer, says so, and rebuilds on
`webglcontextrestored` from the field and options it kept for exactly that
reason. `isRunning` is therefore the canvas, not the renderer: a mounted
overlay with a lost context is still running, briefly drawing nothing, and
offering to start it again would be answering the wrong question. Pressing
Visualize while one is lost remounts, which is the way back if the browser
never restores it.

Every program's single vertex attribute is bound to slot 0 before linking, which
lets one vertex array object per buffer be shared by all of them. The attribute
pointers are then set once at creation rather than re-established, along with an
attribute-location query, on every pass of every frame.

## Development Test Lab

The Test Lab is compiled into watch/development builds only through the
`DEV_BUILD` compile-time value. Release builds do not render it and no query
parameter or persistent setting can enable it. Its generated field uses the
separate `vector_tools_vf_test` namespace and its preset choice, density,
manual checklist, and diagnostics are session-only. See
[VECTOR_TOOLS_TEST_LAB.md](VECTOR_TOOLS_TEST_LAB.md) for its workflow.

## Extension points

Later vector, gradient, contour, and complex-plane tools should add a versioned
configuration plus a deterministic plan, then use the same adapter ownership
and audit rules. Any additional Desmos-internal integration should stay
isolated at the adapter boundary and be re-verified as Desmos or DesModder
changes.

---

## The field library

One setting used to hold one `VectorFieldConfig`. It now holds a
`VectorFieldLibrary` — every saved field, which one is active, and the panel's
own geometry — and the panel gained a chooser above its tabs.

Only the active field is drawn live. Generated Desmos expressions are a
different matter: each field's are namespaced with its own id and stay in the
graph, so a field can be generated, set aside, and a second one generated
beside it.

### The collision this had to fix first

`createSymbols` took the field's id and threw it away:

```ts
const instance = instanceID === "test" ? "t" : "d";
```

Every field emitted `v_{tfdp}`, `v_{tfdq}` and the rest. Invisible while only
one field could exist — and a duplicate-definition error in Desmos the moment
two could. Each field now carries a `symbolToken` and its symbols are built
from that.

The token is **stored on the field**, not derived from its position, because a
field has to keep meaning the same thing after the one above it is deleted. `d`
is first in `SYMBOL_TOKENS` so the field a pre-library setting migrates into
keeps the symbols it has already written into the user's saved graphs, and `t`
is absent because the generator's test lab reserves it.

### Migration

`normalizeVectorFieldLibrary` accepts a bare field as well as a library, since
that is what every setting saved before this contains, and wraps it into a
one-field library keeping its id and token. Repeated ids or tokens in a stored
file are moved apart rather than dropped — the field is still the user's, and
only its addressing is wrong.

An integration test does the real thing: writes a schema-3 setting, restarts the
plugin, and checks the field comes back as the user's rather than as a default.

### A leak the tests found

Adding those tests broke an unrelated one. Plugin settings reach extension
storage on a debounce, and `waitForSync` waits for the _evaluator_, not for
that — so a page closed before the flush left the next one reading a stale
setting, migrating it on enable, and holding a settings write in flight while
that test asserted nothing was pending.

Two guards came out of it. The tests now wait for the flush before closing, and
a unit test asserts the library **normalizes back to exactly itself**. That one
is not tidiness: the plugin compares the serialized library against what is
stored every time it starts, so a library that does not round-trip means every
enable writes a setting.

## The panel, tidied

**The chooser sits above the tabs.** Every tab edits the field it points at —
Colour and Flow as much as Field — so a chooser inside one of them would read as
a setting of that tab. It is one row, because it lives in the chrome where the
space it takes is taken from every tab at once; many fields scroll sideways
rather than wrapping into a second row.

**The two sampling axes are side by side**, and each one's mode shares a line
with its heading. Two identical bordered cards stacked down the page were taking
most of the Field tab to hold six numbers. The mode stays per-axis — sampling x
by step and y by count is unusual and perfectly reasonable — it just no longer
costs a row.

Both axis chip groups also used to carry the same `aria-label`, so nothing could
tell them apart; they are now "Sampling x by" and "Sampling y by".

**`.dsm-vector-tools-note` had no CSS rule at all.** Used once, for the
paragraph under "Drawn by", it drew at full body size beside every other
explanation, which uses the small grey hint. It is the same kind of sentence and
now looks like it.

**The default panel is 460×650**, measured rather than guessed: at 620 the
sampling cards sat 25px past the fold, which is the worst height to pick —
enough to hide a control, not enough to look deliberate. At 650 the Field tab's
`scrollHeight` equals its `clientHeight`. The old default was 420×560, from
before the tab held either a chooser or two axis cards.

Evidence: `docs/assets/vector-tools-library.png`.

### Next

Four new field sources are agreed and not yet built: point sources (a table of
charges or masses summed into an inverse-square field), the perpendicular
gradient (−f*y, f_x) for stream functions and level-curve flow, polar components
(F_r, F*θ), and a complex function drawn as a Pólya field. The last of those is
much the most expensive — extracting real and imaginary parts symbolically is a
complex-arithmetic evaluator, not a formula — so it goes last.

Then colouring by divergence or curl, which `symbolic.ts` already has the exact
partials for; and a gallery of presets that move and react, which is what the
per-field clock and the environment scanner were built for.
