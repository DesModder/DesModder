# Flow visualizer

## What it does

**Visualize** in the Vector Tools panel animates the field you typed into
`P(x, y)` and `Q(x, y)` as particles carried along it, drawn on a transparent
canvas over the Desmos graph paper. It is a picture of the field's flow, not a
graph object: it adds no expressions, changes no calculator state, and leaves
nothing behind when it is stopped.

The technique is adapted from [fieldplay](https://github.com/anvaka/fieldplay)
by Andrei Kashcha (MIT; the notice is in
`src/plugins/vector-tools/flow/LICENSE-fieldplay.md`). Particle positions live
in a texture, a fragment shader advances each one by a Runge–Kutta step every
frame, particles are drawn into a trail texture that fades slightly per frame,
and a small fraction respawn at random positions so the field does not collapse
onto its attractors.

The port targets WebGL2 and stores positions in a float texture, so fieldplay's
RGBA float packing is gone; it takes its bounds from Desmos's graph paper rather
than owning pan and zoom; and it composites over the graph rather than owning
the screen.

## Using it

Press **Visualize** on the panel's **Flow** tab to start, and **Stop
visualization** to stop. It reads the current `P` and `Q` immediately, so
editing either — in the panel or in the expression list — restarts it with the
new field shortly after you stop typing. Panning or zooming the graph
re-registers the flow and clears the trails, because trails are stored in screen
space.

- **Particles** is any count from 500 to 400,000 — type an exact number or drag
  the slider, which is logarithmic so the useful low end is not crushed into the
  first centimetre of the track. 16,000 is the default; above 120,000 the panel
  warns that an integrated GPU may drop frames. Particle state lives in a square
  float texture, but only the requested count is ever advanced or drawn, so the
  number you ask for is the number you get. The texture is sized to a
  power-of-two _capacity_ rather than to the count itself, because the slider
  fires on every pointermove and reallocating there would rebuild both textures
  and re-upload a multi-megabyte seed array once a frame for the whole drag.
  Dragging the full track reallocates about ten times; it shrinks back only once
  the count falls under a quarter of the capacity.
- **Particle color** — _Speed_ shades by the field's magnitude, _Direction_ by
  its angle, _Fixed color_ uses the field's fixed color.
- **Constant speed** integrates the normalized field, so every streamline is
  traced at the same pace. Turn it off to let fast regions actually move fast;
  fields with a wide magnitude range look much better with it on.
- **Speed**, **Trail persistence**, **Opacity**, and **Particle size** are the
  visual dials. The defaults are deliberately restrained so the axes,
  expressions, and generated arrows stay readable underneath.

## What it can and cannot evaluate

The GPU cannot call back into Desmos's evaluator, so `flow/latexToGLSL.ts`
compiles the component LaTeX into a GLSL expression. It supports numbers, `x`,
`y`, `e`, `\pi`, the arithmetic operators, implicit multiplication, `\frac`,
`\sqrt` (including `\sqrt[n]`), powers, `|...|`, and the usual named functions
(trig and inverse trig, hyperbolics and their inverses and reciprocals, `\exp`,
`\ln`, `\log`, `\operatorname{mod}`, `\operatorname{sign}`, `\min`, `\max`,
floor/ceil/round), and piecewise functions and restrictions, where no branch
holding means no arrow, as in Desmos.

A gradient field is compiled differently: its scalar f goes to the GPU as a
function, and the shader central-differences it, because the GPU cannot
differentiate symbolically the way the generated Desmos expressions do. The step
size follows the viewport, so the gradient stays smooth at any zoom, and it is
exact for the quadratics most potentials are built from. The arrows on the graph
remain Desmos's exact partials either way — only the animation samples.

Anything else is refused **by name** before the button is enabled, rather than
producing a plausible-looking animation of the wrong field. The common cases:

- A reference to another expression (`a_{1}`), which only Desmos can resolve.
- Lists, integrals, derivatives, and sums.
- Any variable other than `x` and `y`.

Divisions and singularities are guarded rather than allowed to produce
infinities, and a particle that escapes the viewport, stalls, or goes non-finite
is respawned.

## Differences from the generated arrows

The arrows and the flow are two views of the same field, but they are not
pixel-consistent, and they are not meant to be:

- The arrows are sampled on the configured grid; the flow samples continuously
  wherever particles happen to be.
- _Speed_ coloring uses a scale-free ramp based on the current viewport rather
  than the arrow color range, so it needs no reduction pass over the field.

If the two disagree about direction anywhere, that is a bug worth reporting —
they are compiled from the same two LaTeX strings.

## Requirements

WebGL2 with `EXT_color_buffer_float`. If either is missing, the panel says so
and the visualizer stays off; the generator is unaffected.

It runs anywhere Desmos draws the ordinary 2D graph paper, which includes
`/geometry` — verified against a real page, where the overlay registers with
`canvas.dcg-graph-inner` exactly as it does in `/calculator`.

It is refused on `/3d`, and the Visualize button is disabled with that reason.
The overlay maps math coordinates linearly onto the graph paper's rect, and on
the 3D product `graphpaperBounds.mathCoordinates` is a rotatable x/y/z box with
no screen-space meaning, so nothing it drew could stay registered with the scene
underneath — which the 3D canvas paints over regardless. Generating the field
still works there.
