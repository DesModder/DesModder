# Vector Tools 3D arrows — step-1 mock-up

`../vector-3d-arrows.html` is the page; this folder is its source.

```
node docs/mockups/vector-3d-arrows/build.mjs     # bundle into one page
node docs/mockups/vector-3d-arrows/measure.cjs   # numbers + contact sheets
```

The build bundles the plugin's real shared modules (`latexToGLSL`, `palettes`,
`camera3d`) into the page, so what it draws is what the plugin would compile.
The measuring script writes `measurements.json` and the contact sheets in
`docs/assets/vector-3d/`.

## What is real and what is a stand-in

Two WebGL contexts, as in the real page. `standin.ts` plays Desmos 3D: a box,
axes, the translucent z = 0 plane and one surface `z = f(x, y)`. It hands the
overlay a `Camera3D` in exactly the shape `cameraFromRedrawResult` produces.
Its numbers are not Desmos's: the field of view per perspective step is
invented. `overlay.ts` is the part that becomes the plugin's renderer. It
cannot read the stand-in's depth, which is the real constraint.

The arrow's two ends are placed in math coordinates, so the tip lands on
`start + F` as Desmos's `vector()` would in any box. Its body is built in
camera space, so a shaft stays round in a box twenty units wide and two tall.

## Measured

All GPU times are `EXT_disjoint_timer_query_webgl2` on **Intel Iris Xe
(ANGLE, D3D11)**. Headless Chrome on this machine uses the real GPU. They cover
the overlay's draw only, in a headless window at 1280×1000 CSS px, and vary
about 20% between runs.

| Arrows | Lines (6 vtx) | Flat (9 vtx) | Shaded 3D (120 vtx) |
| -----: | ------------: | -----------: | ------------------: |
|  1,000 |  0.13–0.16 ms | 0.14–0.18 ms |          1.5–1.8 ms |
|  3,375 |  0.30–0.42 ms | 0.29–0.37 ms |          3.8–5.1 ms |
|  8,000 |  0.43–0.69 ms | 0.55–0.67 ms |          6.5–6.7 ms |
| 27,000 |    1.4–1.9 ms |   1.5–1.8 ms |            16–20 ms |

Auto switches from shaded to flat above 3,000 arrows, about 4 ms.

**Colour near poles.** With 10³ arrows on a cell-centred grid, the box rule
(the 2D overlay's scale, a third of the width) is unusable in 3D. On a point
charge it puts 96.8% of the arrows in the first tenth of the ramp. On a dipole
it puts 98.4% there. An inverse-square field is small almost everywhere in a
box. The field rule (scale = median |F| ÷ ln 2, so the median lands mid-ramp)
gives 0% in the first tenth and 5.6% / 12.0% at the end, near the poles. A
median survives a pole by construction. Desmos has `median()`, so generated
expressions could use the same rule. Both rules are chips; the field rule is
the default. GPT's round, run separately, reached P60 and 8.6% / 13.9%.

**Our copy of the surface.** This is the worst gap in screen pixels between a
mesh of n cells per side and the true surface, with the box about 570 px
across. Auto takes the coarsest mesh under 1 px.

| Surface |   16 |   32 |   64 |  128 |  256 |
| ------- | ---: | ---: | ---: | ---: | ---: |
| bump    | 3.50 | 0.91 | 0.23 | 0.06 | 0.01 |
| saddle  | 0.49 | 0.12 | 0.03 | 0.01 | 0.00 |
| ripple  | 3.59 | 0.91 | 0.23 | 0.06 | 0.01 |

This bounds our mesh against the exact surface, not against Desmos's, whose
meshing is unknown. Part B can measure that.

## GPT's research round (`docs/research/vector-3d-gpt/`)

It agrees on shaded solid arrows with their own depth test, stratified jitter
(now the default, at its 14–86% of a cell), a percentile colour scale, and
X-ray as the honest default name. It corrected one assumption: GLesmos also
draws on its own canvas, so option (d) has no precedent at all.

Its benchmark and visual prototype both failed to compile as delivered. `half`
is a reserved word in GLSL ES. That one name is patched in both. After the
patch, its benchmark reports 0 ms for everything on the Iris Xe:
`gl.finish()` does not wait for the GPU in Chrome, so that method cannot time
a draw. The table above replaces its provisional thresholds.

Differences from GPT, which are left for Rafael to judge on the page:

- Its arrows are 0.55 of the spacing; ours default to 0.8. The size slider
  covers both.
- It proposes hiding arrows where the field is undefined, with a validity
  flag in the GLSL helpers, instead of the ε guards. That changes the shared
  prelude, and briefing §11 lists it as an open decision. It belongs to the
  plugin step, not this mock-up.
- Its 8-sided glyph without a base disc is 72 vertices. Ours is 10-sided
  with a disc, 120 vertices, so the cone does not look hollow from behind.

## Seeing the middle as well as the edges (2026-10-06)

Rafael asked for Hidden as the default (X-ray and Faded stay as options), and
for a look like a 3D streamlines picture and an atomic-orbital cloud, where
the inside of the field shows through its edges. Opaque arrows cannot do that:
the front layer hides the middle. Three additions, all under **Look**:

- **Streamlines** (`looks.ts`). Seeds scattered through the box, each traced
  with RK4 at unit speed in box units, on the GPU, into a history texture
  array. The trace depends on the field, the box and the settings, never on
  the camera, so rotating only redraws it. Every other line is traced
  backwards. Traced forwards only, every line ended in a sink and the
  negative charge of a dipole drew as a red pile.
- **Animate along the flow.** The look of
  [3dstreamlines](https://github.com/JamesRunnalls/3dstreamlines) (James
  Runnalls, MIT): a lit stretch travels along each line, its tail fading by
  `exp(1 − 1/c²)`, each line at its own phase. That library runs on the CPU,
  with one three.js `Line` per stream (10,000 objects re-uploaded every frame),
  Euler steps and nearest-grid-point lookup, on gridded data only. Here the
  same look is a moving window over the trace already on the GPU, so
  animating costs one instanced draw and integrates nothing.
- **Glow cloud.** Random points, each kept with probability `ramp(|F|)^k`,
  so density follows the field's strength. For a dipole, strength alone is a
  featureless blob. **Colour by direction** (|F̂| as RGB, the map used in 3D
  flow and diffusion imaging) separates its lobes, which is what makes orbital
  pictures read.
- **Cut away: Nothing, Near half, or Cake slice.** The slice is a wedge
  (90° by default, adjustable) round the vertical axis through the box's
  centre, measured in box half-widths and always opening towards the camera.
  Nothing is drawn in it: an arrow that starts inside it is dropped whole
  (clipping fragments sliced arrows along its edge into stubs), and
  streamlines and cloud points are clipped at its faces. Painting the cut
  faces with the field was tried and rejected by Rafael: he wants the slice
  empty.

Evidence: `docs/assets/vector-3d/looks.png`.
