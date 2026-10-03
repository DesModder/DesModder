# Matching the Desmos 3D camera

_Established 2026-10-02 against desmos.com/3d in headless Chrome, with the
extension loaded the way the integration harness loads it. This is the
groundwork for drawing anything over a 3D graph (live 3D arrows, layered 3D
FieldPlay particles, a shallow-water surface). It answers question Q11(a) of
`VECTOR_TOOLS_FLUID_RESEARCH_BRIEF.md`, which GPT's two replies could not
answer without a live Desmos._

The code is `src/field-rendering/camera3d.ts`, its unit test pins it to frames
Desmos actually drew, and `camera3d.int.test.ts` repeats the check against a
live Desmos so that a Desmos build which moves these fields fails loudly
rather than misaligning an overlay.

---

## Where the camera is

Desmos 3D builds geometry in a worker and draws it on the main thread, on its
own WebGL canvas (`canvas.dcg-webgl-canvas`, with depth peeling). Every redraw
returns a result to the main thread, kept as `grapher3d.redrawResult`, and it
carries the exact camera that frame was drawn with:

| Field                                  | What it is                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------------ |
| `redrawResult.camera.worldMatrixWorld` | math coordinates → world: the rotation and the box's per-axis scaling (and centring) |
| `.cameraMatrixWorldInverse`            | world → camera; the camera sits 50 world units out                                   |
| `.cameraProjectionMatrix`              | camera → clip; perspective, or orthographic when the perspective slider is at 0      |
| `.cameraType`                          | `"PerspectiveCamera"` or `"OrthographicCamera"`                                      |
| `redrawResult.screen`                  | the CSS-pixel size of the graph canvas the frame was drawn for                       |

All three are column-major `Matrix4`s in three.js's convention (Desmos's shared
module exports three.js's `Vector3`, `Matrix4` and `Quaternion`). Desmos's own
`grapher3d.mathCoordinatesToScreenCoordinates({x, y, z}, {skipRounding})` is
exactly:

```
clip   = projection · view · world · (x, y, z, 1)
ndc    = clip.xyz / clip.w
screen = ((ndc.x + 1) · width / 2,  (1 − ndc.y) · height / 2)    CSS px from the canvas corner
```

`camera3d.ts` is that chain. `mathToClip(camera)` folds it into the one matrix a
shader needs. On a canvas that exactly covers `grapher3d.canvasLayer.canvasNode`,
`gl_Position = mathToClip * vec4(p, 1.0)` puts a vertex where Desmos draws that
point, because WebGL's viewport mapping is the same as Desmos's.

**Use the camera Desmos drew with, not the rotation.**
`controls.worldRotation3D` says nothing about the box scaling, the camera
distance, the field of view or orthographic mode. It also runs ahead of the
picture: after a rotation change, the redraw that shows it arrives 2–3 frames
later. An overlay that follows the redraw is never out of step with the graph.
This also means DesModder's Quake Pro, which changes the field of view, needs
no special handling: its effect is already in the matrices.

## How well it matches

Each landmark was drawn as a pure green point (`#00ff00`; nothing else in the 3D
scene is green). Its centroid was found in a screenshot and compared with the
projection, using the camera read at the moment of that screenshot.

| View                                            | Camera       | Points | RMS (px) | Max (px) |
| ----------------------------------------------- | ------------ | -----: | -------: | -------: |
| tilt 0.35, turn 0.40, 1200×800 @1×              | perspective  |      8 |     0.69 |     1.76 |
| tilt 1.10, turn 2.50, 1200×800 @1×              | perspective  |      9 |     0.27 |     0.46 |
| tilt −0.40, turn 4.20 (from below), @1×         | perspective  |      8 |     0.31 |     0.52 |
| perspective 0, @1×                              | orthographic |      8 |     0.49 |     0.99 |
| perspective 3, @1×                              | perspective  |     11 |     0.44 |     0.93 |
| box [−10, 10] × [−2, 4] × [−1, 3], @1×          | perspective  |      7 |     0.16 |     0.29 |
| tilt 1.10, turn 2.50, 1000×700 @2×              | perspective  |     11 |     0.20 |     0.44 |
| box [−10, 10] × [−2, 4] × [−1, 3], 1000×700 @2× | perspective  |      9 |     0.09 |     0.12 |

Agreement between our reimplementation and Desmos's own function is exact to
floating point (10⁻¹³ px) in every case. The residual against the pixels is the
detector's: shading darkens one side of each sphere below the colour threshold
and pulls its centroid. GPT's proposed acceptance (RMS ≤ 0.5 px, max ≤ 1 px) is
met in six of eight views; the other two exceed it by that bias.

Evidence: `docs/assets/camera3d-landmarks-rotated.png` and
`docs/assets/camera3d-landmarks-noncubic.png`. In each, Desmos drew the red
points and our overlay canvas drew a blue ring wherever `camera3d`'s chain put
each one.

## Keeping an overlay in step

Override `grapher3d.onRedraw3dResults` on the instance. It fired exactly once
per redraw in every test: 5 calls for 5 discrete rotations, and 10 calls during
11 animation frames of continuous rotation. Its argument is the redraw result
itself, camera included.

DesModder's `hookIntoFunction` runs handlers _before_ the original, when
`grapher3d.redrawResult` still holds the previous frame. So a handler must read
the camera from its argument, `cameraFromRedrawResult(args[0])`, not from the
grapher. Drawing the overlay in the same task as Desmos's paint keeps the two
in the same displayed frame.

## Facts found the hard way

- **`setState` ignores numeric 3D bounds.** The 3D graph state carries
  `viewport` (numbers) and `__v12ViewportLatexStash` (LaTeX strings), and
  `setState` reads the stash. Setting only the numbers silently leaves the
  default ±5 cube. That cost one wrong measurement here: a "non-cubic box" run
  that was really a cube. `Calc.setMathBounds` sets x and y only.
- **`setState` ignores `graph.worldRotation3D`.** Orientation is set the way
  DesModder's video creator does it (`globals/matrix3.ts`, `setOrientation`):
  assign `controls.worldRotation3D`, call
  `viewportController.animateToOrientation(m)`, and set
  `transition.duration = 0`.
- **`Matrix3.set` takes rows and stores columns.** That explains the
  "row-major" and "column-major" comments in `matrix3.ts`: both are true, for
  the arguments and the storage respectively. An overlay never needs this
  matrix, because the camera is complete without it.
- **Straight after a change, the redraw counters say "done" before the redraw
  that shows it has been requested.** Wait for `lastCompletedRedrawId` to
  _exceed_ its value before the change, and to equal `redrawRequestId`. Waiting
  only for agreement captures the previous frame.
- **A programmatic orientation change may not repaint the canvas until the next
  redraw.** Screenshot baselines taken then are stale; the colour-keyed detector
  needs none.
- **Desmos clips everything to the box.** A point on the boundary shows only
  part of its sphere. Landmarks, and anything we draw, belong inside it.
- **The z = 0 plane is translucent.** Points seen through it fade, so detection
  misses some of them (hence 7–11 of 12 per view).

## What is still unknown

- **Depth.** Desmos draws on its own main-thread WebGL context, and a texture or
  depth buffer cannot cross contexts. Our overlay can depth-test its own
  geometry with `mathToClip` but cannot be occluded by Desmos's surfaces. GPT's
  options (accept the limit, redraw chosen solids ourselves, native snapshots,
  or a private renderer hook) remain a **decision**.
- **Continuous drags on a real GPU.** Every measurement above is headless
  software GL at rest, plus redraw counting during a scripted rotation. A real
  user drag at 60 Hz should be checked by eye once a live overlay exists.
- **These are private fields.** The integration test is the guard, and Desmos's
  terms on reverse engineering (GPT's C2) remain Rafael's call for anything
  distributed publicly.
