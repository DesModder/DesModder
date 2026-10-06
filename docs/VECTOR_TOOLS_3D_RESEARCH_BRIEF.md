# Vector Tools — research brief: vector fields on Desmos 3D

Vector Tools is a browser-extension plugin for desmos.com (inside DesModder)
that draws 2D vector fields in three ways:

- as generated Desmos expressions (shareable, capped);
- as live arrows on our own WebGL2 canvas (field evaluated in the vertex
  shader from the user's LaTeX via `latexToGLSL`, one instanced draw call, no
  cap);
- as a GPU particle flow (fieldplay-derived).

`VECTOR_TOOLS_BRIEFING.md` (attached) is the full picture. We now want the same
on **Desmos 3D** (desmos.com/3d), for students of multivariable calculus and AP
Physics C (electric and magnetic fields).

## What we already have

`DESMOS_3D_CAMERA.md` and `camera3d.ts` (attached): the camera of each frame
Desmos 3D draws, read from `grapher3d.redrawResult.camera` (three column-major
three.js matrices), folded into one math-to-clip matrix.

- A WebGL canvas laid exactly over Desmos's draws points within 0.1–0.7 px RMS
  of Desmos's own, in perspective and orthographic views, on non-cubic boxes,
  at 2× DPR.
- We follow `onRedraw3dResults`, which fires once per redraw.

**Constraints:**

- Desmos draws on its own WebGL context (with depth peeling), so **we have no
  access to its depth buffer**.
- Desmos clips to the box, and the z = 0 plane is translucent.
- Everything runs in a browser extension in the real page, with WebGL2 only
  (no WebGPU assumption, no compute shaders) and no server.
- Must run on integrated GPUs; the maintainer's is an Intel Iris Xe.

## Questions

As before, **a demonstrated mechanism beats a name**. Where you recommend
something, give a small runnable WebGL2/JS or GLSL prototype, with numbers you
measured, and say plainly what you did not run.

### 1. Arrows in 3D that read well

- **Arrow geometry.**
  - Lines, camera-facing flat arrows (billboards), or shaded 3D glyphs (cone
    plus cylinder)?
  - What do ParaView/VisIt, Mathematica's `VectorPlot3D`, matplotlib's
    `quiver` (3D) and the 3D vector-field literature recommend for
    readability, and why?
  - Instanced geometry built entirely in the vertex shader from
    `gl_VertexID`/`gl_InstanceID` (no vertex buffers) is our pattern. Give the
    vertex counts and the shading cost at 10³–20³ arrows.
- **Sampling.** Where to put arrows in a box: a full 3D grid clutters. What do
  the experts do? Options include:

  - jittered or Poisson-disk seeding;
  - slices or planes the user moves;
  - arrows only on a chosen surface;
  - density chosen by screen size.

  Give heuristics for count and length scale chosen automatically (Auto) with a
  manual override.

- **Depth cues without Desmos's depth.** Our arrows always draw over Desmos's
  surfaces. Which cues make 3D direction readable anyway? Candidates include:
  - shading;
  - depth-based fading or size (fog);
  - outlines or halos;
  - order-independent transparency (weighted blended OIT on WebGL2), or
    sorting.
- **Magnitude colour near poles.** Our 2D ramp saturates, `1 − exp(−m/scale)`,
  because fields with poles (point charges!) reach enormous magnitudes. Does
  the same choice hold in 3D, and how should arrow length be capped near a
  pole? Test on a point charge and on a dipole.

### 2. Occlusion: our overlay against Desmos's surfaces

We cannot read Desmos's depth. Which of these is sound and robust, and what
would each cost?

- **(a) Accept it.** Draw over everything, with good depth cues.
- **(b) Reproduce depth ourselves.** Redraw the user's own surfaces or solids
  that we can parse (`z = f(x, y)`, implicit `F(x, y, z) = 0`, parametric)
  into our own depth buffer, depth only, so they hide our arrows. How do we
  match Desmos's tessellation closely enough?
- **(c) Desmos-native output** (question 3), which Desmos then depth-sorts
  itself.
- **(d) A hook into Desmos's renderer**, as GLesmos does in 2D, to draw inside
  its context. How fragile is that, and is it acceptable for an extension
  distributed publicly?

Describe how the GLesmos plugin (DesModder) draws inside Desmos 2D's context,
and whether Desmos 3D exposes anything comparable.

### 3. Desmos-native 3D vectors

Desmos 3D has `vector(start, end)` and lists. Answer as much of this as can be
established:

- How many vectors can one expression, and one graph, hold before Desmos slows
  or refuses?
- Can a single list expression draw a whole field? The 2D generator needs
  three parametrics per arrow.
- How are colour per vector and arrowhead size controlled?
- What does it cost to rebuild on a slider change?

### 4. Flow in 3D

- **Particles.** Particle advection through F in WebGL2 without compute shaders
  (positions in float textures, transform feedback, or textures updated by
  ping-pong render passes).
- **How flow reads in 3D.** Points, short trails (streaklets), streamlines or
  streamtubes, and how each reads over a rotating 3D scene.
- **Rotation without smearing.** Our 2D flow fades a trail texture in screen
  space. In 3D the camera rotates, so screen-space trails smear. How do others
  keep trails in world space?
- **Budgets.** Particle counts and frame cost on an integrated GPU.

### 5. Analysis that should come next

Divergence (scalar) and curl (vector) of F: how to show them in 3D. Options
include:

- colouring arrows;
- a slice plane with a colour map;
- isosurfaces of divergence;
- curl drawn as its own arrows.

Two quantities are well defined when the surface or curve is one the user
graphed:

- flux of F through a surface;
- the line integral along a curve.

How would we compute them from the user's Desmos parametric or implicit
definition (numerically on the GPU, or through Desmos's own evaluator), and how
would we show the integrand on the surface?

### 6. Teaching

For AP Physics C (E&M), AP Physics 2 and Calculus 3, which 3D fields and views
should a student see first? Rank the presets, for example:

- point charge and dipole;
- the field of a line current;
- the curl of a uniform rotation;
- a gradient field with its level surfaces.

Which views make divergence and curl click?

## Rules a proposal has to satisfy

From the briefing §10:

- It runs in the real desmos.com page in an extension.
- It doesn't require new Desmos notation.
- It says whether it is generated Desmos expressions or our own canvas.
- If it colours by magnitude, it says what happens near a pole.
- Any trade-off sits behind a labelled control with a sensible default; product
  decisions belong to the maintainer.
- It can be verified in a picture.

## Attached

- `VECTOR_TOOLS_BRIEFING.md`
- `DESMOS_3D_CAMERA.md`
- `camera3d.ts`
- `ArrowRenderer.ts` (2D live arrows)
- `FlowRenderer.ts` (2D particle flow)
- `latexToGLSL.ts`
- `generator.ts` (2D Desmos-expression output)
- `environment.ts`
- this brief
