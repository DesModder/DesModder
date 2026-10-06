# Vector Tools 3D — handoff for a new chat

Paste the block below into a new Claude Code chat opened in
`C:\Projects\Desmos Extension`.

---

We are starting the 3D work on Vector Tools: vector fields on Desmos 3D. Until
now the plugin is 2D only. `flowAvailability` refuses the 3D product, because
on 3D the graph-paper bounds are a rotatable box with no screen meaning.

**Read first.**

- `docs/VECTOR_TOOLS_BRIEFING.md`, the whole plugin. §5.5 and §6 matter most
  here.
- `docs/DESMOS_3D_CAMERA.md`. We already match Desmos 3D's camera to 0.1–0.7 px
  RMS. `src/field-rendering/camera3d.ts` turns `grapher3d.redrawResult.camera`
  into one math-to-clip matrix. Follow `onRedraw3dResults`, reading the camera
  from its argument, not from `worldRotation3D`. A unit test and a live
  integration test (`camera3d.int.test.ts`) pin it.
- My memory notes for this project (house style, always commit, mock-ups first,
  finish with `npm run build`).

**What we want, in order. Each step is shown to me as a small interactive
mock-up before it is built into the plugin.**

1. **Live 3D arrows.** A field F(x, y, z) = (P, Q, R) typed as LaTeX, drawn as
   arrows on our own WebGL overlay exactly over the Desmos 3D graph, following
   rotation, zoom, perspective/orthographic and box changes frame for frame.
   - The 2D `ArrowRenderer` model carries over: field evaluated in the vertex
     shader via `latexToGLSL`, geometry from `gl_VertexID`/`gl_InstanceID`,
     one draw call.
   - What has to be decided:
     - 3D arrow geometry (lines, flat ribbons facing the camera, or shaded
       cones and cylinders);
     - the sampling grid in the box;
     - length scaling and the saturating colour ramp of §6;
     - how arrows read without Desmos's depth.
2. **Desmos-native 3D vectors.** As the 2D generator does: shareable, capped,
   using Desmos 3D's own `vector(start, end)`. Find its caps and how it draws.
3. **3D flow**: particles or streamlines advected through F, drawn over the
   graph. Particle count and trail style live behind controls.
4. **Analysis in 3D**: divergence and curl (curl is a vector field), flux
   through a surface the user already graphed, line integrals along a curve.
   These come later; design 1–3 so they fit.

**Known limits** (`DESMOS_3D_CAMERA.md` "What is still unknown"):

- **No depth.** Desmos draws on its own WebGL context, so our overlay cannot be
  hidden by Desmos's surfaces. How to handle occlusion is a decision for me,
  not for you. Show me the options in the mock-up.
- **Clipping.** Desmos clips to the box, and the z = 0 plane is translucent.
- **Not yet verified:** continuous drags on a real GPU. Check by eye once an
  overlay exists.
- **Private fields.** These are private Desmos fields; the integration test is
  the guard.

**House rules.**

- Never decide a trade-off for me: put it behind a labelled control with a
  sensible default (Auto plus a manual override is my usual preference).
- Screenshots are evidence.
- Commit green work without asking, with prose "why" messages. Ask before
  pushing.
- Always finish with `npm run build` (Chrome MV3).
- Research-grade engine, AP-level words.

**Research.** A research brief for GPT is in
`docs/VECTOR_TOOLS_3D_RESEARCH_BRIEF.md`, zipped at
`C:\Users\rafae\Downloads\Vector_Tools_3D_Research.zip`. I may bring its
answers into this chat. Don't wait for them to start step 1's mock-up.

**Start** by reading the docs, then propose the step-1 mock-up (what it shows,
what controls it has, what you will measure) before building it.
