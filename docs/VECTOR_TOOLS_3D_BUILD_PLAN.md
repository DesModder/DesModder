# Vector Tools 3D — build plan

_Written 2026-10-06, after the step-1 mock-up
(`docs/mockups/vector-3d-arrows/`, published at
https://claude.ai/artifact/4ihRcdBcqxfpHkYSvYk5i7) and the part-B probe of
the real Desmos 3D (`docs/mockups/vector-3d-arrows/probe-desmos3d.cjs`).
This is the plan for moving the mock-up into the plugin. It holds what the
probe established, how the code is laid out, the order of work, how each
step is verified, and the decisions still open._

---

## 1. What the real Desmos 3D allows (part B, measured)

Run against the built extension on desmos.com/3d, headless Chrome on the
Iris Xe. Raw output: `probe-desmos3d.json`. Pictures:
`docs/assets/vector-3d/desmos3d-probe-*.png`.

- **Where the overlay canvas goes.** Desmos 3D draws on
  `grapher3d.webglCanvas` (`canvas.dcg-webgl-canvas`), an absolutely
  positioned, _later_ sibling of the 2D `canvas.dcg-graph-inner`, inside
  `div.dcg-grapher-3d`. Anything inserted next to the 2D canvas, as
  `ArrowOverlay` does, is painted over. This is the "3D canvas paints over
  the overlay" that the existing 3D refusal test mentions. The overlay goes
  **straight after `webglCanvas`**.
- **Position it from rectangles, not offsets.** `offsetLeft`/`offsetTop` of
  the 3D canvas are measured from a different ancestor. Using them put the
  overlay 400 px right and 377 px down. The difference of the two
  `getBoundingClientRect()`s is correct.
- **The hook.** `onRedraw3dResults` fired once per redraw (26 of 26 during
  a rotation). Its single argument carries `camera` (three plain 16-number
  arrays, plus `cameraType` and `worldRotationQuaternion`) and `screen`, as
  `camera3d.ts` expects. Our projection of a point matched Desmos's own
  `mathCoordinatesToScreenCoordinates` to 10⁻¹³ px.
- **Alignment while rotating.** A ring drawn by the overlay from the hook's
  argument was compared with Desmos's own green point in screenshots taken
  during a continuous 4-second rotation. The offset was **0.28 px median,
  0.49 px at the 90th percentile, 4.7 px worst** over 29 frames. The worst
  frame is one screenshot caught between the two canvases presenting. A
  real-GPU drag checked by eye is still the last word.
- **Surfaces in the expression list.** Each graphed item's
  `formula.expression_type` names what it is:

  | `expression_type`   | Typed as                                                                              | Our depth copy                                   |
  | ------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------ |
  | `SURFACE`           | `z=f(x,y)`, a bare `f(x,y)`, and a definition `f(x,y)=…`, which Desmos 3D also graphs | grid in x, y                                     |
  | `SURFACE_xyz_uv`    | `(X(u,v), Y(u,v), Z(u,v))`; `formula.domains` holds the u, v ranges (default 0..1)    | grid in u, v                                     |
  | `SURFACE_AMBIGUOUS` | `x=y²` (also `assignment: "x"`)                                                       | grid, solved axis                                |
  | `IMPLICIT_SURFACE`  | `x²+y²+z²=9`, and inequalities such as `z<x²`                                         | none at first                                    |
  | `CURVE3D_xyz_t`     | `(X(t), Y(t), Z(t))`                                                                  | a curve, not a surface; for line integrals later |

  The item model also carries `hidden`, `surfaceOpacity` (`""` is the
  default), `resolution` and `colorLatex`, which the redraw honours.

- **The box.** `grapher3d.viewportController.getViewport()` gives the six
  numbers. `getState().graph.__v12ViewportLatexStash` is the same as LaTeX.

## 2. What carries over from the mock-up, decided

These are settled by Rafael or by measurement. They become defaults, each
behind its control.

- **Behind a surface:** Hidden by default; X-ray and Faded as options.
- **Looks:** Arrows (default), Streamlines (traced both ways, animated along
  the flow by default), Glow cloud (by strength, or by direction).
- **Cutaway:** Nothing (default), Near half, Cake slice (empty, nothing
  painted, arrows dropped whole; faces you or fixed in the box).
- **Colour scale Auto:** median |F| ÷ ln 2, with the box rule as a chip.
  Measured: the box rule left 97% of a point charge's arrows in the first
  tenth of the ramp.
- **Placement:** jittered (14–86% of a cell) by default; whole box, slice,
  on a surface.
- **Arrow shape Auto:** shaded 3D up to 3,000 arrows, flat above. Measured
  on the Iris Xe: 1,000 shaded ≈ 1.6 ms, 8,000 ≈ 6.5 ms.

## 3. Layout

The renderers go below both plugins, in `src/field-rendering/`, as the 2D
ones did, so neither plugin depends on the other. Each file is a port of a mock-up
file, not a rewrite. The mock-up is the reference picture for every step.

| New file                              | From the mock-up              | Owns                                                                                                                                                                                        |
| ------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | -------------------------------------------------- |
| `field-rendering/Overlay3D.ts`        | probe + `main.ts` render loop | the canvas after `webglCanvas`, placement from rects, the `onRedraw3dResults` hook (DesModder's `hookIntoFunction`, reading the camera from the argument), resize, visibility, context loss |
| `field-rendering/Arrow3DRenderer.ts`  | `overlay.ts`                  | instanced arrows, shapes, sampling, length, colour, depth cues                                                                                                                              |
| `field-rendering/Volume3DRenderer.ts` | `looks.ts`                    | streamline trace and draw, animation window, glow cloud                                                                                                                                     |
| `field-rendering/surfaceDepth.ts`     | `gl.ts` surface               | depth-only copies of `SURFACE`, then `SURFACE_xyz_uv`, `SURFACE_AMBIGUOUS`                                                                                                                  |
| `field-rendering/cut3d.ts`            | `CUT_GLSL`                    | the cutaway uniforms and GLSL, shared by every look                                                                                                                                         |
| `field-rendering/scale3d.ts`          | `fieldStats`                  | the median-                                                                                                                                                                                 | F   | scale, computed on the CPU from the compiled field |

Plugin side (`src/plugins/vector-tools/`):

- `model.ts`: `schemaVersion` 4 adds a `space3d` block (look, shape,
  placement, count, length, colour scale rule, cues, occlusion, mesh,
  cutaway and its angle and facing, streamline and cloud settings). The 2D
  config is untouched. Normalisation fills the block for old configs.
- `index.ts`: on the 3D product, start `Overlay3D` instead of refusing.
  `flowAvailability` keeps refusing the 2D flow there. The 3D path has its
  own availability, which needs WebGL2, plus `EXT_color_buffer_float` for
  streamlines only.
- `environment.ts` / a new `surfaces3d.ts`: read the graphed surfaces from
  `cc.getAllItemModels()` by `expression_type`, as the environment scan
  reads definitions. It coalesces on `on-evaluator-changes` for the same
  reasons (briefing §5.1) and compiles each surface with the existing
  compiler (2D for `SURFACE`, u/v for parametric).
- `components/VectorToolsPanel.tsx`: on 3D, the Arrows tab gains Look,
  Placement and Cut-away rows. Behind-the-surface joins the Colour/Depth
  area. Every control is a chip row or a slider with Auto, as in the
  mock-up.

## 4. Order of work

Each step is committed green and shown by a screenshot from the real Desmos
3D (integration harness) before the next starts.

1. **Overlay3D and the camera hook.** An overlay that draws one ring per
   landmark, and the probe's rotation check as an integration test (median
   ≤ 1 px, 90th percentile ≤ 1.5 px). This replaces "refuses the 3D
   calculator" for live arrows.
2. **Arrows.** Port `overlay.ts` with jitter, the Auto count and shape, and
   the field-rule colour scale. Integration test: a point charge draws,
   colours spread (no more than half the arrows in the first tenth of the
   ramp), and a screenshot.
3. **Hidden and Faded.** `surfaces3d.ts` and `surfaceDepth.ts` for
   `SURFACE`, then `SURFACE_xyz_uv` and `SURFACE_AMBIGUOUS`. Respect
   `hidden`. Integration test: an arrow under `z=…` disappears in Hidden
   and fades in Faded (pixel counts, as the mock-up's cut test does).
4. **Cutaway.** Near half and Cake slice, facing you or fixed. Test: pixel
   count drops by roughly the slice's share.
5. **Looks.** Streamlines (trace, both directions, animation), then the
   glow cloud. Test: drawn, and the animation advances between frames.
6. **Panel and persistence.** The schema bump, normalisation tests, a
   reload that keeps the 3D settings, and the panel on `/3d`.
7. **Clean-up.** Briefing §5.5 and §3.3 and the architecture doc
   updated. The 3D refusal test rewritten to the new behaviour.

Step 2 of the 3D roadmap (Desmos-native `vector()` output) and step 3
(particle flow) follow afterwards and are not in this plan.
`desmos3d_native_vector_bench.js` from GPT's round is the starting point
for step 2 once patched.

## 5. Decisions still open

These are Rafael's to make. Each has a default the build will use until
he answers.

1. **Arrow length.** 0.8 of the spacing (the mock-up) or 0.55 (GPT's).
   Default 0.8, on the existing slider.
2. **Undefined points.** Hide arrows where the field is undefined (a
   validity flag in the GLSL helpers), or keep the ε guards that draw a
   finite arrow there. The flag changes the shared prelude the 2D plugin
   also uses (briefing §11). Default: keep the guards; do not change the
   prelude without a yes.
3. **Hidden, for surfaces we cannot redraw.** Implicit surfaces have no
   depth copy until a mesher exists. Default: arrows show through them
   (X-ray for that surface only), and the panel names the surface it cannot
   hide behind.
4. **Translucent surfaces.** When the user has lowered a surface's
   opacity in Desmos, Faded is the honest picture. Default: Hidden stays
   Hidden; an "Auto: fade behind see-through surfaces" chip is offered,
   off.
5. **Desmos's terms on private fields** (`DESMOS_3D_CAMERA.md`, GPT's C2)
   for anything distributed publicly. Unchanged by this plan.

## 6. Risks

- **Private fields.** `grapher3d.webglCanvas`, `onRedraw3dResults`,
  `redrawResult.camera`, `viewportController`, `formula.expression_type`.
  Each gets an integration test that fails loudly if it moves, as
  `camera3d.int.test.ts` does for the camera.
- **A third WebGL context.** Desmos 3D, the 2D arrows' context (unused on
  3D) and ours. Only one overlay context should exist on `/3d`; Overlay3D
  starts only there, and the 2D overlays stay stopped.
- **Integration suite under load.** Parallel workers sharing one browser
  produced timeouts and `Target closed` on this machine. Run the suite
  serially (`--runInBand`) when it matters; the repo's 28 suites pass that
  way.

## 7. Progress

| Step | Commit      | What it is                                                       | Evidence                                                                                      |
| ---- | ----------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 1    | `0baf7828`  | `Overlay3D`: the canvas after Desmos's, drawn in its redraw      | `Overlay3D.unit.test.ts`                                                                      |
| 2    | `dd6312ec`  | Live arrows, field-rule colour scale, R and the `space3d` config | `plugin-charge.png`, `plugin-one-arrow.png` (an arrow within 2 px of `camera3d`'s projection) |
| 3    | `f4e65009`  | Hidden and Faded behind graphed surfaces                         | `plugin-occlusion-*.png`                                                                      |
| 4    | `852607ef`  | Cutaway: near half, cake slice facing you or fixed               | `plugin-cutaway-*.png`                                                                        |
| 5    | `4183775b`  | Streamlines (animated) and the glow cloud                        | `plugin-streamlines.png`, `plugin-cloud.png`                                                  |
| 6    | `87b5a03f`  | Every 3D setting in the panel, stored with the field             | `plugin-panel-3d.png`                                                                         |
| 7    | this commit | The briefing (§3.4, §5.5) and this record                        | —                                                                                             |

Pictures are in `docs/assets/vector-3d/`; `vector3d.int.test.ts` drives the
real Desmos 3D for all of them.

Left from this plan, and why:

- **Gradient fields in 3D** say so instead of drawing: the GPU differentiates
  by central differences, and the step has to follow the box, which the
  field prelude does not see yet.
- **Arrows on a surface** (the mock-up's fourth placement) need a chosen
  surface compiled into the arrow shader's `vtSurface`.
- **A real-GPU drag by eye** is still the last check of the alignment; every
  measurement so far is headless.
- Open decisions (§5) keep their defaults until answered.
